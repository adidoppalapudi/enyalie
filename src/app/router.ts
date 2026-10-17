/**
 * A tiny hash router. Screens live at URLs like #/deck/<id>, which work on
 * any static host and give phones a working back button.
 */
import { useMemo, useSyncExternalStore } from 'react';

export type Route =
  | { name: 'library' }
  | { name: 'deck'; deckId: string }
  | { name: 'newQuestion'; deckId: string }
  | { name: 'editQuestion'; deckId: string; questionId: string }
  | { name: 'quiz' }
  | { name: 'results' }
  | { name: 'notFound' };

function decode(part: string): string | null {
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
}

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#/, '').split('/').filter(Boolean).map(decode);
  if (parts.some((part) => part === null)) return { name: 'notFound' };
  const [first, deckId, third, questionId] = parts as string[];

  if (parts.length === 0) return { name: 'library' };
  if (first === 'deck' && deckId) {
    if (parts.length === 2) return { name: 'deck', deckId };
    if (parts.length === 3 && third === 'new') return { name: 'newQuestion', deckId };
    if (parts.length === 4 && third === 'q') return { name: 'editQuestion', deckId, questionId };
  }
  if (parts.length === 1 && first === 'quiz') return { name: 'quiz' };
  if (parts.length === 1 && first === 'results') return { name: 'results' };
  return { name: 'notFound' };
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'library':
    case 'notFound':
      return '#/';
    case 'deck':
      return `#/deck/${encodeURIComponent(route.deckId)}`;
    case 'newQuestion':
      return `#/deck/${encodeURIComponent(route.deckId)}/new`;
    case 'editQuestion':
      return `#/deck/${encodeURIComponent(route.deckId)}/q/${encodeURIComponent(route.questionId)}`;
    case 'quiz':
      return '#/quiz';
    case 'results':
      return '#/results';
  }
}

// Each history entry the app creates records how many app screens are behind
// it, so "go back" can tell whether the previous entry is still inside Rekall.
function depthOf(state: unknown): number {
  if (typeof state === 'object' && state !== null && 'rekallDepth' in state) {
    const depth = (state as { rekallDepth: unknown }).rekallDepth;
    if (typeof depth === 'number') return depth;
  }
  return 0;
}

const listeners = new Set<() => void>();

export function navigate(to: Route, options: { replace?: boolean } = {}): void {
  const hash = routeToHash(to);
  const depth = depthOf(window.history.state);
  if (options.replace) window.history.replaceState({ rekallDepth: depth }, '', hash);
  else window.history.pushState({ rekallDepth: depth + 1 }, '', hash);
  listeners.forEach((listener) => listener());
}

/**
 * Goes back like the browser's back button, unless this screen was opened
 * directly (nothing of ours to go back to), in which case it opens `fallback`.
 */
export function goBack(fallback: Route): void {
  if (depthOf(window.history.state) > 0) window.history.back();
  else navigate(fallback, { replace: true });
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('popstate', onChange);
  window.addEventListener('hashchange', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('popstate', onChange);
    window.removeEventListener('hashchange', onChange);
  };
}

const getHash = () => window.location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash);
  return useMemo(() => parseRoute(hash), [hash]);
}
