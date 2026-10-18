/**
 * Colour palettes. Each one is a :root[data-palette] block in styles.css;
 * "classic" is the default with no attribute. index.html applies the saved
 * palette before the first paint so the page never flashes the wrong colours.
 */
const PALETTES = ['classic', 'sycamore', 'cloud'] as const;
const STORAGE_KEY = 'enyalie.palette';

/** Matches the phone's browser bar to the title bar. */
export function syncThemeColor(): void {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  if (accent) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', accent);
}

/** Switches to the next palette, remembers it, and returns its name. */
export function cyclePalette(): string {
  const root = document.documentElement;
  const current = PALETTES.indexOf((root.dataset.palette ?? 'classic') as (typeof PALETTES)[number]);
  const next = PALETTES[(current + 1) % PALETTES.length];
  if (next === 'classic') delete root.dataset.palette;
  else root.dataset.palette = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // The choice just won't be remembered.
  }
  syncThemeColor();
  return next;
}
