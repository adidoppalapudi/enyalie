import { describe, expect, it } from 'vitest';
import { depthOf, parseRoute, routeToHash, type Route } from '../src/app/router';

describe('router', () => {
  it('round-trips every screen through its URL', () => {
    const routes: Route[] = [
      { name: 'library' },
      { name: 'deck', deckId: 'abc-123' },
      { name: 'newQuestion', deckId: 'abc-123' },
      { name: 'editQuestion', deckId: 'abc-123', questionId: 'q 1/2' },
      { name: 'quiz' },
      { name: 'results' },
    ];
    for (const route of routes) expect(parseRoute(routeToHash(route))).toEqual(route);
  });

  it('treats an empty hash as the library', () => {
    expect(parseRoute('')).toEqual({ name: 'library' });
    expect(parseRoute('#/')).toEqual({ name: 'library' });
  });

  it('reports unknown or malformed addresses', () => {
    expect(parseRoute('#/nope')).toEqual({ name: 'notFound' });
    expect(parseRoute('#/deck/abc/extra/parts/here')).toEqual({ name: 'notFound' });
    expect(parseRoute('#/deck/%E0%A4%A')).toEqual({ name: 'notFound' });
  });

  it('reads legacy history depth and prefers the new history key', () => {
    expect(depthOf({ rekallDepth: 3 })).toBe(3);
    expect(depthOf({ enyalieDepth: 4 })).toBe(4);
    expect(depthOf({ enyalieDepth: 4, rekallDepth: 3 })).toBe(4);
  });
});
