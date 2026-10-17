import { useId, useState, type FormEvent } from 'react';
import { errorMessage } from '../lib/errors';
import type { DeckInput } from '../models/types';
import { LIMITS, validateDeckInput } from '../models/validation';
import { errorsByField, Field } from './Field';
import { Modal } from './Modal';

interface DeckFormDialogProps {
  title: string;
  submitLabel: string;
  initial?: DeckInput;
  onSubmit: (input: DeckInput) => Promise<void>;
  onCancel: () => void;
}

/** Name and description of a deck, for creating or editing one. */
export function DeckFormDialog({ title, submitLabel, initial, onSubmit, onCancel }: DeckFormDialogProps) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateDeckInput({ name, description });
    if (!result.ok) {
      setErrors(errorsByField(result.errors));
      return;
    }
    setBusy(true);
    try {
      await onSubmit(result.value);
    } catch (failure) {
      setErrors({ form: errorMessage(failure) });
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <form onSubmit={handleSubmit} noValidate>
        <Field label="name" htmlFor={`${id}-name`} error={errors.name}>
          <input
            id={`${id}-name`}
            type="text"
            value={name}
            maxLength={LIMITS.deckName}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={errors.name ? true : undefined}
            autoComplete="off"
            data-autofocus
          />
        </Field>
        <Field label="description (optional)" htmlFor={`${id}-description`} error={errors.description}>
          <textarea
            id={`${id}-description`}
            value={description}
            rows={3}
            maxLength={LIMITS.deckDescription}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="window-actions">
          <button type="button" className="btn" onClick={onCancel}>
            cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
