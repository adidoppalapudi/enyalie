import type { DataStore } from './DataStore';
import { createIndexedDbStore } from './indexedDbStore';

export type { DataStore } from './DataStore';

/**
 * The app's single data store. The database opens lazily on first use.
 * To add a server later, swap this for an implementation that calls your API.
 */
export const store: DataStore = createIndexedDbStore();
