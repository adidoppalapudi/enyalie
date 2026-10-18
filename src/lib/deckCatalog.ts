interface CatalogDeck {
  id?: string;
  name: string;
  description: string;
}

const categoryDecks: Record<string, readonly string[]> = {
  'Mixed trivia': ['deck-trivia-easy', 'deck-trivia-medium', 'deck-trivia-hard', 'deck-trivia-expert'],
  Science: [
    'deck-human-body', 'deck-nature', 'deck-botany', 'deck-oceans-water-bodies',
    'deck-chemistry-foundations', 'deck-ap-chemistry', 'deck-general-chemistry',
    'deck-health-sciences-chemistry', 'deck-organic-chemistry-1', 'deck-organic-chemistry-2',
    'deck-analytical-chemistry', 'deck-inorganic-chemistry', 'deck-fun-chemistry-for-kids',
  ],
  History: ['deck-ap-world-history'],
  Places: ['deck-geography', 'deck-national-parks'],
  'Stories & games': [
    'deck-harry-potter', 'deck-hunger-games', 'deck-marvel-comics',
    'deck-movies', 'deck-pokemon', 'deck-minecraft',
  ],
  Words: ['deck-vocabulary'],
  Sports: ['deck-nba'],
  Other: [],
};

export const DECK_CATEGORIES = Object.keys(categoryDecks);

const categoriesById = new Map(
  Object.entries(categoryDecks).flatMap(([category, ids]) => ids.map((id) => [id, category] as const)),
);

const featuredIds = new Set([
  'deck-trivia-easy', 'deck-human-body', 'deck-chemistry-foundations', 'deck-geography',
  'deck-nba', 'deck-harry-potter', 'deck-minecraft', 'deck-ap-world-history',
]);

export function deckCategory(id?: string): string {
  return (id && categoriesById.get(id)) || 'Other';
}

export function isFeaturedDeck(id?: string): boolean {
  return id !== undefined && featuredIds.has(id);
}

/** Search titles, descriptions and categories without loading any questions. */
export function filterDecks<T extends CatalogDeck>(decks: readonly T[], query: string, category: string): T[] {
  const needle = query.trim().toLowerCase();
  return decks.filter((deck) => {
    const group = deckCategory(deck.id);
    return (
      (!category || group === category) &&
      `${deck.name}\n${deck.description}\n${group}`.toLowerCase().includes(needle)
    );
  });
}
