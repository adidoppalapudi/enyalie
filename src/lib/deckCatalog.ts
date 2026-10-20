interface CatalogDeck {
  id?: string;
  name: string;
  description: string;
}

// Also lists decks that are no longer starter decks (deck-geography, deck-hunger-games,
// deck-marvel-comics, deck-minecraft, deck-pokemon, deck-recent-general-knowledge),
// so copies already in someone's library keep their category.
const categoryDecks: Record<string, readonly string[]> = {
  'Mixed trivia': ['deck-trivia-easy', 'deck-trivia-medium', 'deck-trivia-hard', 'deck-trivia-expert'],
  'General knowledge': ['deck-world-facts', 'deck-recent-general-knowledge'],
  Science: [
    'deck-human-body', 'deck-nature', 'deck-botany', 'deck-oceans-water-bodies', 'deck-ap-environmental-science',
    'deck-chemistry-foundations', 'deck-ap-chemistry', 'deck-general-chemistry',
    'deck-health-sciences-chemistry', 'deck-organic-chemistry-1', 'deck-organic-chemistry-2',
    'deck-analytical-chemistry', 'deck-inorganic-chemistry', 'deck-fun-chemistry-for-kids',
  ],
  History: ['deck-ap-world-history'],
  Places: ['deck-world-geography', 'deck-geography', 'deck-national-parks'],
  'Stories & games': [
    'deck-harry-potter', 'deck-movies',
    'deck-pokemon', 'deck-minecraft', 'deck-hunger-games', 'deck-marvel-comics',
  ],
  Words: ['deck-vocabulary'],
  Languages: [
    'deck-german-foundations', 'deck-german-a1-part-1', 'deck-german-a1-part-2',
    'deck-german-a2-part-1', 'deck-german-a2-part-2',
    'deck-german-b1-part-1', 'deck-german-b1-part-2',
    'deck-german-b2-part-1', 'deck-german-b2-part-2',
    'deck-german-c1-part-1', 'deck-german-c1-part-2', 'deck-german-c2',
    'deck-german-review',
  ],
  Sports: ['deck-nba'],
  Other: [],
};

export const DECK_CATEGORIES = Object.keys(categoryDecks);

const categoriesById = new Map(
  Object.entries(categoryDecks).flatMap(([category, ids]) => ids.map((id) => [id, category] as const)),
);

const featuredIds = new Set([
  'deck-trivia-easy', 'deck-human-body', 'deck-chemistry-foundations', 'deck-world-geography',
  'deck-nba', 'deck-harry-potter', 'deck-fun-chemistry-for-kids', 'deck-ap-world-history',
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
