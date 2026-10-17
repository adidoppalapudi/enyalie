import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import type { PickedFile } from '../../io/files';
import { loadStarterDecks, type StarterDeck } from '../../io/starterDecks';
import { errorMessage } from '../../lib/errors';
import { plural } from '../../lib/format';

interface StarterDecksDialogProps {
  /** Ids of decks already in the library; those start unticked. */
  libraryIds: ReadonlySet<string>;
  onAdd: (files: PickedFile[]) => void;
  onClose: () => void;
}

/** Lists the decks that ship with Rekall and adds the ticked ones to the library. */
export function StarterDecksDialog({ libraryIds, onAdd, onClose }: StarterDecksDialogProps) {
  const [decks, setDecks] = useState<StarterDeck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let current = true;
    loadStarterDecks().then(
      (loaded) => {
        if (!current) return;
        setDecks(loaded);
        const notInLibrary = loaded.filter(({ deck }) => !deck.id || !libraryIds.has(deck.id));
        setPicked(new Set(notInLibrary.map(({ file }) => file.name)));
      },
      (failure: unknown) => current && setError(errorMessage(failure)),
    );
    return () => {
      current = false;
    };
    // Loaded once per opening; the library doesn't change while this is open.
  }, []);

  function toggle(name: string) {
    const next = new Set(picked);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setPicked(next);
  }

  const chosen = decks?.filter(({ file }) => picked.has(file.name)) ?? [];

  return (
    <Modal title="starter decks" onClose={onClose}>
      <div className="window-body">
        {error && (
          <p className="form-error" role="alert">
            Couldn't load the starter decks: {error}
          </p>
        )}
        {!decks && !error && <p>loading…</p>}
        {decks && (
          <ul className="starter-list">
            {decks.map(({ file, deck }) => (
              <li key={file.name}>
                <label className="toggle toggle-check">
                  <input type="checkbox" checked={picked.has(file.name)} onChange={() => toggle(file.name)} />
                  <span>
                    {deck.name} <span className="count">{deck.questions.length}</span>
                    {deck.id && libraryIds.has(deck.id) && <span className="count"> (in library)</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="window-actions">
        <button type="button" className="btn" onClick={onClose} data-autofocus>
          cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={chosen.length === 0}
          onClick={() => onAdd(chosen.map(({ file }) => file))}
        >
          add {plural(chosen.length, 'deck')}
        </button>
      </div>
    </Modal>
  );
}
