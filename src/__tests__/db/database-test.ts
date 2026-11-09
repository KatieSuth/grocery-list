import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';

import { getAppDatabase } from '@/db/database';
import { getStorageConfig } from '@/db/storage';
import { closeTestDatabases, createTestDatabase } from '@/test-utils/db';

jest.mock('@/db/storage', () => ({ getStorageConfig: jest.fn() }));

afterEach(closeTestDatabases);

test('getAppDatabase opens one shared database, retrying after a failure', async () => {
  jest
    .mocked(getStorageConfig)
    .mockImplementationOnce(() => {
      throw new Error('no storage');
    })
    .mockReturnValue({ storage: getRxStorageMemory() });

  await expect(getAppDatabase()).rejects.toThrow('no storage');

  const first = getAppDatabase();
  expect(getAppDatabase()).toBe(first);
  const db = await first;
  expect(db.name).toBe('grocerylist');
  expect(Object.keys(db.collections).sort()).toEqual(['items', 'listEntries', 'settings', 'stores', 'trips']);
  await db.close();
});

test('documents are validated against the schema in development', async () => {
  const db = await createTestDatabase();
  await expect(
    // @ts-expect-error deliberately invalid document
    db.stores.insert({ id: 'x', name: 42, departments: [], createdAt: 1 }),
  ).rejects.toThrow();
});

/** An older version of a schema, from before `fields` were added. */
function olderVersion(schema: { properties: Record<string, unknown> }, version: number, fields: string[]) {
  const properties = Object.fromEntries(Object.entries(schema.properties).filter(([key]) => !fields.includes(key)));
  return { ...schema, version, properties };
}

const version0 = (schema: { properties: Record<string, unknown> }, fields: string[]) => olderVersion(schema, 0, fields);
const keep = (doc: unknown) => doc;

/** Opens a database with the given (old) collections, using the app's dev-mode validation. */
async function openOldDatabase(
  name: string,
  storage: unknown,
  collections: Record<string, { schema: unknown; migrationStrategies?: Record<number, (doc: unknown) => unknown> }>,
) {
  const { createRxDatabase } = jest.requireActual('rxdb');
  const { wrappedValidateZSchemaStorage } = jest.requireActual('rxdb/plugins/validate-z-schema');
  const old = await createRxDatabase({ name, storage: wrappedValidateZSchemaStorage({ storage }), multiInstance: false });
  await old.addCollections(collections);
  return old;
}

test('a database created before list entries existed still opens and keeps its data', async () => {
  const { itemSchema, settingsSchema, storeSchema } = jest.requireActual('@/db/schema');
  const { createAppDatabase } = jest.requireActual('@/db/database');
  const storage = getRxStorageMemory();

  // The pre-tabs app: no listEntries collection.
  const old = await openOldDatabase('upgrade', storage, {
    stores: { schema: storeSchema },
    items: { schema: version0(itemSchema, ['lastBoughtAt']) },
    settings: { schema: version0(settingsSchema, ['tripStoreId', 'tripReversed', 'colorScheme']) },
  });
  await old.items.insert({ id: 'i1', name: 'Milk', locations: [], createdAt: 1 });
  await old.close();

  const db = await createAppDatabase('upgrade', { storage });
  expect((await db.items.findOne('i1').exec())?.name).toBe('Milk');
  expect(await db.listEntries.count().exec()).toBe(0);
  await db.close();
});

test('a database from before shopping trips is migrated, keeping its data', async () => {
  const { itemSchema, listEntrySchema, settingsSchema, storeSchema } = jest.requireActual('@/db/schema');
  const { createAppDatabase } = jest.requireActual('@/db/database');
  const storage = getRxStorageMemory();

  const old = await openOldDatabase('pretrip', storage, {
    stores: { schema: storeSchema },
    items: { schema: version0(itemSchema, ['lastBoughtAt']) },
    listEntries: { schema: version0(listEntrySchema, ['inCartAt']) },
    settings: { schema: version0(settingsSchema, ['tripStoreId', 'tripReversed', 'colorScheme']) },
  });
  await old.items.insert({ id: 'i1', name: 'Milk', brand: 'Acme', locations: [], createdAt: 1 });
  await old.listEntries.insert({ itemId: 'i1', quantity: '2', checkedAt: 5 });
  await old.settings.insert({ id: 'app', setupComplete: true });
  await old.close();

  const db = await createAppDatabase('pretrip', { storage });
  expect((await db.items.findOne('i1').exec())?.toJSON()).toMatchObject({ name: 'Milk', brand: 'Acme' });
  expect((await db.listEntries.findOne('i1').exec())?.toJSON()).toMatchObject({ quantity: '2', checkedAt: 5 });
  expect((await db.settings.findOne('app').exec())?.setupComplete).toBe(true);
  // The new fields can be used straight away.
  await (await db.items.findOne('i1').exec())?.incrementalPatch({ lastBoughtAt: 9 });
  expect((await db.items.findOne('i1').exec())?.lastBoughtAt).toBe(9);
  expect(await db.trips.count().exec()).toBe(0);
  await db.close();
});

test('a trip log from before pending trips is migrated', async () => {
  const { itemSchema, listEntrySchema, settingsSchema, storeSchema, tripSchema } = jest.requireActual('@/db/schema');
  const { createAppDatabase } = jest.requireActual('@/db/database');
  const storage = getRxStorageMemory();

  const old = await openOldDatabase('pendingtrips', storage, {
    stores: { schema: storeSchema },
    items: { schema: itemSchema, migrationStrategies: { 1: keep } },
    listEntries: { schema: listEntrySchema, migrationStrategies: { 1: keep } },
    settings: { schema: olderVersion(settingsSchema, 1, ['colorScheme']), migrationStrategies: { 1: keep } },
    trips: { schema: version0(tripSchema, ['pending']) },
  });
  const trip = { id: 't1', storeId: 's1', storeName: 'Shop', finishedAt: 5, items: [{ itemId: 'i1', name: 'Milk', department: 'Deli' }] };
  await old.trips.insert(trip);
  await old.close();

  const db = await createAppDatabase('pendingtrips', { storage });
  expect((await db.trips.findOne('t1').exec())?.toJSON()).toEqual(trip);
  await db.close();
});

test('settings from before the appearance choice are migrated, keeping the trip settings', async () => {
  const { itemSchema, listEntrySchema, settingsSchema, storeSchema, tripSchema } = jest.requireActual('@/db/schema');
  const { createAppDatabase } = jest.requireActual('@/db/database');
  const storage = getRxStorageMemory();

  const old = await openOldDatabase('precolorscheme', storage, {
    stores: { schema: storeSchema },
    items: { schema: itemSchema, migrationStrategies: { 1: keep } },
    listEntries: { schema: listEntrySchema, migrationStrategies: { 1: keep } },
    settings: { schema: olderVersion(settingsSchema, 1, ['colorScheme']), migrationStrategies: { 1: keep } },
    trips: { schema: tripSchema, migrationStrategies: { 1: keep } },
  });
  const settings = { id: 'app', setupComplete: true, tripStoreId: 's1', tripReversed: true };
  await old.settings.insert(settings);
  await old.close();

  const db = await createAppDatabase('precolorscheme', { storage });
  const doc = await db.settings.findOne('app').exec();
  expect(doc?.toJSON()).toEqual(settings);
  await doc?.incrementalPatch({ colorScheme: 'dark' });
  expect((await db.settings.findOne('app').exec())?.colorScheme).toBe('dark');
  await db.close();
});

test('settings from before the default sort are migrated, keeping everything', async () => {
  const { itemSchema, listEntrySchema, settingsSchema, storeSchema, tripSchema } = jest.requireActual('@/db/schema');
  const { createAppDatabase } = jest.requireActual('@/db/database');
  const storage = getRxStorageMemory();

  const old = await openOldDatabase('presort', storage, {
    stores: { schema: storeSchema },
    items: { schema: itemSchema, migrationStrategies: { 1: keep } },
    listEntries: { schema: listEntrySchema, migrationStrategies: { 1: keep } },
    settings: {
      schema: olderVersion(settingsSchema, 2, ['itemSort', 'itemSortDirection']),
      migrationStrategies: { 1: keep, 2: keep },
    },
    trips: { schema: tripSchema, migrationStrategies: { 1: keep } },
  });
  const settings = { id: 'app', setupComplete: true, tripStoreId: 's1', tripReversed: true, colorScheme: 'dark' };
  await old.settings.insert(settings);
  await old.close();

  const db = await createAppDatabase('presort', { storage });
  const doc = await db.settings.findOne('app').exec();
  expect(doc?.toJSON()).toEqual(settings);
  await doc?.incrementalPatch({ itemSort: 'lastBought', itemSortDirection: 'desc' });
  expect((await db.settings.findOne('app').exec())?.itemSort).toBe('lastBought');
  await db.close();
});
