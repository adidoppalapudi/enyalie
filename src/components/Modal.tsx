import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from 'react';

interface ModalProps {
  title: string;
  /** Called when the dialog is dismissed with Esc (or closed by the browser). */
  onClose: () => void;
  children: ReactNode;
}

/**
 * A modal dialog built on the native <dialog> element, which traps focus and
 * handles the Esc key. Render it only while it should be open; unmounting it
 * closes it. Mark the element that should get focus first with `data-autofocus`.
 */
export function Modal({ title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault(); // the parent closes it by unmounting
    onClose();
  }

  function handleClose() {
    // Only react if the browser really closed it (not a stale event).
    if (!ref.current?.open) onClose();
  }

  return (
    <dialog ref={ref} className="window" aria-labelledby={titleId} onCancel={handleCancel} onClose={handleClose}>
      <h2 id={titleId} className="window-title">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
