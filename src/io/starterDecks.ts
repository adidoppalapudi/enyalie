/**
 * The decks that ship with Enyalië (src/starter-decks/*.enyalie.json).
 * Each file is bundled as a separate asset and only downloaded when the
 * starter deck list is opened, so they add nothing to the app's start-up.
 * To add one, drop a deck file into that folder.
 */
import type { ImportedDeck } from '../models/types';
import { parseDeckFile } from './deckFile';
import type { PickedFile } from './files';

const urls = import.meta.glob<string>('../starter-decks/*.enyalie.json', {
  query: '?url',
  import: 'default',
  eager: true,
});

export interface StarterDeck {
  file: PickedFile;
  deck: ImportedDeck;
}

async function fetchStarterDeck(path: string, url: string): Promise<StarterDeck> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`the server answered ${response.status}`);
  const text = await response.text();
  const parsed = parseDeckFile(text);
  if (!parsed.ok) throw new Error(`${path} is not a valid deck: ${parsed.errors[0].message}`);
  const name = path.split('/').pop() ?? path;
  return { file: { name, size: text.length, text: async () => text }, deck: parsed.value };
}

/** Downloads and checks every starter deck, sorted by deck name. */
export async function loadStarterDecks(): Promise<StarterDeck[]> {
  const decks = await Promise.all(Object.entries(urls).map(([path, url]) => fetchStarterDeck(path, url)));
  return decks.sort((a, b) => a.deck.name.localeCompare(b.deck.name));
}
