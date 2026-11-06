import { firstValueFrom } from 'rxjs';

import { deleteItem, observeItems, saveItem } from '@/data/items-repo';
import { closeTestDatabases, createTestDatabase } from '@/test-utils/db';

afterEach(closeTestDatabases);

const locations = [{ storeId: 's1', departmentId: 'd1' }];

test('saveItem creates a normalized item', async () => {
  const db = await createTestDatabase();
  const item = await saveItem(db, { name: ' Whole  milk ', brand: ' Acme ', locations });
  expect(item).toMatchObject({ name: 'Whole milk', brand: 'Acme', locations });
  expect(typeof item.createdAt).toBe('number');
});

test('saveItem omits a blank brand', async () => {
  const db = await createTestDatabase();
  expect('brand' in (await saveItem(db, { name: 'Milk', brand: ' ', locations }))).toBe(false);
});

test('saveItem with an unknown id creates the item with that id', async () => {
  const db = await createTestDatabase();
  expect((await saveItem(db, { name: 'Milk', brand: '', locations }, 'fixed')).id).toBe('fixed');
});

test('saveItem updates an existing item and can clear the brand', async () => {
  const db = await createTestDatabase();
  const item = await saveItem(db, { name: 'Milk', brand: 'Acme', locations });
  const updated = await saveItem(db, { name: 'Oat milk', brand: '', locations: [] }, item.id);
  expect(updated).toEqual({ id: item.id, name: 'Oat milk', locations: [], createdAt: item.createdAt });
});

test('deleteItem removes the item', async () => {
  const db = await createTestDatabase();
  const item = await saveItem(db, { name: 'Milk', brand: '', locations });
  await deleteItem(db, item.id);
  expect(await db.items.count().exec()).toBe(0);
});

test('observeItems sorts by name, ignoring case', async () => {
  const db = await createTestDatabase();
  for (const name of ['bananas', 'Milk', 'Apples']) {
    await saveItem(db, { name, brand: '', locations });
  }
  expect((await firstValueFrom(observeItems(db))).map((i) => i.name)).toEqual(['Apples', 'bananas', 'Milk']);
});
