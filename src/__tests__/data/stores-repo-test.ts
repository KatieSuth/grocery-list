import { firstValueFrom } from 'rxjs';

import { addStoreDepartment, copyStore, deleteStore, observeStores, saveStore } from '@/data/stores-repo';
import { copyStoreDraft } from '@/domain/store-draft';
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

test('observeStores lists stores A–Z by name, then location, not in the order they were added', async () => {
  const db = await createTestDatabase();
  await db.stores.insert({ id: 'z', name: 'Zippy', departments: [], createdAt: 1 });
  await db.stores.insert({ id: 'k2', name: 'Kroger', location: 'Main St', departments: [], createdAt: 2 });
  await db.stores.insert({ id: 'k1', name: 'kroger', location: 'Elm St', departments: [], createdAt: 3 });
  await db.stores.insert({ id: 'a', name: 'Aldi', departments: [], createdAt: 4 });
  const stores = await firstValueFrom(observeStores(db));
  expect(stores.map((s) => s.id)).toEqual(['a', 'k1', 'k2', 'z']);
});

test('addStoreDepartment adds a tidied department at the end of the walking order', async () => {
  const db = await createTestDatabase();
  await saveStore(db, draft, 's1');

  const result = await addStoreDepartment(db, 's1', '  Frozen   Foods ');
  expect(result).toEqual({ ok: true, department: { id: expect.any(String), name: 'Frozen Foods' } });
  const store = await db.stores.findOne('s1').exec();
  expect(store?.departments.map((d) => d.name)).toEqual(['Produce', 'Deli', 'Frozen Foods']);
  expect(result.ok && store?.departments[2].id).toBe(result.ok && result.department.id);
});

test('addStoreDepartment refuses blank and duplicate names, and missing stores, without saving', async () => {
  const db = await createTestDatabase();
  await saveStore(db, draft, 's1');
  const before = (await db.stores.findOne('s1').exec())?.revision;

  expect(await addStoreDepartment(db, 's1', '   ')).toEqual({ ok: false, error: 'Enter a department name.' });
  expect(await addStoreDepartment(db, 's1', 'deli')).toEqual({ ok: false, error: '"deli" is already in the list.' });
  expect(await addStoreDepartment(db, 'nope', 'Bakery')).toEqual({ ok: false, error: 'This store no longer exists.' });
  expect((await db.stores.findOne('s1').exec())?.revision).toBe(before);
});

test('addStoreDepartment checks again against the saved store, in case it changed meanwhile', async () => {
  const db = await createTestDatabase();
  await saveStore(db, draft, 's1');
  // Read before someone else adds Bakery: the first check passes, the second doesn't.
  const stale = await db.stores.findOne('s1').exec();
  await addStoreDepartment(db, 's1', 'Bakery');
  jest.spyOn(db.stores, 'findOne').mockReturnValue({ exec: async () => stale } as never);

  expect(await addStoreDepartment(db, 's1', 'bakery')).toEqual({ ok: false, error: '"bakery" is already in the list.' });
  jest.restoreAllMocks();
  const names = (await db.stores.findOne('s1').exec())?.departments.map((d) => d.name);
  expect(names).toEqual(['Produce', 'Deli', 'Bakery']);
});

describe('copyStore', () => {
  const setUp = async () => {
    const db = await createTestDatabase();
    const source = await saveStore(db, draft);
    await db.items.insert({ id: 'kale', name: 'Kale', locations: [{ storeId: source.id, departmentId: 'd1' }], createdAt: 1 });
    await db.items.insert({ id: 'ham', name: 'Ham', locations: [{ storeId: source.id, departmentId: 'd2' }], createdAt: 2 });
    await db.items.insert({ id: 'soap', name: 'Soap', locations: [], createdAt: 3 });
    const copy = copyStoreDraft(source);
    // Produce kept, Deli removed.
    const copyDraft = { name: 'Corner Market', location: 'Elm St', departments: [copy.draft.departments[0]] };
    return { db, source, copy, copyDraft };
  };
  const locationsOf = async (db: Awaited<ReturnType<typeof createTestDatabase>>, id: string) =>
    (await db.items.findOne(id).exec())?.toJSON().locations;

  test("lists the source's items under the new store, without duplicating them", async () => {
    const { db, source, copy, copyDraft } = await setUp();
    const store = await copyStore(db, copyDraft, {
      sourceStoreId: source.id,
      departmentSources: copy.departmentSources,
      copyItems: true,
    });
    expect(store).toMatchObject({ name: 'Corner Market', location: 'Elm St', departments: copyDraft.departments });
    expect(await locationsOf(db, 'kale')).toEqual([
      { storeId: source.id, departmentId: 'd1' },
      { storeId: store.id, departmentId: copyDraft.departments[0].id },
    ]);
    // Deli was removed from the copy, so Ham stays at the source store only.
    expect(await locationsOf(db, 'ham')).toEqual([{ storeId: source.id, departmentId: 'd2' }]);
    expect(await locationsOf(db, 'soap')).toEqual([]);
    expect(await db.items.count().exec()).toBe(3);
  });

  test('copies no items when asked not to, or when the source store is gone', async () => {
    const { db, source, copy, copyDraft } = await setUp();
    await copyStore(db, copyDraft, { sourceStoreId: source.id, departmentSources: copy.departmentSources, copyItems: false });
    await deleteStore(db, source.id);
    await copyStore(db, { ...copyDraft, location: 'Oak Ave' }, {
      sourceStoreId: source.id,
      departmentSources: copy.departmentSources,
      copyItems: true,
    });
    expect(await locationsOf(db, 'kale')).toEqual([]);
    expect((await firstValueFrom(observeStores(db))).map((s) => s.location)).toEqual(['Elm St', 'Oak Ave']);
  });
});
