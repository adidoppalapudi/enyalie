import { useHotkeys, type Hotkeys } from '../hooks/useHotkeys';

export interface KeyAction {
  label: string;
  onAction: () => void;
  /** Keyboard shortcut (see useHotkeys for names), e.g. "n" or "escape". */
  hotkey?: string;
  /** Extra keys that do the same thing, e.g. ["space"] next to "enter". */
  alsoKeys?: string[];
  /** How the key is shown; defaults to the hotkey in capitals. */
  keyLabel?: string;
  disabled?: boolean;
  primary?: boolean;
}

/**
 * The bar at the bottom of every screen: the screen's main actions, each
 * labelled with its keyboard shortcut. On a phone it is a row of buttons
 * within thumb reach; on a laptop it doubles as the shortcut legend.
 */
export function KeyBar({ actions }: { actions: KeyAction[] }) {
  const hotkeys: Hotkeys = {};
  for (const action of actions) {
    if (action.disabled || !action.hotkey) continue;
    for (const key of [action.hotkey, ...(action.alsoKeys ?? [])]) hotkeys[key] = action.onAction;
  }
  useHotkeys(hotkeys);

  if (actions.length === 0) return null;
  return (
    <nav className="keybar" aria-label="Screen actions">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className={action.primary ? 'keybar-action is-primary' : 'keybar-action'}
          onClick={action.onAction}
          disabled={action.disabled}
          aria-keyshortcuts={action.hotkey ? shortcutName(action.hotkey) : undefined}
        >
          {(action.keyLabel ?? action.hotkey) && (
            <kbd className="key-hint">{action.keyLabel ?? action.hotkey?.toUpperCase()}</kbd>
          )}{' '}
          <span>{action.label}</span>
        </button>
      ))}
    </nav>
  );
}

function shortcutName(hotkey: string): string {
  if (hotkey === 'escape') return 'Escape';
  if (hotkey === 'enter') return 'Enter';
  if (hotkey === 'space') return 'Space';
  return hotkey.toUpperCase();
}
