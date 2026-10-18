import { useId } from 'react';
import { DECK_CATEGORIES } from '../lib/deckCatalog';

interface DeckFiltersProps {
  query: string;
  category: string;
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  focusSearch?: boolean;
}

export function DeckFilters({ query, category, onQueryChange, onCategoryChange, focusSearch }: DeckFiltersProps) {
  const id = useId();
  return (
    <div className="deck-filters">
      <div>
        <label className="field-label" htmlFor={`${id}-search`}>
          search decks
        </label>
        <input
          id={`${id}-search`}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Name, topic or keyword"
          autoComplete="off"
          data-autofocus={focusSearch || undefined}
        />
      </div>
      <div>
        <label className="field-label" htmlFor={`${id}-category`}>
          category
        </label>
        <select id={`${id}-category`} value={category} onChange={(event) => onCategoryChange(event.target.value)}>
          <option value="">All categories</option>
          {DECK_CATEGORIES.map((group) => (
            <option key={group} value={group}>{group}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
