import type { ReactNode } from 'react';
import type { FieldError } from '../models/validation';

interface FieldProps {
  label: string;
  /** id of the input inside, so the label is linked to it. */
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}

/** A labelled form field with an optional hint and an error message. */
export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className={error ? 'field has-error' : 'field'}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && (
        <p className="field-error" id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** The first error for each field, keyed by field name. */
export function errorsByField(errors: readonly FieldError[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const error of errors) {
    if (!(error.field in result)) result[error.field] = error.message;
  }
  return result;
}
