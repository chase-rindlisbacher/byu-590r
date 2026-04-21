import { afterNextRender, Component, HostBinding, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { AuthStore } from '../../core/stores/auth.store';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  clearFormErrors,
  getFieldError,
  setFormErrors,
} from '../../core/utils/form.utils';
import { getHttpErrorMessage } from '../../core/utils/api-error.utils';
import { showStyledErrorSnackbar } from '../../core/ui/error-snackbar';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  loginForm: FormGroup;
  registerForm: FormGroup;
  forgotPasswordForm: FormGroup;

  isLoading = signal(false);
  errorMsg = signal('');
  passwordResetDialog = signal(false);
  registerDialog = signal(false);
  submitForgotPasswordLoading = signal(false);
  registerFormIsLoading = signal(false);
  forgotPasswordAlert = signal<string | null>(null);

  readonly getFieldError = getFieldError;

  /** Optimized WebP (~max 1920px wide); fades in when decoded (see login SCSS). */
  private static readonly LOGIN_BG_URL = '/Peaceful_Background_Journaling.webp';

  private loginBackgroundReady = signal(false);

  @HostBinding('class.login-bg-ready')
  get loginBackgroundReadyClass(): boolean {
    return this.loginBackgroundReady();
  }

  constructor() {
    this.loginForm = this.fb.group({
      email: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(255),
          Validators.email,
        ],
      ],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });

    this.registerForm = this.fb.group(
      {
        name: [
          '',
          [Validators.required, Validators.minLength(3), Validators.maxLength(255)],
        ],
        email: [
          '',
          [
            Validators.required,
            Validators.minLength(3),
            Validators.maxLength(255),
            Validators.email,
          ],
        ],
        password: ['', [Validators.required, Validators.minLength(8)]],
        c_password: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator }
    );

    this.forgotPasswordForm = this.fb.group({
      email: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(255),
          Validators.email,
        ],
      ],
    });

    afterNextRender(() => {
      const img = new Image();
      img.decoding = 'async';
      const done = (): void => this.loginBackgroundReady.set(true);
      img.onload = done;
      img.onerror = done;
      img.src = LoginComponent.LOGIN_BG_URL;
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const cPassword = form.get('c_password');
    if (password && cPassword && password.value !== cPassword.value) {
      cPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  submitLogin(): void {
    if (this.isLoading()) {
      return;
    }
    if (!this.loginForm.valid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMsg.set('');
    clearFormErrors(this.loginForm);
    this.isLoading.set(true);

    this.authService.login(this.loginForm.value).subscribe({
      next: (response) => {
        if (response.results.token) {
          this.authStore.login(response.results);
          this.router.navigate(['/home']);
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        const data = error?.error?.data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          setFormErrors(this.loginForm, data);
        }
        this.errorMsg.set(
          getHttpErrorMessage(error, 'Login failed')
        );
        this.isLoading.set(false);
      },
    });
  }

  openForgotPasswordDialog(): void {
    this.forgotPasswordAlert.set(null);
    clearFormErrors(this.forgotPasswordForm);
    this.passwordResetDialog.set(true);
  }

  openRegisterDialog(): void {
    clearFormErrors(this.registerForm);
    this.registerDialog.set(true);
  }

  submitForgotPassword(): void {
    if (this.submitForgotPasswordLoading()) {
      return;
    }
    if (!this.forgotPasswordForm.valid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.submitForgotPasswordLoading.set(true);
    this.forgotPasswordAlert.set(null);
    clearFormErrors(this.forgotPasswordForm);
    this.authService
      .forgotPassword(this.forgotPasswordForm.value.email)
      .subscribe({
        next: () => {
          this.snackBar.open(
            'Success! Check your email for password reset instructions.',
            'Close',
            {
              duration: 5000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
            }
          );
          this.submitForgotPasswordLoading.set(false);
          this.passwordResetDialog.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.submitForgotPasswordLoading.set(false);
          const data = error?.error?.data as
            | Record<string, string[]>
            | undefined;
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            setFormErrors(this.forgotPasswordForm, data);
          }
          this.forgotPasswordAlert.set(
            getHttpErrorMessage(error, 'Could not process password reset.')
          );
        },
      });
  }

  closeForgotPasswordDialog(): void {
    this.forgotPasswordAlert.set(null);
    this.passwordResetDialog.set(false);
  }

  closeRegisterDialog(): void {
    this.registerDialog.set(false);
  }

  submitRegister(): void {
    if (this.registerFormIsLoading()) {
      return;
    }
    if (!this.registerForm.valid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    clearFormErrors(this.registerForm);
    this.registerFormIsLoading.set(true);
    this.authService.register(this.registerForm.value).subscribe({
      next: () => {
        this.snackBar.open('Success! Registration complete.', 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
        this.registerFormIsLoading.set(false);
        this.registerDialog.set(false);
      },
      error: (error: HttpErrorResponse) => {
        const data = error?.error?.data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          setFormErrors(this.registerForm, data);
        }
        showStyledErrorSnackbar(
          this.snackBar,
          getHttpErrorMessage(error, 'Registration failed.')
        );
        this.registerFormIsLoading.set(false);
      },
    });
  }
}
