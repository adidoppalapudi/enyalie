import { useState, type ReactNode } from 'react';
import { errorMessage } from '../lib/errors';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

/** Asks "are you sure?". Focus starts on Cancel so Enter never deletes by accident. */
export function ConfirmDialog({ title, children, confirmLabel, danger, onConfirm, onCancel }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <div className="window-body">{children}</div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="window-actions">
        <button type="button" className="btn" onClick={onCancel} data-autofocus>
          cancel
        </button>
        <button
          type="button"
          className={danger ? 'btn btn-danger' : 'btn btn-primary'}
          onClick={confirm}
          disabled={busy}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
