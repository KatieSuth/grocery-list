import { addRxPlugin, createRxDatabase, type RxCollection, type RxDatabase } from 'rxdb';
import { RxDBCleanupPlugin } from 'rxdb/plugins/cleanup';
import { disableWarnings, RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { wrappedValidateZSchemaStorage } from 'rxdb/plugins/validate-z-schema';

import type { Item, ListEntry, Store, TripRecord } from '@/domain/types';

import {
  addedOptionalFields,
  itemSchema,
  listEntrySchema,
  settingsMigrations,
  settingsSchema,
  storeSchema,
  tripSchema,
  type SettingsDoc,
} from './schema';
import { getStorageConfig } from './storage';
import type { StorageConfig } from './storage-config';

export type AppCollections = {
  stores: RxCollection<Store>;
  items: RxCollection<Item>;
  listEntries: RxCollection<ListEntry>;
  settings: RxCollection<SettingsDoc>;
  /** The log of finished trips. */
  trips: RxCollection<TripRecord>;
};

export type AppDatabase = RxDatabase<AppCollections>;

export const DATABASE_NAME = 'grocerylist';

// Upgrades documents saved under older schema versions when the database opens.
addRxPlugin(RxDBMigrationSchemaPlugin);
// Purges deleted documents: automatically after a month, or at once when all data is deleted.
addRxPlugin(RxDBCleanupPlugin);

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
    items: { schema: itemSchema, migrationStrategies: addedOptionalFields },
    listEntries: { schema: listEntrySchema, migrationStrategies: addedOptionalFields },
    settings: { schema: settingsSchema, migrationStrategies: settingsMigrations },
    trips: { schema: tripSchema, migrationStrategies: addedOptionalFields },
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
