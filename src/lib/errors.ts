import type { FieldError, ValidationResult } from '../models/validation';

/** Thrown when data fails validation. `errors` says which fields and why. */
export class ValidationError extends Error {
  readonly errors: FieldError[];

  constructor(errors: FieldError[]) {
    super(errors.map((error) => error.message).join(' ') || 'Invalid data.');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/** Thrown when a deck or question no longer exists (for example, deleted in another tab). */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** Returns the value of a successful validation, or throws a ValidationError. */
export function unwrap<T>(result: ValidationResult<T>): T {
  if (!result.ok) throw new ValidationError(result.errors);
  return result.value;
}

/** Turns anything that was thrown into a message fit to show on screen. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'Something went wrong.';
}
