import { getRxStorageLocalstorage } from 'rxdb/plugins/storage-localstorage';

import type { StorageConfig } from './storage-config';

/** Web: the browser's own localStorage and crypto.subtle are available. */
export function getStorageConfig(): StorageConfig {
  return { storage: getRxStorageLocalstorage() };
}
