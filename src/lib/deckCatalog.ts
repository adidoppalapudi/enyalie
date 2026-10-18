interface CatalogDeck {
  id?: string;
  name: string;
  description: string;
}

const categoryDecks: Record<string, readonly string[]> = {
  'Mixed trivia': ['deck-trivia-easy', 'deck-trivia-medium', 'deck-trivia-hard', 'deck-trivia-expert'],
  Science: [
    'deck-human-body', 'deck-nature', 'deck-botany', 'deck-weather', 'deck-oceans-water-bodies',
    'deck-chemistry-foundations',
  ],
  Technology: ['deck-aws', 'deck-llm-vocabulary', 'sample-postgresql-basics'],
  History: ['deck-us-history', 'deck-texas-history'],
  Places: ['deck-geography', 'deck-national-parks'],
  'Stories & games': [
    'deck-harry-potter', 'deck-hunger-games', 'deck-marvel-comics',
    'deck-movies', 'deck-pokemon', 'deck-minecraft',
  ],
  Words: ['deck-vocabulary', 'deck-spelling'],
  Sports: ['deck-nba'],
  Food: ['deck-chipotle'],
  Other: [],
};

export const DECK_CATEGORIES = Object.keys(categoryDecks);

const categoriesById = new Map(
  Object.entries(categoryDecks).flatMap(([category, ids]) => ids.map((id) => [id, category] as const)),
);

const featuredIds = new Set([
  'deck-trivia-easy', 'deck-human-body', 'deck-chemistry-foundations', 'deck-geography',
  'deck-nba', 'deck-harry-potter', 'deck-minecraft',
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
