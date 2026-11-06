import { router } from 'expo-router';
import { act, cleanup, fireEvent, screen } from 'expo-router/testing-library';
import { Alert, type AlertButton } from 'react-native';

import type { AppDatabase } from '@/db/database';
import { eventually, press, renderApp, type } from '@/test-utils/app';
import { closeTestDatabases } from '@/test-utils/db';

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
const openTab = (path: '/' | '/items' | '/stores') => act(() => router.navigate(path));

const entryFor = async (db: AppDatabase, itemId: string) =>
  (await db.listEntries.findOne(itemId).exec())?.toJSON();

test('the main app opens on the shopping trip tab', async () => {
  await renderApp({ seed });
  expect(await screen.findByText('Shopping trips are coming soon')).toBeOnTheScreen();
  expect(screen).toHavePathname('/');
});

test('the master list shows every item with an unchecked checkbox', async () => {
  await renderApp({ seed });
  await openTab('/items');

  expect(screen).toHavePathname('/items');
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
  await openTab('/items');

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
  await openTab('/items');

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

test('checked items and quantities are restored from storage', async () => {
  await renderApp({
    seed: async (db) => {
      await seed(db);
      await db.listEntries.insert({ itemId: 'i1', quantity: '1/2 pound', checkedAt: 5 });
    },
  });
  await openTab('/items');

  expect(await screen.findByRole('checkbox', { name: 'Strawberries' })).toBeChecked();
  expect(screen.getByLabelText('Quantity for Strawberries')).toHaveDisplayValue('1/2 pound');
  expect(screen.getByRole('checkbox', { name: 'Soup' })).not.toBeChecked();
});

test('adding an item from the master list returns to it', async () => {
  await renderApp({ seed });
  await openTab('/items');

  await press('Add an item');
  expect(screen).toHavePathname('/items/form');
  await type('Item name', 'Bread');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Corner Market' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Deli in Corner Market' }));
  await press('Continue');

  expect(await screen.findByText('Bread')).toBeOnTheScreen();
  expect(screen).toHavePathname('/items');
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
  await openTab('/items');

  await press('Soup, Acme');
  // The exact URL can carry an internal router flag after a tab switch; check the form instead.
  expect(screen).toHavePathname('/items/form');
  expect(screen.getByLabelText('Item name')).toHaveDisplayValue('Soup');
  await type('Item name', 'Tomato soup');
  await press('Save');
  expect(await screen.findByText('Tomato soup')).toBeOnTheScreen();
  expect(screen).toHavePathname('/items');
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
  await openTab('/items');
  expect(await screen.findByText('No items yet')).toBeOnTheScreen();
});

test('an item with no stores left says so on the master list', async () => {
  await renderApp({
    seed: async (db) => {
      await seed(db);
      await db.items.findOne('i1').patch({ locations: [] });
    },
  });
  await openTab('/items');
  expect(await screen.findByText('No store selected')).toBeOnTheScreen();
});

test('the stores tab lists, adds and edits stores', async () => {
  await renderApp({ seed });
  await openTab('/stores');

  expect(screen).toHavePathname('/stores');
  expect(await screen.findByText('Produce → Deli')).toBeOnTheScreen();

  await press('Add a store');
  expect(screen).toHavePathname('/stores/form');
  await type('Store name', 'Big Box');
  await press('Save');
  expect(await screen.findByText('Big Box')).toBeOnTheScreen();
  expect(screen).toHavePathname('/stores');

  await press('Corner Market');
  expect(screen).toHavePathname('/stores/form');
  expect(screen.getByLabelText('Store name')).toHaveDisplayValue('Corner Market');
  await press('Move Deli up');
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
