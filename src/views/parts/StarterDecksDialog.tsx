import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { DeckFilters } from '../../components/DeckFilters';
import type { PickedFile } from '../../io/files';
import { loadStarterDecks, type StarterDeck } from '../../io/starterDecks';
import { errorMessage } from '../../lib/errors';
import { plural } from '../../lib/format';
import { deckCategory, filterDecks, isFeaturedDeck } from '../../lib/deckCatalog';

interface StarterDecksDialogProps {
  /** Used to label decks already in the library. */
  libraryIds: ReadonlySet<string>;
  onAdd: (files: PickedFile[]) => void;
  onClose: () => void;
}

/** Lists the decks that ship with Enyalië and adds the ticked ones to the library. */
export function StarterDecksDialog({ libraryIds, onAdd, onClose }: StarterDecksDialogProps) {
  const [decks, setDecks] = useState<StarterDeck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    let current = true;
    loadStarterDecks().then(
      (loaded) => {
        if (!current) return;
        setDecks(loaded);
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
  const matching = new Set(filterDecks((decks ?? []).map(({ deck }) => deck), query, category));
  const shown = decks?.filter(({ deck }) => matching.has(deck)) ?? [];
  const browsing = !query.trim() && !category;
  const groups: [string, StarterDeck[]][] = browsing
    ? [
        ['Start here', shown.filter(({ deck }) => isFeaturedDeck(deck.id))],
        ['More decks', shown.filter(({ deck }) => !isFeaturedDeck(deck.id))],
      ]
    : [['Matching decks', shown]];

  return (
    <Modal title="starter decks" onClose={onClose}>
      <div className="window-body starter-browser">
        <DeckFilters
          query={query}
          category={category}
          onQueryChange={setQuery}
          onCategoryChange={setCategory}
          focusSearch
        />
        {error && (
          <p className="form-error" role="alert">
            Couldn't load the starter decks: {error}
          </p>
        )}
        {!decks && !error && <p>loading…</p>}
        {decks && (
          <>
            <p className="starter-selection">
              {plural(shown.length, 'deck')} · {chosen.length} selected
              <button
                type="button"
                className="btn btn-quiet"
                disabled={shown.length === 0}
                onClick={() => setPicked(new Set([...picked, ...shown.map(({ file }) => file.name)]))}
              >
                select shown
              </button>
              {picked.size > 0 && (
                <button type="button" className="btn btn-quiet" onClick={() => setPicked(new Set())}>
                  clear selection
                </button>
              )}
            </p>
            {shown.length === 0 && <p>No decks match. Try another search or category.</p>}
            {groups.filter(([, items]) => items.length > 0).map(([title, items]) => (
              <section key={title} className="starter-group" aria-label={title}>
                <h3>{title}</h3>
                <ul className="starter-list">
                  {items.map(({ file, deck }) => (
                    <li key={file.name}>
                      <label className="toggle toggle-check">
                        <input type="checkbox" checked={picked.has(file.name)} onChange={() => toggle(file.name)} />
                        <span className="starter-info">
                          <strong>{deck.name}</strong>
                          <span>{deck.description}</span>
                          <span>
                            {deckCategory(deck.id)} · {plural(deck.questions.length, 'question')}
                            {deck.id && libraryIds.has(deck.id) && ' · in library'}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
      <div className="window-actions">
        <button type="button" className="btn" onClick={onClose}>
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
