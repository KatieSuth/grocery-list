import { router } from 'expo-router';
import { act, cleanup, fireEvent, screen } from 'expo-router/testing-library';
import { Alert, AppState, type AlertButton } from 'react-native';

import * as listRepo from '@/data/list-repo';
import type { AppDatabase } from '@/db/database';
import { QUANTITY_SAVE_DELAY_MS } from '@/hooks/use-delayed-quantity-save';
import { addDepartments, dragDepartment, eventually, press, renderApp, type } from '@/test-utils/app';
import { closeTestDatabases } from '@/test-utils/db';
import { WRITE_FAILED_TITLE } from '@/utils/run-write';

jest.mock('@/db/database', () => ({
  ...jest.requireActual('@/db/database'),
  getAppDatabase: jest.fn(),
}));

afterEach(async () => {
  jest.restoreAllMocks();
  await cleanup();
  jest.useRealTimers();
  await closeTestDatabases();
});

async function seed(db: AppDatabase) {
  await db.settings.insert({ id: 'app', setupComplete: true });
  await db.stores.insert({
    id: 's1',
    name: 'Corner Market',
    departments: [
      { id: 'd1', name: 'Produce' },
      { id: 'd2', name: 'Deli' },
    ],
    createdAt: 1,
  });
  await db.items.insert({
    id: 'i1',
    name: 'Strawberries',
    locations: [{ storeId: 's1', departmentId: 'd1' }],
    createdAt: 1,
  });
  await db.items.insert({
    id: 'i2',
    name: 'Soup',
    brand: 'Acme',
    locations: [{ storeId: 's1', departmentId: 'd2' }],
    createdAt: 2,
  });
}

/** The native tab bar isn't rendered in Jest, so switch tabs the way a tab press does. */
const openTab = (path: '/' | '/trip' | '/stores') => act(() => router.navigate(path));

const entryFor = async (db: AppDatabase, itemId: string) =>
  (await db.listEntries.findOne(itemId).exec())?.toJSON();

test('the main app opens on the items tab; the shopping trip is the next tab', async () => {
  await renderApp({ seed });
  expect(await screen.findByRole('checkbox', { name: 'Soup' })).toBeOnTheScreen();
  expect(screen).toHavePathname('/');

  await openTab('/trip');
  expect(await screen.findByText('Where are you shopping?')).toBeOnTheScreen();
  expect(screen).toHavePathname('/trip');
});

test('the master list shows every item with an unchecked checkbox', async () => {
  await renderApp({ seed });
  await openTab('/');

  expect(screen).toHavePathname('/');
  expect(await screen.findByText('Soup')).toBeOnTheScreen();
  expect(screen.getByText('Acme')).toBeOnTheScreen();
  expect(screen.getByText('Corner Market · Deli')).toBeOnTheScreen();
  expect(screen.getByText('Corner Market · Produce')).toBeOnTheScreen();
  expect(screen.getByRole('checkbox', { name: 'Soup' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Strawberries' })).not.toBeChecked();
  // No quantity until an item is checked.
  expect(screen.queryByLabelText(/Quantity for/)).toBeNull();
});

test('checking an item saves it with an optional free-text quantity', async () => {
  const db = await renderApp({ seed });
  await openTab('/');

  await fireEvent.press(await screen.findByRole('checkbox', { name: 'Strawberries' }));
  expect(screen.getByRole('checkbox', { name: 'Strawberries' })).toBeChecked();
  await eventually(async () => expect(await entryFor(db, 'i1')).toEqual({ itemId: 'i1', checkedAt: expect.any(Number) }));

  // Quantity is free text, not just a number.
  await type('Quantity for Strawberries', '  1   pint ');
  await eventually(async () => expect((await entryFor(db, 'i1'))?.quantity).toBe('1 pint'));
  expect(screen.getByLabelText('Quantity for Strawberries')).toHaveDisplayValue('  1   pint ');

  // Clearing it leaves the item checked with no quantity.
  await type('Quantity for Strawberries', '');
  await eventually(async () => expect(await entryFor(db, 'i1')).toEqual({ itemId: 'i1', checkedAt: expect.any(Number) }));
  expect(screen.getByRole('checkbox', { name: 'Strawberries' })).toBeChecked();
});

test('unchecking discards the quantity, so re-checking starts blank', async () => {
  const db = await renderApp({ seed });
  await openTab('/');

  await fireEvent.press(await screen.findByRole('checkbox', { name: 'Soup' }));
  await type('Quantity for Soup', '4');
  await eventually(async () => expect((await entryFor(db, 'i2'))?.quantity).toBe('4'));

  await fireEvent.press(screen.getByRole('checkbox', { name: 'Soup' }));
  expect(screen.getByRole('checkbox', { name: 'Soup' })).not.toBeChecked();
  expect(screen.queryByLabelText('Quantity for Soup')).toBeNull();
  await eventually(async () => expect(await entryFor(db, 'i2')).toBeUndefined());

  await fireEvent.press(screen.getByRole('checkbox', { name: 'Soup' }));
  expect(await screen.findByLabelText('Quantity for Soup')).toHaveDisplayValue('');
});

test('a quantity is saved once typing pauses, not on every keystroke', async () => {
  const db = await renderApp({ seed });
  await openTab('/');
  await fireEvent.press(await screen.findByRole('checkbox', { name: 'Soup' }));
  await eventually(async () => expect(await entryFor(db, 'i2')).toBeDefined());
  const setQuantity = jest.spyOn(listRepo, 'setQuantity');

  await type('Quantity for Soup', '1');
  await type('Quantity for Soup', '12');
  await type('Quantity for Soup', '12 cans');
  expect(screen.getByLabelText('Quantity for Soup')).toHaveDisplayValue('12 cans');
  // Not saved yet: typing hasn't paused.
  expect((await entryFor(db, 'i2'))?.quantity).toBeUndefined();

  await act(async () => {
    await jest.advanceTimersByTimeAsync(QUANTITY_SAVE_DELAY_MS);
  });
  await eventually(async () => expect((await entryFor(db, 'i2'))?.quantity).toBe('12 cans'));
  // One save for the three changes.
  expect(setQuantity).toHaveBeenCalledTimes(1);
});

test('unchecking drops a quantity still waiting to be saved', async () => {
  const db = await renderApp({ seed });
  await openTab('/');
  await fireEvent.press(await screen.findByRole('checkbox', { name: 'Soup' }));
  await eventually(async () => expect(await entryFor(db, 'i2')).toBeDefined());
  const setQuantity = jest.spyOn(listRepo, 'setQuantity');

  await type('Quantity for Soup', '4');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Soup' }));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(QUANTITY_SAVE_DELAY_MS * 2);
  });
  expect(setQuantity).not.toHaveBeenCalled();
  await eventually(async () => expect(await entryFor(db, 'i2')).toBeUndefined());
});

test('a quantity still waiting to be saved is saved when the list closes', async () => {
  const db = await renderApp({ seed });
  await openTab('/');
  await fireEvent.press(await screen.findByRole('checkbox', { name: 'Soup' }));
  await eventually(async () => expect(await entryFor(db, 'i2')).toBeDefined());

  await type('Quantity for Soup', '3');
  await cleanup();
  await eventually(async () => expect((await entryFor(db, 'i2'))?.quantity).toBe('3'));
});

test('a quantity still waiting to be saved is saved when the app goes to the background', async () => {
  const listen = jest.spyOn(AppState, 'addEventListener');
  const db = await renderApp({ seed });
  await openTab('/');
  await fireEvent.press(await screen.findByRole('checkbox', { name: 'Soup' }));
  await eventually(async () => expect(await entryFor(db, 'i2')).toBeDefined());

  await type('Quantity for Soup', '5');
  const appStateChanged = listen.mock.calls.findLast(([event]) => event === 'change')?.[1];
  // Coming back to the app saves nothing early; leaving it does.
  await act(async () => appStateChanged?.('active'));
  expect((await entryFor(db, 'i2'))?.quantity).toBeUndefined();
  await act(async () => appStateChanged?.('background'));
  await eventually(async () => expect((await entryFor(db, 'i2'))?.quantity).toBe('5'));
});

test('a failed check is reported instead of silently doing nothing', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const db = await renderApp({ seed });
  await openTab('/');
  jest.spyOn(db.listEntries, 'upsert').mockRejectedValue(new Error('nope'));

  await fireEvent.press(await screen.findByRole('checkbox', { name: 'Soup' }));
  await eventually(async () =>
    expect(alert).toHaveBeenCalledWith(WRITE_FAILED_TITLE, 'Could not update your list. Please try again.'),
  );
  expect(screen.getByRole('checkbox', { name: 'Soup' })).not.toBeChecked();
});

test('checked items and quantities are restored from storage', async () => {
  await renderApp({
    seed: async (db) => {
      await seed(db);
      await db.listEntries.insert({ itemId: 'i1', quantity: '1/2 pound', checkedAt: 5 });
    },
  });
  await openTab('/');

  expect(await screen.findByRole('checkbox', { name: 'Strawberries' })).toBeChecked();
  expect(screen.getByLabelText('Quantity for Strawberries')).toHaveDisplayValue('1/2 pound');
  expect(screen.getByRole('checkbox', { name: 'Soup' })).not.toBeChecked();
});

test('adding an item from the master list returns to it', async () => {
  await renderApp({ seed });
  await openTab('/');

  await press('Add an item');
  expect(screen).toHavePathname('/item-form');
  await type('Item name', 'Bread');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Corner Market' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Deli in Corner Market' }));
  await press('Continue');

  expect(await screen.findByText('Bread')).toBeOnTheScreen();
  expect(screen).toHavePathname('/');
  expect(screen.getByRole('checkbox', { name: 'Bread' })).not.toBeChecked();
});

test('tapping an item opens it for editing; deleting it also unchecks it', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => {
    buttons?.find((b) => b.text === 'Delete')?.onPress?.();
  });
  const db = await renderApp({
    seed: async (d) => {
      await seed(d);
      await d.listEntries.insert({ itemId: 'i2', quantity: '2 cans', checkedAt: 5 });
    },
  });
  await openTab('/');

  await press('Soup, Acme');
  // The exact URL can carry an internal router flag after a tab switch; check the form instead.
  expect(screen).toHavePathname('/item-form');
  expect(screen.getByLabelText('Item name')).toHaveDisplayValue('Soup');
  await type('Item name', 'Tomato soup');
  await press('Save');
  expect(await screen.findByText('Tomato soup')).toBeOnTheScreen();
  expect(screen).toHavePathname('/');
  // Editing the item keeps it checked.
  expect(screen.getByLabelText('Quantity for Tomato soup')).toHaveDisplayValue('2 cans');

  await press('Tomato soup, Acme');
  await press('Delete item');
  expect(await screen.findByRole('checkbox', { name: 'Strawberries' })).toBeOnTheScreen();
  expect(screen.queryByText('Tomato soup')).toBeNull();
  await eventually(async () => expect(await entryFor(db, 'i2')).toBeUndefined());
});

test('the master list explains when there are no items', async () => {
  await renderApp({
    seed: async (db) => {
      await db.settings.insert({ id: 'app', setupComplete: true });
    },
  });
  await openTab('/');
  expect(await screen.findByText('No items yet')).toBeOnTheScreen();
});

test('an item with no stores left says so on the master list', async () => {
  await renderApp({
    seed: async (db) => {
      await seed(db);
      await db.items.findOne('i1').patch({ locations: [] });
    },
  });
  await openTab('/');
  expect(await screen.findByText('No store selected')).toBeOnTheScreen();
});

test('the stores tab lists, adds and edits stores', async () => {
  await renderApp({ seed });
  await openTab('/stores');

  expect(screen).toHavePathname('/stores');
  expect(await screen.findByText('Produce → Deli')).toBeOnTheScreen();

  await press('Add a store');
  expect(screen).toHavePathname('/store-form');
  await type('Store name', 'Big Box');
  await addDepartments('Frozen');
  await press('Save');
  expect(await screen.findByText('Big Box')).toBeOnTheScreen();
  expect(screen).toHavePathname('/stores');

  await press('Corner Market');
  expect(screen).toHavePathname('/store-form');
  expect(screen.getByLabelText('Store name')).toHaveDisplayValue('Corner Market');
  await dragDepartment(1, 0);
  await press('Save');
  expect(await screen.findByText('Deli → Produce')).toBeOnTheScreen();
});

test('the stores tab explains when there are no stores', async () => {
  await renderApp({
    seed: async (db) => {
      await db.settings.insert({ id: 'app', setupComplete: true });
    },
  });
  await openTab('/stores');
  expect(await screen.findByText('No stores yet')).toBeOnTheScreen();
});
