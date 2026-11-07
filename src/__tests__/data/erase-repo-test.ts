import { randomToken } from 'rxdb';
import { getLocalStorageMock, getRxStorageLocalstorage } from 'rxdb/plugins/storage-localstorage';

import { deleteAllData } from '@/data/erase-repo';
import { createAppDatabase, type AppDatabase } from '@/db/database';
import { ensureWindowEventListeners } from '@/db/storage.native';
import { closeTestDatabases, createTestDatabase } from '@/test-utils/db';

// Only the shim for window events is needed here, not the SQLite-backed localStorage.
jest.mock('expo-sqlite/localStorage/install', () => ({}));

afterEach(async () => {
  jest.restoreAllMocks();
  await closeTestDatabases();
});

async function seed(db: AppDatabase) {
  await db.settings.insert({ id: 'app', setupComplete: true, tripStoreId: 's1', tripReversed: true });
  await db.stores.insert({ id: 's1', name: 'Shop', departments: [{ id: 'd1', name: 'Deli' }], createdAt: 1 });
  await db.items.insert({ id: 'i1', name: 'Ham', locations: [{ storeId: 's1', departmentId: 'd1' }], createdAt: 1 });
  await db.listEntries.insert({ itemId: 'i1', checkedAt: 2 });
  await db.trips.insert({
    id: 't1',
    storeId: 's1',
    storeName: 'Shop',
    finishedAt: 3,
    items: [{ itemId: 'i1', name: 'Ham', department: 'Deli' }],
  });
}

/** How many of the seeded documents each collection still stores, deleted ones included. */
async function storedCounts(db: AppDatabase) {
  const ids = ['s1', 'i1', 't1'];
  const count = async (name: 'stores' | 'items' | 'listEntries' | 'trips') =>
    (await db[name].storageInstance.findDocumentsById(ids, true)).length;
  return {
    stores: await count('stores'),
    items: await count('items'),
    listEntries: await count('listEntries'),
    trips: await count('trips'),
  };
}

test('deletes everything, purges it from storage, and starts setup again', async () => {
  const db = await createTestDatabase();
  await seed(db);
  expect(await storedCounts(db)).toEqual({ stores: 1, items: 1, listEntries: 1, trips: 1 });

  await deleteAllData(db);

  expect(await db.stores.count().exec()).toBe(0);
  expect(await db.items.count().exec()).toBe(0);
  expect(await db.listEntries.count().exec()).toBe(0);
  expect(await db.trips.count().exec()).toBe(0);
  // Not even tombstones are left.
  expect(await storedCounts(db)).toEqual({ stores: 0, items: 0, listEntries: 0, trips: 0 });
  expect((await db.settings.findOne('app').exec())?.toJSON()).toEqual({ id: 'app', setupComplete: false });
});

test('keeps the light/dark choice', async () => {
  const db = await createTestDatabase();
  await seed(db);
  await (await db.settings.findOne('app').exec())?.incrementalPatch({ colorScheme: 'dark' });

  await deleteAllData(db);

  expect((await db.settings.findOne('app').exec())?.toJSON()).toEqual({
    id: 'app',
    setupComplete: false,
    colorScheme: 'dark',
  });
});

test('works on an empty database', async () => {
  const db = await createTestDatabase();
  await deleteAllData(db);
  expect(await db.settings.count().exec()).toBe(0);
});

test('fails loudly, leaving setup finished, if something could not be deleted', async () => {
  const db = await createTestDatabase();
  await seed(db);
  jest.spyOn(db.items, 'bulkRemove').mockResolvedValueOnce({ success: [], error: [{} as never] });

  await expect(deleteAllData(db)).rejects.toThrow('Could not delete 1 of 1 items');
  expect((await db.settings.findOne('app').exec())?.setupComplete).toBe(true);

  // Trying again finishes the job.
  await deleteAllData(db);
  expect(await db.items.count().exec()).toBe(0);
  expect((await db.settings.findOne('app').exec())?.setupComplete).toBe(false);
});

test('with the app\'s localStorage storage, no copy of deleted data is left in change events', async () => {
  const localStorage = getLocalStorageMock();
  jest.spyOn(globalThis, 'localStorage', 'get').mockReturnValue(localStorage);
  ensureWindowEventListeners(window as never);
  const db = await createAppDatabase(`erase${randomToken(10)}`, { storage: getRxStorageLocalstorage({ localStorage }) });
  try {
    await seed(db);
    const stored = () =>
      Array.from({ length: localStorage.length }, (_, i) => localStorage.getItem(localStorage.key(i) as string)).join();
    expect(stored()).toContain('Ham');

    await deleteAllData(db);

    expect(stored()).not.toContain('Ham');
    expect(stored()).not.toContain('Shop');
  } finally {
    await db.close();
  }
});
