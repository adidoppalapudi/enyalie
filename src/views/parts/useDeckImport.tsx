import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useStatus } from '../../app/StatusContext';
import { Modal } from '../../components/Modal';
import { store } from '../../db';
import type { PickedFile } from '../../io/files';
import {
  importDeckFiles,
  summarizeImport,
  type ConflictChoice,
  type DeckConflict,
  type ImportReport,
} from '../../io/importDecks';
import { plural } from '../../lib/format';
import { requestPersistentStorage } from '../../lib/storage';
import type { Deck } from '../../models/types';

const SHOWN_ERRORS = 8;

interface DeckImportOptions {
  /** After importing a single file: usually opens the deck. */
  onImported: (deck: Deck) => void;
  /** After importing several files at once: the library should refresh. */
  onLibraryChanged: () => void;
}

/**
 * Importing deck files: pick one or several, check each, and ask what to do
 * when a deck is already in the library. Several files end with one summary.
 * Render `fileInput` and `dialogs`.
 */
export function useDeckImport({ onImported, onLibraryChanged }: DeckImportOptions) {
  const { notify } = useStatus();
  const inputRef = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<{ source: string; errors: string[] } | null>(null);
  const [conflict, setConflict] = useState<DeckConflict | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const answer = useRef<((choice: ConflictChoice) => void) | null>(null);

  function askAboutConflict(next: DeckConflict): Promise<ConflictChoice> {
    return new Promise((resolve) => {
      answer.current = resolve;
      setConflict(next);
    });
  }

  function resolveConflict(choice: ConflictChoice) {
    answer.current?.(choice);
    answer.current = null;
    setConflict(null);
  }

  /** One file: open the deck on success, or show exactly what went wrong. */
  function showSingleResult(report: ImportReport) {
    const [imported] = report.imported;
    if (imported) {
      notify(`Imported "${imported.deck.name}" (${plural(imported.questionCount, 'question')}).`, 'ok');
      onImported(imported.deck);
      return;
    }
    const [skipped] = report.skipped;
    if (skipped?.kind === 'invalid') setProblems({ source: skipped.source, errors: skipped.problems });
    else if (skipped?.kind === 'error') notify(`Couldn't import "${skipped.source}": ${skipped.message}`, 'error');
    // 'kept-existing' means the person cancelled, so there's nothing to say.
  }

  async function run(files: PickedFile[]) {
    if (files.length === 0) return;
    const report = await importDeckFiles(files, { store, onConflict: askAboutConflict });
    if (report.imported.length > 0) requestPersistentStorage();
    if (files.length === 1) {
      showSingleResult(report);
      return;
    }
    onLibraryChanged();
    // A clean import fits the status line; skipped files get a dialog so the reasons don't vanish.
    if (report.skipped.length === 0) notify(summarizeImport(report), 'ok');
    else setSummary(summarizeImport(report));
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []); // copy before clearing the input empties the list
    event.target.value = ''; // so choosing the same files again still triggers a change
    await run(files);
  }

  const fileInput: ReactNode = (
    <input
      ref={inputRef}
      type="file"
      accept=".json,application/json"
      multiple
      onChange={handleFiles}
      hidden
      aria-hidden="true"
      tabIndex={-1}
    />
  );

  const inBatch = conflict !== null && conflict.total > 1;

  const dialogs: ReactNode = (
    <>
      {problems && (
        <Modal title="can't import this file" onClose={() => setProblems(null)}>
          <div className="window-body">
            <p>{problems.source} has problems, so nothing was imported:</p>
            <ul className="problem-list">
              {problems.errors.slice(0, SHOWN_ERRORS).map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
            {problems.errors.length > SHOWN_ERRORS && (
              <p>…and {plural(problems.errors.length - SHOWN_ERRORS, 'more problem')}.</p>
            )}
          </div>
          <div className="window-actions">
            <button type="button" className="btn btn-primary" onClick={() => setProblems(null)} data-autofocus>
              ok
            </button>
          </div>
        </Modal>
      )}
      {conflict && (
        <Modal
          key={`${conflict.position}:${conflict.source}`}
          title="deck already in library"
          onClose={() => resolveConflict('skip')}
        >
          <div className="window-body">
            {inBatch && (
              <p className="dim">
                file {conflict.position} of {conflict.total}, {conflict.source}
              </p>
            )}
            <p>
              "{conflict.existing.name}" is already in your library. Replace it with the version in this file (
              {plural(conflict.deck.questions.length, 'question')}), or keep both?
            </p>
          </div>
          <div className="window-actions">
            <button type="button" className="btn" onClick={() => resolveConflict('skip')} data-autofocus>
              {inBatch ? 'skip' : 'cancel'}
            </button>
            <button type="button" className="btn" onClick={() => resolveConflict('keep-both')}>
              keep both
            </button>
            <button type="button" className="btn btn-danger" onClick={() => resolveConflict('replace')}>
              replace
            </button>
          </div>
        </Modal>
      )}
      {summary && (
        <Modal title="import finished" onClose={() => setSummary(null)}>
          <div className="window-body">
            <p>{summary}</p>
          </div>
          <div className="window-actions">
            <button type="button" className="btn btn-primary" onClick={() => setSummary(null)} data-autofocus>
              ok
            </button>
          </div>
        </Modal>
      )}
    </>
  );

  return {
    chooseFile: () => inputRef.current?.click(),
    /** Imports files that didn't come from the file picker (the starter decks). */
    importFiles: run,
    fileInput,
    dialogs,
  };
}
