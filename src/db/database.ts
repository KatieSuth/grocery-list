import { addRxPlugin, createRxDatabase, type RxCollection, type RxDatabase } from 'rxdb';
import { disableWarnings, RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { wrappedValidateZSchemaStorage } from 'rxdb/plugins/validate-z-schema';

import type { Item, ListEntry, Store } from '@/domain/types';

import { itemSchema, listEntrySchema, settingsSchema, storeSchema, type SettingsDoc } from './schema';
import { getStorageConfig } from './storage';
import type { StorageConfig } from './storage-config';

export type AppCollections = {
  stores: RxCollection<Store>;
  items: RxCollection<Item>;
  listEntries: RxCollection<ListEntry>;
  settings: RxCollection<SettingsDoc>;
};

export type AppDatabase = RxDatabase<AppCollections>;

export const DATABASE_NAME = 'grocerylist';

if (__DEV__) {
  disableWarnings();
  addRxPlugin(RxDBDevModePlugin);
}

export async function createAppDatabase(
  name: string,
  { storage, hashFunction }: StorageConfig,
): Promise<AppDatabase> {
  const db = await createRxDatabase<AppCollections>({
    name,
    // Validate documents against the schema while developing; skipped in production for speed.
    storage: __DEV__ ? wrappedValidateZSchemaStorage({ storage }) : storage,
    hashFunction,
    // A mobile app has a single JS context, so cross-tab coordination is unnecessary.
    multiInstance: false,
  });
  await db.addCollections({
    stores: { schema: storeSchema },
    items: { schema: itemSchema },
    listEntries: { schema: listEntrySchema },
    settings: { schema: settingsSchema },
  });
  return db;
}

let instance: Promise<AppDatabase> | null = null;

/** The app-wide database, created on first use. */
export function getAppDatabase(): Promise<AppDatabase> {
  if (!instance) {
    instance = Promise.resolve()
      .then(() => createAppDatabase(DATABASE_NAME, getStorageConfig()))
      .catch((error: unknown) => {
        // Allow a later retry instead of caching the failure.
        instance = null;
        throw error;
      });
  }
  return instance;
}
