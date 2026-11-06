import { firstValueFrom } from 'rxjs';

import { deleteStore, observeStores, saveStore } from '@/data/stores-repo';
import { closeTestDatabases, createTestDatabase } from '@/test-utils/db';

afterEach(closeTestDatabases);

const draft = {
  name: '  Corner  Market ',
  location: ' Main St ',
  departments: [
    { id: 'd1', name: 'Produce' },
    { id: 'd2', name: 'Deli' },
  ],
};

test('saveStore creates a normalized store', async () => {
  const db = await createTestDatabase();
  const store = await saveStore(db, draft);
  expect(store).toMatchObject({ name: 'Corner Market', location: 'Main St', departments: draft.departments });
  expect(store.id).toHaveLength(16);
  expect(typeof store.createdAt).toBe('number');
});

test('saveStore omits a blank location', async () => {
  const db = await createTestDatabase();
  const store = await saveStore(db, { ...draft, location: '   ' });
  expect('location' in store).toBe(false);
});

test('saveStore with an unknown id creates the store with that id', async () => {
  const db = await createTestDatabase();
  expect((await saveStore(db, draft, 'fixed')).id).toBe('fixed');
});

test('saveStore updates and prunes item locations for removed departments', async () => {
  const db = await createTestDatabase();
  const store = await saveStore(db, draft);
  await db.items.insert({
    id: 'i1',
    name: 'Ham',
    locations: [{ storeId: store.id, departmentId: 'd2' }],
    createdAt: 1,
  });
  await db.items.insert({
    id: 'i2',
    name: 'Kale',
    locations: [{ storeId: store.id, departmentId: 'd1' }],
    createdAt: 2,
  });

  const updated = await saveStore(db, { name: 'Renamed', location: '', departments: [draft.departments[0]] }, store.id);

  expect(updated).toMatchObject({ id: store.id, name: 'Renamed', createdAt: store.createdAt });
  expect('location' in updated).toBe(false);
  expect((await db.items.findOne('i1').exec())?.toJSON().locations).toEqual([]);
  expect((await db.items.findOne('i2').exec())?.toJSON().locations).toEqual([{ storeId: store.id, departmentId: 'd1' }]);
});

test('deleteStore removes the store and its item locations', async () => {
  const db = await createTestDatabase();
  const a = await saveStore(db, draft);
  const b = await saveStore(db, { ...draft, name: 'B' });
  await db.items.insert({
    id: 'i1',
    name: 'Ham',
    locations: [
      { storeId: a.id, departmentId: 'd2' },
      { storeId: b.id, departmentId: 'd2' },
    ],
    createdAt: 1,
  });

  await deleteStore(db, a.id);

  expect((await firstValueFrom(observeStores(db))).map((s) => s.id)).toEqual([b.id]);
  expect((await db.items.findOne('i1').exec())?.toJSON().locations).toEqual([{ storeId: b.id, departmentId: 'd2' }]);
});

test('observeStores lists stores in creation order', async () => {
  const db = await createTestDatabase();
  await db.stores.insert({ id: 'late', name: 'Late', departments: [], createdAt: 20 });
  await db.stores.insert({ id: 'early', name: 'Early', departments: [], createdAt: 10 });
  expect((await firstValueFrom(observeStores(db))).map((s) => s.name)).toEqual(['Early', 'Late']);
});
