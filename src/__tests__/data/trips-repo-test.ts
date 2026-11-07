import { setChecked, setInCart, setQuantity } from '@/data/list-repo';
import { finishTrip } from '@/data/trips-repo';
import type { AppDatabase } from '@/db/database';
import { closeTestDatabases, createTestDatabase } from '@/test-utils/db';

afterEach(async () => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  await closeTestDatabases();
});

async function seed(db: AppDatabase) {
  await db.stores.insert({
    id: 's1',
    name: 'Corner Market',
    departments: [
      { id: 'd1', name: 'Produce' },
      { id: 'd2', name: 'Deli' },
    ],
    createdAt: 1,
  });
  await db.stores.insert({ id: 's2', name: 'Big Box', departments: [{ id: 'd3', name: 'Frozen' }], createdAt: 2 });
  const add = (id: string, name: string, locations: [string, string][], brand?: string) =>
    db.items.insert({
      id,
      name,
      ...(brand ? { brand } : {}),
      locations: locations.map(([storeId, departmentId]) => ({ storeId, departmentId })),
      createdAt: 1,
    });
  await add('apples', 'Apples', [['s1', 'd1']]);
  await add('ham', 'Ham', [['s1', 'd2']], 'Acme');
  await add('soup', 'Soup', [['s1', 'd2']]);
  await add('peas', 'Peas', [['s2', 'd3']]);
}

test('finishing logs the items in the cart, sets their last-bought date, and unchecks only them', async () => {
  jest.useFakeTimers({ now: new Date('2026-11-06T10:00:00Z'), doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask', 'nextTick'] });
  const db = await createTestDatabase();
  await seed(db);
  for (const id of ['apples', 'ham', 'soup', 'peas']) await setChecked(db, id, true);
  await setQuantity(db, 'ham', '1 lb');
  await setInCart(db, 'ham', true);
  await setInCart(db, 'apples', true);
  // In the cart, but not sold at this store: not part of this trip.
  await setInCart(db, 'peas', true);

  const record = await finishTrip(db, 's1');
  const finishedAt = new Date('2026-11-06T10:00:00Z').getTime();
  expect(record).toEqual({
    id: expect.any(String),
    storeId: 's1',
    storeName: 'Corner Market',
    finishedAt,
    items: [
      { itemId: 'apples', name: 'Apples', department: 'Produce' },
      { itemId: 'ham', name: 'Ham', brand: 'Acme', quantity: '1 lb', department: 'Deli' },
    ],
  });
  expect((await db.trips.findOne(record?.id).exec())?.toJSON()).toEqual(record);

  // Bought items are unchecked and dated; the rest are untouched.
  const remaining = (await db.listEntries.find().exec()).map((e) => e.itemId).sort();
  expect(remaining).toEqual(['peas', 'soup']);
  expect((await db.items.findOne('ham').exec())?.lastBoughtAt).toBe(finishedAt);
  expect((await db.items.findOne('apples').exec())?.lastBoughtAt).toBe(finishedAt);
  expect((await db.items.findOne('soup').exec())?.lastBoughtAt).toBeUndefined();
});

test('finishing with nothing in the cart, or at a missing store, does nothing', async () => {
  const db = await createTestDatabase();
  await seed(db);
  await setChecked(db, 'ham', true);

  expect(await finishTrip(db, 's1')).toBeNull();
  await setInCart(db, 'ham', true);
  expect(await finishTrip(db, 'gone')).toBeNull();

  expect(await db.trips.count().exec()).toBe(0);
  expect(await db.listEntries.count().exec()).toBe(1);
});

/** Ham and Apples in the cart at Corner Market; Soup checked but not in the cart. */
async function cartAtCorner(db: AppDatabase) {
  await seed(db);
  for (const id of ['apples', 'ham', 'soup']) await setChecked(db, id, true);
  await setInCart(db, 'ham', true);
  await setInCart(db, 'apples', true);
}

const checkedIds = async (db: AppDatabase) => (await db.listEntries.find().exec()).map((e) => e.itemId).sort();
const tripsLogged = async (db: AppDatabase) => (await db.trips.find().exec()).map((t) => t.toJSON());

test('if unchecking fails, the error is reported and trying again completes the same trip', async () => {
  const db = await createTestDatabase();
  await cartAtCorner(db);
  jest.spyOn(db.listEntries, 'bulkRemove').mockResolvedValueOnce({ success: [], error: [{} as never] });

  await expect(finishTrip(db, 's1')).rejects.toThrow('Could not uncheck 1 of 2 items');
  // Logged as pending; nothing unchecked yet.
  const [pending] = await tripsLogged(db);
  expect(pending.pending).toBe(true);
  expect(await checkedIds(db)).toEqual(['apples', 'ham', 'soup']);

  const record = await finishTrip(db, 's1');
  expect(record?.id).toBe(pending.id);
  expect(record?.pending).toBeUndefined();
  const logged = await tripsLogged(db);
  expect(logged).toHaveLength(1);
  expect(logged[0].pending).toBeUndefined();
  expect(await checkedIds(db)).toEqual(['soup']);
});

test('if setting last-bought dates fails, trying again completes the same trip', async () => {
  const db = await createTestDatabase();
  await cartAtCorner(db);
  jest.spyOn(db.items, 'findByIds').mockReturnValueOnce({
    exec: async () => new Map([['ham', { incrementalPatch: () => Promise.reject(new Error('disk full')) }]]),
  } as never);

  await expect(finishTrip(db, 's1')).rejects.toThrow('disk full');
  const record = await finishTrip(db, 's1');
  expect(await tripsLogged(db)).toHaveLength(1);
  expect((await db.items.findOne('ham').exec())?.lastBoughtAt).toBe(record?.finishedAt);
  expect(await checkedIds(db)).toEqual(['soup']);
});

test('completing an interrupted trip leaves alone items checked again or deleted since', async () => {
  const db = await createTestDatabase();
  await seed(db);
  // A trip interrupted after unchecking, before being marked complete.
  await db.trips.insert({
    id: 't1',
    storeId: 's1',
    storeName: 'Corner Market',
    finishedAt: 1000,
    pending: true,
    items: [
      { itemId: 'ham', name: 'Ham', department: 'Deli' },
      { itemId: 'gone', name: 'Gone', department: 'Deli' },
    ],
  });
  // Since then, Ham was checked again (a new need, not in the cart).
  await setChecked(db, 'ham', true);

  const record = await finishTrip(db, 's1');
  expect(record?.id).toBe('t1');
  expect(await checkedIds(db)).toEqual(['ham']);
  expect((await db.items.findOne('ham').exec())?.lastBoughtAt).toBe(1000);
  expect((await tripsLogged(db))[0].pending).toBeUndefined();
});

test('an interrupted trip is completed before a new one; the new cart is left for next time', async () => {
  const db = await createTestDatabase();
  await cartAtCorner(db);
  await db.trips.insert({
    id: 't0',
    storeId: 's2',
    storeName: 'Big Box',
    finishedAt: 500,
    pending: true,
    items: [{ itemId: 'peas', name: 'Peas', department: 'Frozen' }],
  });

  expect((await finishTrip(db, 's1'))?.id).toBe('t0');
  expect(await tripsLogged(db)).toHaveLength(1);
  expect(await checkedIds(db)).toEqual(['apples', 'ham', 'soup']);

  // The next Finish handles the cart at Corner Market as usual.
  await finishTrip(db, 's1');
  expect(await tripsLogged(db)).toHaveLength(2);
  expect(await checkedIds(db)).toEqual(['soup']);
});
