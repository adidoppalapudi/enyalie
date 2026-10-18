/**
 * Importing deck files into the library, one file or many at a time.
 *
 * Files are handled one after another, in name order, so a deck that is
 * already in the library can be settled (replace, keep both or skip) before
 * the next file is looked at. A file that can't be read or isn't a valid deck
 * is skipped and reported at the end; it never stops the others.
 */
import type { DataStore } from '../db/DataStore';
import { errorMessage } from '../lib/errors';
import { plural } from '../lib/format';
import type { Deck, ImportedDeck } from '../models/types';
import { nameWithSuffix } from '../models/validation';
import { parseDeckFile } from './deckFile';
import { readTextFile, type PickedFile } from './files';

/** What to do with a deck whose id is already in the library. */
export type ConflictChoice = 'replace' | 'keep-both' | 'skip';

export interface DeckConflict {
  /** The deck as read from the file. */
  deck: ImportedDeck;
  /** The library's copy with the same id. */
  existing: Deck;
  /** The file's name. */
  source: string;
  /** This file's place in the batch (1-based) and the batch size. */
  position: number;
  total: number;
}

type SkippedFile =
  /** Not a valid deck file; `problems` lists everything wrong with it. */
  | { source: string; kind: 'invalid'; problems: string[] }
  /** Couldn't be read or saved. */
  | { source: string; kind: 'error'; message: string }
  /** Its deck is already in the library and the user chose to keep that copy. */
  | { source: string; kind: 'kept-existing' };

export interface ImportReport {
  imported: { source: string; deck: Deck; questionCount: number }[];
  skipped: SkippedFile[];
}

interface ImportOptions {
  store: Pick<DataStore, 'getDeck' | 'importDeck'>;
  /** Asked once for each deck that is already in the library. */
  onConflict: (conflict: DeckConflict) => Promise<ConflictChoice>;
}

/** "geography.enyalie.json" before "us-history.enyalie.json", and "deck 2" before "deck 10". */
function byName(a: PickedFile, b: PickedFile): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

/** Imports each file that holds a valid deck, and reports what happened to every file. */
export async function importDeckFiles(files: readonly PickedFile[], { store, onConflict }: ImportOptions) {
  const ordered = [...files].sort(byName);
  const report: ImportReport = { imported: [], skipped: [] };

  for (const [index, file] of ordered.entries()) {
    const source = file.name;
    try {
      const parsed = parseDeckFile(await readTextFile(file));
      if (!parsed.ok) {
        report.skipped.push({ source, kind: 'invalid', problems: parsed.errors.map((error) => error.message) });
        continue;
      }
      const deck = parsed.value;
      const existing = deck.id ? await store.getDeck(deck.id) : undefined;
      const choice = existing
        ? await onConflict({ deck, existing, source, position: index + 1, total: ordered.length })
        : 'replace'; // nothing to replace, so this saves it with the file's id
      if (choice === 'skip') {
        report.skipped.push({ source, kind: 'kept-existing' });
        continue;
      }
      const asNewDeck = choice === 'keep-both';
      const toSave = asNewDeck ? { ...deck, name: nameWithSuffix(deck.name, ' (imported)') } : deck;
      const saved = await store.importDeck(toSave, { asNewDeck });
      report.imported.push({ source, deck: saved, questionCount: deck.questions.length });
    } catch (error) {
      report.skipped.push({ source, kind: 'error', message: errorMessage(error) });
    }
  }
  return report;
}

const withoutFinalPeriod = (text: string) => text.replace(/\.$/, '');

function skipReason(file: SkippedFile): string {
  switch (file.kind) {
    case 'invalid': {
      const [first = 'Not a valid deck file.', ...rest] = file.problems;
      const more = rest.length > 0 ? `, and ${plural(rest.length, 'more problem')}` : '';
      return withoutFinalPeriod(first) + more;
    }
    case 'error':
      return withoutFinalPeriod(file.message);
    case 'kept-existing':
      return 'you kept the copy already in your library';
  }
}

/** For example "Imported 9 decks. Skipped 1: geography.enyalie.json (Question 4: Prompt is required)." */
export function summarizeImport(report: ImportReport): string {
  const count = report.imported.length;
  const imported = count > 0 ? `Imported ${plural(count, 'deck')}.` : 'No decks were imported.';
  if (report.skipped.length === 0) return imported;
  const skipped = report.skipped.map((file) => `${file.source} (${skipReason(file)})`).join('; ');
  return `${imported} Skipped ${report.skipped.length}: ${skipped}.`;
}
