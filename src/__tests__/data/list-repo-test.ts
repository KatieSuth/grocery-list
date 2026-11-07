import { firstValueFrom } from 'rxjs';

import { deleteItem } from '@/data/items-repo';
import { clearCart, observeListEntries, setChecked, setInCart, setQuantity } from '@/data/list-repo';
import { closeTestDatabases, createTestDatabase } from '@/test-utils/db';

afterEach(closeTestDatabases);

test('checking creates an entry with no quantity; unchecking removes it', async () => {
  const db = await createTestDatabase();
  await setChecked(db, 'i1', true);
  expect(await firstValueFrom(observeListEntries(db))).toEqual({
    i1: { itemId: 'i1', checkedAt: expect.any(Number) },
  });
  await setChecked(db, 'i1', false);
  expect(await firstValueFrom(observeListEntries(db))).toEqual({});
});

test('re-checking an already checked item resets its quantity', async () => {
  const db = await createTestDatabase();
  await setChecked(db, 'i1', true);
  await setQuantity(db, 'i1', '3');
  await setChecked(db, 'i1', true);
  expect((await firstValueFrom(observeListEntries(db))).i1.quantity).toBeUndefined();
});

test('setQuantity normalizes, clears when blank, and ignores unchecked items', async () => {
  const db = await createTestDatabase();
  await setChecked(db, 'i1', true);

  await setQuantity(db, 'i1', '  half   a pound ');
  expect((await firstValueFrom(observeListEntries(db))).i1.quantity).toBe('half a pound');

  await setQuantity(db, 'i1', '   ');
  expect('quantity' in (await firstValueFrom(observeListEntries(db))).i1).toBe(false);

  await setQuantity(db, 'unchecked', '4');
  expect(await db.listEntries.findOne('unchecked').exec()).toBeNull();
});

test('deleting an item removes its list entry', async () => {
  const db = await createTestDatabase();
  await db.items.insert({ id: 'i1', name: 'Milk', locations: [], createdAt: 1 });
  await setChecked(db, 'i1', true);
  await deleteItem(db, 'i1');
  expect(await firstValueFrom(observeListEntries(db))).toEqual({});
});

test('setInCart marks a checked item as in the cart and back, keeping its quantity', async () => {
  const db = await createTestDatabase();
  await setChecked(db, 'i1', true);
  await setQuantity(db, 'i1', '2');

  await setInCart(db, 'i1', true);
  expect((await firstValueFrom(observeListEntries(db))).i1).toMatchObject({ quantity: '2', inCartAt: expect.any(Number) });

  await setInCart(db, 'i1', false);
  expect((await firstValueFrom(observeListEntries(db))).i1).toEqual({
    itemId: 'i1',
    quantity: '2',
    checkedAt: expect.any(Number),
  });

  // Unchecked items can't go in the cart.
  await setInCart(db, 'unchecked', true);
  expect(await db.listEntries.findOne('unchecked').exec()).toBeNull();
});

test('clearCart empties the cart but leaves items checked', async () => {
  const db = await createTestDatabase();
  await setChecked(db, 'i1', true);
  await setChecked(db, 'i2', true);
  await setInCart(db, 'i1', true);

  await clearCart(db);
  const entries = await firstValueFrom(observeListEntries(db));
  expect(Object.keys(entries).sort()).toEqual(['i1', 'i2']);
  expect(entries.i1.inCartAt).toBeUndefined();
});
