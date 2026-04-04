import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UserPreferencesStore } from '../core/stores/user-preferences.store';
import { UserService } from '../core/services/user.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  protected prefStore = inject(UserPreferencesStore);
  private userService = inject(UserService);
  private snackBar = inject(MatSnackBar);

  saving = false;

  ngOnInit(): void {
    if (this.prefStore.preferences()) {
      return;
    }
    this.userService.getUser().subscribe({
      next: (res) => {
        this.prefStore.syncFromUser(res.results);
      },
      error: () => {
        this.snackBar.open('Could not load preferences', 'Dismiss', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
      },
    });
  }

  onGenerateImages(ev: MatSlideToggleChange): void {
    this.patch({ generate_images: ev.checked });
  }

  onExtraContext(ev: MatSlideToggleChange): void {
    this.patch({ use_extra_memory_context: ev.checked });
  }

  onDismissPrompt(ev: MatSlideToggleChange): void {
    this.patch({ dismiss_memory_image_prompt: ev.checked });
  }

  private patch(
    partial: {
      generate_images?: boolean;
      use_extra_memory_context?: boolean;
      dismiss_memory_image_prompt?: boolean;
    }
  ): void {
    this.saving = true;
    this.prefStore.updatePartial(
      partial,
      () => {
        this.saving = false;
        this.snackBar.open('Preferences saved', 'Dismiss', { duration: 2500 });
      },
      () => {
        this.saving = false;
        this.snackBar.open('Could not save preferences', 'Dismiss', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
      }
    );
  }
}
