import type { RxCollection } from 'rxdb';

import { forgetChangeEvents } from '@/db/change-events';
import type { AppDatabase } from '@/db/database';
import { SETTINGS_ID } from '@/db/schema';

/**
 * Deletes every store, item, checked item and logged trip, and resets settings so the app starts
 * setup again. The light/dark choice and the items' default sort are kept: they're how the app
 * looks and behaves, not data about shopping.
 * Deleted documents are then purged from storage rather than left as tombstones.
 */
export async function deleteAllData(db: AppDatabase): Promise<void> {
  await removeAll(db.trips);
  await removeAll(db.listEntries);
  await removeAll(db.items);
  await removeAll(db.stores);

  // Last: this sends the app back to setup, which should open on an empty database.
  const settings = await db.settings.findOne(SETTINGS_ID).exec();
  await settings?.incrementalModify(({ colorScheme, itemSort, itemSortDirection }) => ({
    id: SETTINGS_ID,
    setupComplete: false,
    ...(colorScheme ? { colorScheme } : {}),
    ...(itemSort ? { itemSort } : {}),
    ...(itemSortDirection ? { itemSortDirection } : {}),
  }));

  await Promise.all([db.trips, db.listEntries, db.items, db.stores].map((c) => c.cleanup(0)));
  // The app's storage (localStorage on web, expo-sqlite's version of it on iOS and Android).
  if (db.storage.name.endsWith('localstorage')) forgetChangeEvents(db.name);
}

async function removeAll<T>(collection: RxCollection<T>): Promise<void> {
  const docs = await collection.find().exec();
  const { error } = await collection.bulkRemove(docs);
  if (error.length > 0) {
    throw new Error(`Could not delete ${error.length} of ${docs.length} ${collection.name}`);
  }
}
