import {
  Component,
  HostListener,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MemoryService,
  Memory,
  Media,
  CreateMemoryPayload,
  Location,
} from '../core/services/memory.service';
import {
  LocationService,
  CreateLocationPayload,
} from '../core/services/location.service';
import { MemoryStore } from '../core/stores/memory.store';
import { UserPreferencesStore } from '../core/stores/user-preferences.store';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import {
  setFormErrors,
  clearFormErrors,
  getFieldError,
} from '../core/utils/form.utils';
import {
  apiDateTimeToDatetimeLocal,
  datetimeLocalToApiUtc,
  formatMemoryDateForDisplay,
  nowDateTime,
  nowUtcAsDatetimeLocal,
} from '../core/utils/memory-datetime.utils';
import { isMobile } from '../core/utils/mobile.utils';
import { validateImageFiles } from '../core/utils/file-validation.utils';

const PHOTO_LIGHTBOX_BODY_CLASS = 'memories-photo-lightbox-open';

@Component({
  selector: 'app-memories',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatCheckboxModule,
  ],
  templateUrl: './memories.component.html',
  styleUrl: './memories.component.scss',
})
export class MemoriesComponent implements OnInit, OnDestroy {
  private memoryService = inject(MemoryService);
  private locationService = inject(LocationService);
  private memoryStore = inject(MemoryStore);
  private userPreferencesStore = inject(UserPreferencesStore);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  memories = this.memoryStore.memoriesList;
  /**
   * When the list has already been loaded this session, start false so the first
   * paint shows cards — not a one-frame loading state that swaps the whole view.
   */
  isLoading = signal(!this.memoryStore.listLoadedFromApi());
  locations = signal<Location[]>([]);

  createMemoryDialog = signal(false);
  editMemoryDialog = signal(false);
  deleteMemoryDialog = signal(false);

  selectedEditMemory = signal<Memory | null>(null);
  selectedDeleteMemory = signal<Memory | null>(null);

  /** Media rows for the edit dialog, sorted by id (primary cover = lowest id). */
  editMediaSorted = computed(() => {
    const m = this.selectedEditMemory();
    if (!m?.media?.length) {
      return [] as Media[];
    }
    return [...m.media].sort((a, b) => a.id - b.id);
  });

  newMemoryForm: FormGroup;
  editMemoryForm: FormGroup;
  newLocationForm: FormGroup;

  selectedCoverFile = signal<File | null>(null);
  selectedAdditionalFiles = signal<File[]>([]);
  selectedEditCoverFile = signal<File | null>(null);
  selectedEditAdditionalFiles = signal<File[]>([]);
  /** Media ids to DELETE on Save (staged; not removed from server until then). */
  pendingMediaRemovalIds = signal<number[]>([]);

  showNewLocationInCreate = signal(false);
  showNewLocationInEdit = signal(false);

  memoryIsCreating = signal(false);
  memoryIsUpdating = signal(false);
  memoryIsDeleting = signal(false);
  locationIsSaving = signal(false);

  createErrorMessage = signal<string | null>(null);
  editErrorMessage = signal<string | null>(null);

  /** After save with no photos: offer optional Gemini-generated image. */
  aiImageOfferMemory = signal<Memory | null>(null);
  aiImageUseAvatarReference = signal(true);
  /** Use up to two most recent photos from other memories as extra model context (server-side). */
  aiImageUseRecentMemoryPhotos = signal(false);
  memoryIsGeneratingAiImage = signal(false);

  /**
   * From GET /api/health — when false, do not show the post-save AI image dialog
   * (server has no GEMINI_API_KEY). null = not loaded yet.
   */
  aiImageGenerationAvailable = signal<boolean | null>(null);

  /** When set, full-screen lightbox for viewing a memory photo. */
  expandedMemoryMedia = signal<{ url: string; alt: string } | null>(null);

  /** True when the user has at least one photo on another memory (enables meaningful recent-photo context). */
  hasOtherMemoriesWithPhotosForAi = computed(() => {
    const offerId = this.aiImageOfferMemory()?.id;
    if (offerId == null) {
      return false;
    }
    return this.memories().some(
      (m) =>
        m.id !== offerId &&
        Array.isArray(m.media) &&
        m.media.length > 0
    );
  });

  isMobile = isMobile;
  getFieldError = getFieldError;

  constructor() {
    this.newMemoryForm = this.fb.group({
      journal_entry: ['', [Validators.required]],
      time: ['', [Validators.required]],
      location_id: [null as number | null, [Validators.required]],
    });

    this.editMemoryForm = this.fb.group({
      journal_entry: ['', [Validators.required]],
      time: ['', [Validators.required]],
      location_id: [null as number | null, [Validators.required]],
    });

    this.newLocationForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      state: ['', [Validators.required, Validators.maxLength(255)]],
      street: ['', [Validators.maxLength(255)]],
      city: ['', [Validators.maxLength(255)]],
      zipcode: ['', [Validators.maxLength(255)]],
    });
  }

  ngOnDestroy(): void {
    if (this.expandedMemoryMedia()) {
      this.closeExpandedMemoryMedia();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(_event: KeyboardEvent): void {
    if (!this.expandedMemoryMedia()) {
      return;
    }
    this.closeExpandedMemoryMedia();
  }

  openExpandedMemoryMedia(url: string, alt: string): void {
    this.expandedMemoryMedia.set({ url, alt });
    document.body.classList.add(PHOTO_LIGHTBOX_BODY_CLASS);
  }

  closeExpandedMemoryMedia(): void {
    this.expandedMemoryMedia.set(null);
    document.body.classList.remove(PHOTO_LIGHTBOX_BODY_CLASS);
  }

  ngOnInit(): void {
    this.memoryService.getBackendHealth().subscribe({
      next: (h) => {
        this.aiImageGenerationAvailable.set(!!h.ai_image_generation_available);
      },
      error: () => {
        this.aiImageGenerationAvailable.set(false);
      },
    });
    if (!this.memoryStore.listLoadedFromApi()) {
      this.loadMemoriesWithSpinner();
    }
    // Cached list: do not auto-refetch on every navigation — that replaces store
    // data and re-renders the grid (visible blink). Data updates on create/edit/delete.
    this.loadLocations();
  }

  /** First visit / cold cache: show spinner until API returns. */
  private loadMemoriesWithSpinner(): void {
    this.isLoading.set(true);
    this.memoryService.getMemories().subscribe({
      next: (response) => {
        this.memoryStore.setMemories(response.results);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error fetching memories:', error);
        this.isLoading.set(false);
      },
    });
  }

  loadLocations(): void {
    this.locationService.listLocations().subscribe({
      next: (res) => {
        this.locations.set(res.results);
      },
      error: (err) => console.error('Error loading locations', err),
    });
  }

  formatDate(memory: Memory): string {
    return formatMemoryDateForDisplay(memory.time);
  }

  locationName(memory: Memory): string {
    return memory.location?.name ?? 'Unknown';
  }

  isPrimaryMediaItem(media: Media): boolean {
    const sorted = this.editMediaSorted();
    return sorted.length > 0 && sorted[0].id === media.id;
  }

  openCreateDialog(): void {
    this.newMemoryForm.reset({
      journal_entry: '',
      time: nowDateTime(),
      location_id: null,
    });
    this.selectedCoverFile.set(null);
    this.selectedAdditionalFiles.set([]);
    this.showNewLocationInCreate.set(false);
    this.newLocationForm.reset({
      name: '',
      state: '',
      street: '',
      city: '',
      zipcode: '',
    });
    this.createErrorMessage.set(null);
    clearFormErrors(this.newMemoryForm);
    this.createMemoryDialog.set(true);
  }

  closeCreateDialog(): void {
    this.createMemoryDialog.set(false);
    this.selectedCoverFile.set(null);
    this.selectedAdditionalFiles.set([]);
  }

  openEditDialog(memory: Memory): void {
    this.pendingMediaRemovalIds.set([]);
    this.selectedEditMemory.set(memory);
    this.editMemoryForm.patchValue({
      journal_entry: memory.journal_entry,
      time: apiDateTimeToDatetimeLocal(memory.time),
      location_id: memory.location_id,
    });
    this.selectedEditCoverFile.set(null);
    this.selectedEditAdditionalFiles.set([]);
    this.showNewLocationInEdit.set(false);
    this.newLocationForm.reset({
      name: '',
      state: '',
      street: '',
      city: '',
      zipcode: '',
    });
    this.editErrorMessage.set(null);
    clearFormErrors(this.editMemoryForm);
    this.editMemoryDialog.set(true);
  }

  closeEditDialog(): void {
    this.editMemoryDialog.set(false);
    this.selectedEditMemory.set(null);
    this.selectedEditCoverFile.set(null);
    this.selectedEditAdditionalFiles.set([]);
    this.pendingMediaRemovalIds.set([]);
  }

  openDeleteDialog(memory: Memory): void {
    this.selectedDeleteMemory.set(memory);
    this.deleteMemoryDialog.set(true);
  }

  closeDeleteDialog(): void {
    this.deleteMemoryDialog.set(false);
    this.selectedDeleteMemory.set(null);
  }

  /** First file = cover; remaining = additional (same request as before). */
  onCreatePhotosChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      this.selectedCoverFile.set(null);
      this.selectedAdditionalFiles.set([]);
      this.createErrorMessage.set(null);
      return;
    }
    const files = Array.from(input.files);
    const photoErr = validateImageFiles(files);
    if (photoErr) {
      this.createErrorMessage.set(photoErr);
      this.selectedCoverFile.set(null);
      this.selectedAdditionalFiles.set([]);
      input.value = '';
      return;
    }
    this.selectedCoverFile.set(files[0]);
    this.selectedAdditionalFiles.set(files.slice(1));
    this.createErrorMessage.set(null);
  }

  /**
   * One file: append only (does not replace cover). Two or more: first replaces
   * cover, the rest are appended after save.
   */
  onEditPhotosChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      this.selectedEditCoverFile.set(null);
      this.selectedEditAdditionalFiles.set([]);
      return;
    }
    const files = Array.from(input.files);
    const photoErr = validateImageFiles(files);
    if (photoErr) {
      this.editErrorMessage.set(photoErr);
      this.selectedEditCoverFile.set(null);
      this.selectedEditAdditionalFiles.set([]);
      input.value = '';
      return;
    }
    this.editErrorMessage.set(null);
    if (files.length === 1) {
      this.selectedEditCoverFile.set(null);
      this.selectedEditAdditionalFiles.set(files);
    } else {
      this.selectedEditCoverFile.set(files[0]);
      this.selectedEditAdditionalFiles.set(files.slice(1));
    }
  }

  togglePendingMediaRemoval(mediaId: number): void {
    this.pendingMediaRemovalIds.update((ids) => {
      const i = ids.indexOf(mediaId);
      if (i >= 0) {
        return ids.filter((id) => id !== mediaId);
      }
      return [...ids, mediaId];
    });
  }

  isPendingMediaRemoval(mediaId: number): boolean {
    return this.pendingMediaRemovalIds().includes(mediaId);
  }

  saveNewLocation(context: 'create' | 'edit'): void {
    if (this.locationIsSaving()) {
      return;
    }
    if (!this.newLocationForm.valid) {
      this.newLocationForm.markAllAsTouched();
      return;
    }
    const v = this.newLocationForm.value as CreateLocationPayload;
    this.locationIsSaving.set(true);
    this.locationService.createLocation(v).subscribe({
      next: (res) => {
        const loc = res.results;
        this.locations.update((list) =>
          [...list, loc].sort((a, b) => a.name.localeCompare(b.name))
        );
        if (context === 'create') {
          this.newMemoryForm.patchValue({ location_id: loc.id });
          this.showNewLocationInCreate.set(false);
        } else {
          this.editMemoryForm.patchValue({ location_id: loc.id });
          this.showNewLocationInEdit.set(false);
        }
        this.newLocationForm.reset({
          name: '',
          state: '',
          street: '',
          city: '',
          zipcode: '',
        });
        this.locationIsSaving.set(false);
        this.snackBar.open('Location created', 'Dismiss', { duration: 3000 });
      },
      error: (err) => {
        this.locationIsSaving.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'Could not create location',
          'Dismiss',
          { duration: 5000 }
        );
      },
    });
  }

  createMemory(): void {
    if (this.memoryIsCreating()) {
      return;
    }
    if (!this.newMemoryForm.valid) {
      this.newMemoryForm.markAllAsTouched();
      return;
    }

    this.memoryIsCreating.set(true);
    this.createErrorMessage.set(null);
    clearFormErrors(this.newMemoryForm);

    const raw = this.newMemoryForm.value;
    const payload: CreateMemoryPayload = {
      journal_entry: raw.journal_entry,
      time: datetimeLocalToApiUtc(raw.time),
      location_id: raw.location_id,
    };

    const cover = this.selectedCoverFile();
    const extra = this.selectedAdditionalFiles();

    this.memoryService.createMemory(payload, cover ?? undefined, extra).subscribe({
      next: (response) => {
        this.memoryStore.addMemory(response.results);
        this.finishCreateSuccess(response.results);
      },
      error: (error) => {
        if (error?.error?.data && typeof error.error.data === 'object') {
          setFormErrors(this.newMemoryForm, error.error.data);
          this.createErrorMessage.set('Please fix the validation errors below.');
        } else {
          this.createErrorMessage.set(
            error?.error?.message ?? 'Error creating memory'
          );
        }
        this.memoryIsCreating.set(false);
      },
    });
  }

  private finishCreateSuccess(memory: Memory): void {
    this.closeCreateDialog();
    this.memoryIsCreating.set(false);
    this.snackBar.open('Memory created', 'Dismiss', { duration: 3000 });
    this.maybeOfferAiImage(memory);
  }

  private canOfferAiImage(memory: Memory | null | undefined): boolean {
    if (!memory?.id) {
      return false;
    }
    if (memory.media && memory.media.length > 0) {
      return false;
    }
    if (!this.userPreferencesStore.shouldOfferAiImagePrompt()) {
      return false;
    }
    return true;
  }

  private maybeOfferAiImage(memory: Memory | null | undefined): void {
    if (!this.canOfferAiImage(memory)) {
      return;
    }

    const openDialog = () => {
      this.aiImageUseAvatarReference.set(true);
      const prefs = this.userPreferencesStore.preferences();
      this.aiImageUseRecentMemoryPhotos.set(
        prefs?.use_extra_memory_context ?? true
      );
      this.aiImageOfferMemory.set(memory!);
    };

    const avail = this.aiImageGenerationAvailable();
    if (avail === false) {
      return;
    }
    if (avail === true) {
      openDialog();
      return;
    }

    this.memoryService.getBackendHealth().subscribe({
      next: (h) => {
        this.aiImageGenerationAvailable.set(!!h.ai_image_generation_available);
        if (!this.aiImageGenerationAvailable()) {
          return;
        }
        if (!this.canOfferAiImage(memory)) {
          return;
        }
        openDialog();
      },
      error: () => {
        this.aiImageGenerationAvailable.set(false);
      },
    });
  }

  dismissAiImageOffer(): void {
    this.aiImageOfferMemory.set(null);
  }

  /** Persist “don’t ask again” and close the modal. */
  dontAskAgainAiImagePrompt(): void {
    this.userPreferencesStore.updatePartial(
      { dismiss_memory_image_prompt: true },
      () => {
        this.aiImageOfferMemory.set(null);
        this.snackBar.open(
          'Preference saved. You can change this anytime in Settings.',
          'Dismiss',
          { duration: 5000 }
        );
      },
      () => {
        this.snackBar.open('Could not save preference', 'Dismiss', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
      }
    );
  }

  onAiAvatarRefChange(ev: MatCheckboxChange): void {
    this.aiImageUseAvatarReference.set(ev.checked);
  }

  onAiRecentMemoryPhotosChange(ev: MatCheckboxChange): void {
    this.aiImageUseRecentMemoryPhotos.set(ev.checked);
  }

  confirmAiImageGeneration(): void {
    const mem = this.aiImageOfferMemory();
    if (!mem) {
      return;
    }
    if (this.memoryIsGeneratingAiImage()) {
      return;
    }
    this.memoryIsGeneratingAiImage.set(true);
    this.memoryService
      .generateMemoryImage(mem.id, {
        use_avatar_reference: this.aiImageUseAvatarReference(),
        use_recent_memory_photos: this.aiImageUseRecentMemoryPhotos(),
      })
      .subscribe({
        next: (res) => {
          this.memoryStore.setMemory(res.results);
          this.memoryIsGeneratingAiImage.set(false);
          this.aiImageOfferMemory.set(null);
          this.snackBar.open('AI image added to your memory', 'Dismiss', {
            duration: 4000,
          });
        },
        error: (err: HttpErrorResponse) => {
          this.memoryIsGeneratingAiImage.set(false);
          const body = err.error as { message?: string } | undefined;
          const msg =
            body?.message ??
            'Could not generate an image. You can try again from edit later.';
          this.snackBar.open(msg, 'Dismiss', { duration: 8000 });
        },
      });
  }

  updateMemory(): void {
    const mem = this.selectedEditMemory();
    if (this.memoryIsUpdating()) {
      return;
    }
    if (!mem || !this.editMemoryForm.valid) {
      this.editMemoryForm.markAllAsTouched();
      return;
    }

    this.memoryIsUpdating.set(true);
    this.editErrorMessage.set(null);
    clearFormErrors(this.editMemoryForm);

    const raw = this.editMemoryForm.value;
    const body = {
      journal_entry: raw.journal_entry,
      time: datetimeLocalToApiUtc(raw.time),
      location_id: raw.location_id,
    };

    const coverFile = this.selectedEditCoverFile();
    const extraAfter = this.selectedEditAdditionalFiles();

    this.memoryService.updateMemory(mem.id, body, coverFile ?? undefined).subscribe({
      next: (response) => {
        this.memoryStore.setMemory(response.results);
        this.selectedEditMemory.set(response.results);
        if (extraAfter.length > 0) {
          this.memoryService.addMemoryMedia(response.results.id, extraAfter).subscribe({
            next: (r) => {
              this.memoryStore.setMemory(r.results);
              this.selectedEditMemory.set(r.results);
              this.runPendingMediaDeletes();
            },
            error: (error) => {
              this.editErrorMessage.set(
                error?.error?.message ??
                  'Details saved but new photos failed to upload.'
              );
              this.memoryIsUpdating.set(false);
              this.snackBar.open(
                this.editErrorMessage() ?? 'Upload failed',
                'Dismiss',
                { duration: 6000 }
              );
            },
          });
        } else {
          this.runPendingMediaDeletes();
        }
      },
      error: (error) => {
        if (error?.error?.data && typeof error.error.data === 'object') {
          setFormErrors(this.editMemoryForm, error.error.data);
          this.editErrorMessage.set('Please fix the validation errors below.');
        } else {
          this.editErrorMessage.set(
            error?.error?.message ?? 'Error updating memory'
          );
        }
        this.memoryIsUpdating.set(false);
      },
    });
  }

  /**
   * After memory fields (and optional new uploads) are saved, DELETE any photos
   * the user marked for removal, then close the dialog.
   */
  private runPendingMediaDeletes(): void {
    const ids = [...this.pendingMediaRemovalIds()];
    if (ids.length === 0) {
      this.finishEditSuccess();
      return;
    }

    const runAt = (index: number): void => {
      if (index >= ids.length) {
        this.pendingMediaRemovalIds.set([]);
        this.finishEditSuccess();
        return;
      }
      this.memoryService.deleteMediaItem(ids[index]).subscribe({
        next: (res) => {
          this.memoryStore.setMemory(res.results);
          if (this.selectedEditMemory()?.id === res.results.id) {
            this.selectedEditMemory.set(res.results);
          }
          runAt(index + 1);
        },
        error: (err) => {
          this.editErrorMessage.set(
            err?.error?.message ?? 'Could not remove one or more photos.'
          );
          this.memoryIsUpdating.set(false);
          this.snackBar.open(
            this.editErrorMessage() ?? 'Remove failed',
            'Dismiss',
            { duration: 6000 }
          );
        },
      });
    };

    runAt(0);
  }

  private finishEditSuccess(): void {
    const memory = this.selectedEditMemory();
    this.editErrorMessage.set(null);
    this.selectedEditAdditionalFiles.set([]);
    this.selectedEditCoverFile.set(null);
    this.closeEditDialog();
    this.memoryIsUpdating.set(false);
    this.snackBar.open('Memory updated', 'Dismiss', { duration: 3000 });
    this.maybeOfferAiImage(memory ?? undefined);
  }

  deleteMemory(): void {
    const mem = this.selectedDeleteMemory();
    if (!mem) {
      return;
    }
    if (this.memoryIsDeleting()) {
      return;
    }

    this.memoryIsDeleting.set(true);
    this.memoryService.deleteMemory(mem.id).subscribe({
      next: () => {
        this.memoryStore.removeMemory(mem);
        this.closeDeleteDialog();
        this.memoryIsDeleting.set(false);
        this.snackBar.open('Memory deleted', 'Dismiss', { duration: 3000 });
      },
      error: (error) => {
        console.error('Error deleting memory:', error);
        this.memoryIsDeleting.set(false);
        this.snackBar.open('Could not delete memory', 'Dismiss', {
          duration: 5000,
        });
      },
    });
  }
}
