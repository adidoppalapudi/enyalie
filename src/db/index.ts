import type { DataStore } from './DataStore';
import { createIndexedDbStore } from './indexedDbStore';

export type { DataStore } from './DataStore';

/**
 * The app's single data store. The database opens lazily on first use.
 */
export const store: DataStore = createIndexedDbStore();
