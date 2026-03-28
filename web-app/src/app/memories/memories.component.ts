import { Component, inject, signal, computed, OnInit } from '@angular/core';
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
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
  ],
  templateUrl: './memories.component.html',
  styleUrl: './memories.component.scss',
})
export class MemoriesComponent implements OnInit {
  private memoryService = inject(MemoryService);
  private locationService = inject(LocationService);
  private memoryStore = inject(MemoryStore);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  memories = this.memoryStore.memoriesList;
  isLoading = signal(true);
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
  detachingMediaId = signal<number | null>(null);

  showNewLocationInCreate = signal(false);
  showNewLocationInEdit = signal(false);

  memoryIsCreating = signal(false);
  memoryIsUpdating = signal(false);
  memoryIsDeleting = signal(false);
  locationIsSaving = signal(false);

  createErrorMessage = signal<string | null>(null);
  editErrorMessage = signal<string | null>(null);

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
      name: ['', [Validators.required]],
      state: ['', [Validators.required]],
      street: [''],
      city: [''],
      zipcode: [''],
    });
  }

  ngOnInit(): void {
    this.getMemories();
    this.loadLocations();
  }

  getMemories(): void {
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
  }

  openDeleteDialog(memory: Memory): void {
    this.selectedDeleteMemory.set(memory);
    this.deleteMemoryDialog.set(true);
  }

  closeDeleteDialog(): void {
    this.deleteMemoryDialog.set(false);
    this.selectedDeleteMemory.set(null);
  }

  onCreateCoverChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedCoverFile.set(input.files[0]);
      this.createErrorMessage.set(null);
    } else {
      this.selectedCoverFile.set(null);
    }
  }

  onCreateAdditionalFilesChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedAdditionalFiles.set(Array.from(input.files));
    } else {
      this.selectedAdditionalFiles.set([]);
    }
  }

  onEditCoverChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedEditCoverFile.set(input.files[0]);
    } else {
      this.selectedEditCoverFile.set(null);
    }
  }

  onEditAdditionalFilesChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedEditAdditionalFiles.set(Array.from(input.files));
    } else {
      this.selectedEditAdditionalFiles.set([]);
    }
  }

  detachMedia(mediaId: number): void {
    this.detachingMediaId.set(mediaId);
    this.memoryService.deleteMediaItem(mediaId).subscribe({
      next: (res) => {
        this.memoryStore.setMemory(res.results);
        const sel = this.selectedEditMemory();
        if (sel && sel.id === res.results.id) {
          this.selectedEditMemory.set(res.results);
        }
        this.detachingMediaId.set(null);
        this.snackBar.open('Photo removed', 'Dismiss', { duration: 3000 });
      },
      error: (err) => {
        this.detachingMediaId.set(null);
        this.snackBar.open(
          err?.error?.message ?? 'Could not remove photo',
          'Dismiss',
          { duration: 5000 }
        );
      },
    });
  }

  saveNewLocation(context: 'create' | 'edit'): void {
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
    if (!this.newMemoryForm.valid || !this.selectedCoverFile()) {
      this.newMemoryForm.markAllAsTouched();
      if (!this.selectedCoverFile()) {
        this.createErrorMessage.set('A cover image is required.');
      }
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

    const cover = this.selectedCoverFile()!;
    const extra = this.selectedAdditionalFiles();

    this.memoryService.createMemory(payload, cover, extra).subscribe({
      next: (response) => {
        this.memoryStore.addMemory(response.results);
        this.finishCreateSuccess();
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

  private finishCreateSuccess(): void {
    this.closeCreateDialog();
    this.memoryIsCreating.set(false);
    this.snackBar.open('Memory created', 'Dismiss', { duration: 3000 });
  }

  updateMemory(): void {
    const mem = this.selectedEditMemory();
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
              this.finishEditSuccess();
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
          this.finishEditSuccess();
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

  private finishEditSuccess(): void {
    this.editErrorMessage.set(null);
    this.selectedEditAdditionalFiles.set([]);
    this.selectedEditCoverFile.set(null);
    this.closeEditDialog();
    this.memoryIsUpdating.set(false);
    this.snackBar.open('Memory updated', 'Dismiss', { duration: 3000 });
  }

  deleteMemory(): void {
    const mem = this.selectedDeleteMemory();
    if (!mem) {
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
