import { FormGroup } from '@angular/forms';

export function setFormErrors(
  form: FormGroup,
  errors: { [key: string]: string[] }
): void {
  Object.keys(errors).forEach((key) => {
    const control = form.get(key);
    if (control) {
      const errorMessage = Array.isArray(errors[key])
        ? errors[key][0]
        : errors[key];
      control.setErrors({ serverError: errorMessage });
      control.markAsTouched();
    }
  });
}

export function clearFormErrors(form: FormGroup): void {
  Object.keys(form.controls).forEach((key) => {
    const control = form.get(key);
    if (control) {
      const errors = control.errors;
      if (errors && errors['serverError']) {
        delete errors['serverError'];
        control.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
    }
  });
}

function humanizeFieldName(fieldName: string): string {
  return fieldName.replace(/_/g, ' ');
}

const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  journal_entry: 'Journal entry',
  location_id: 'Location',
  c_password: 'Password confirmation',
};

function fieldLabel(fieldName: string): string {
  return FIELD_LABEL_OVERRIDES[fieldName] ?? humanizeFieldName(fieldName);
}

export function getFieldError(
  form: FormGroup,
  fieldName: string
): string | null {
  const control = form.get(fieldName);
  if (!control?.errors) {
    return null;
  }
  const label = fieldLabel(fieldName);

  if (control.errors['serverError']) {
    return control.errors['serverError'];
  }

  if (!control.touched) {
    return null;
  }

  if (control.errors['required']) {
    return `${label} is required`;
  }
  if (control.errors['email']) {
    return `Enter a valid email address`;
  }
  if (control.errors['minlength']) {
    const req = control.errors['minlength'].requiredLength;
    return `${label} must be at least ${req} characters`;
  }
  if (control.errors['maxlength']) {
    const req = control.errors['maxlength'].requiredLength;
    return `${label} must be at most ${req} characters`;
  }
  if (control.errors['min']) {
    return `${label} must be at least ${control.errors['min'].min}`;
  }
  if (control.errors['max']) {
    return `${label} must be at most ${control.errors['max'].max}`;
  }
  if (control.errors['pattern']) {
    return `${label} has an invalid format`;
  }
  if (control.errors['passwordMismatch']) {
    return `Password confirmation does not match`;
  }

  return null;
}
