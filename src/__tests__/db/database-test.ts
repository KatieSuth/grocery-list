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
  expect(Object.keys(db.collections).sort()).toEqual(['items', 'listEntries', 'settings', 'stores']);
  await db.close();
});

test('documents are validated against the schema in development', async () => {
  const db = await createTestDatabase();
  await expect(
    // @ts-expect-error deliberately invalid document
    db.stores.insert({ id: 'x', name: 42, departments: [], createdAt: 1 }),
  ).rejects.toThrow();
});

test('a database created before list entries existed still opens and keeps its data', async () => {
  const { createRxDatabase } = jest.requireActual('rxdb');
  const { itemSchema, settingsSchema, storeSchema } = jest.requireActual('@/db/schema');
  const { createAppDatabase } = jest.requireActual('@/db/database');
  const storage = getRxStorageMemory();

  // The pre-tabs app: no listEntries collection.
  const { wrappedValidateZSchemaStorage } = jest.requireActual('rxdb/plugins/validate-z-schema');
  const old = await createRxDatabase({
    name: 'upgrade',
    storage: wrappedValidateZSchemaStorage({ storage }),
    multiInstance: false,
  });
  await old.addCollections({
    stores: { schema: storeSchema },
    items: { schema: itemSchema },
    settings: { schema: settingsSchema },
  });
  await old.items.insert({ id: 'i1', name: 'Milk', locations: [], createdAt: 1 });
  await old.close();

  const db = await createAppDatabase('upgrade', { storage });
  expect((await db.items.findOne('i1').exec())?.name).toBe('Milk');
  expect(await db.listEntries.count().exec()).toBe(0);
  await db.close();
});
