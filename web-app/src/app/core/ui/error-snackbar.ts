import { MatSnackBar } from '@angular/material/snack-bar';

/** Themed error feedback (see `styles.scss` `.error-snackbar`). */
export function showStyledErrorSnackbar(
  snackBar: MatSnackBar,
  message: string,
  durationMs = 6000
): void {
  snackBar.open(message, 'Dismiss', {
    duration: durationMs,
    horizontalPosition: 'center',
    verticalPosition: 'top',
    panelClass: ['error-snackbar'],
  });
}
