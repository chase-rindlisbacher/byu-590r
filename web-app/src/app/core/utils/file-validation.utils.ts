/** Matches Laravel `max:10240` (kilobytes) on image uploads — 10MB. */
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Returns an error message if the file is not acceptable for image upload, or null if OK.
 */
export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Please choose an image file.';
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return 'Each image must be 10MB or smaller.';
  }
  return null;
}

/**
 * Validates every file; returns first error message or null if all OK.
 */
export function validateImageFiles(files: File[]): string | null {
  for (const f of files) {
    const err = validateImageFile(f);
    if (err) {
      return err;
    }
  }
  return null;
}
