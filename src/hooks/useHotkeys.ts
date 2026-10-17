import { useEffect, useRef } from 'react';

/** Map of key names to handlers, e.g. { n: newDeck, escape: quit, '1': pickFirst }. */
export type Hotkeys = Record<string, () => void>;

/** Normalised key name: letters lower-case, ' ' → "space", "Enter" → "enter". */
function keyName(event: KeyboardEvent): string {
  return event.key === ' ' ? 'space' : event.key.toLowerCase();
}

const TYPING_TARGETS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const CLICKABLE_TARGETS = 'button, a[href], summary, input, select, textarea';

/**
 * Binds single-key shortcuts while the component is mounted.
 * Shortcuts are ignored while typing in a field, while a dialog is open, and
 * when a modifier key (Ctrl, Alt, Cmd) is held. Enter and Space are left to
 * the focused button or link, so a key press never triggers two things.
 */
export function useHotkeys(hotkeys: Hotkeys): void {
  const latest = useRef(hotkeys);
  useEffect(() => {
    latest.current = hotkeys;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(TYPING_TARGETS)) return;
      if (document.querySelector('dialog[open]')) return;
      const key = keyName(event);
      if ((key === 'enter' || key === 'space') && target?.closest(CLICKABLE_TARGETS)) return;
      const handler = latest.current[key];
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
