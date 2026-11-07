import { cleanup, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { Alert, type AlertButton } from 'react-native';

import type { AppDatabase } from '@/db/database';
import { addDepartments, departmentActions, moveDepartment, press, renderApp, type } from '@/test-utils/app';
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
  await db.stores.insert({
    id: 's1',
    name: 'Corner Market',
    location: 'Main St',
    departments: [
      { id: 'd1', name: 'Produce' },
      { id: 'd2', name: 'Deli' },
    ],
    createdAt: 1,
  });
  await db.stores.insert({
    id: 's2',
    name: 'Big Box',
    departments: [{ id: 'd3', name: 'Frozen' }],
    createdAt: 2,
  });
  await db.items.insert({
    id: 'i1',
    name: 'Milk',
    brand: 'Acme',
    locations: [
      { storeId: 's1', departmentId: 'd2' },
      { storeId: 's2', departmentId: 'd3' },
    ],
    createdAt: 1,
  });
}

/** Makes Alert.alert immediately choose the button with the given text. */
function answerAlertWith(text: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((b) => b.text === text)?.onPress?.();
  });
}

test('editing a store updates it and removes item locations for deleted departments', async () => {
  const db = await renderApp({ seed });

  await press('Corner Market, Main St');
  expect(screen).toHavePathnameWithParams('/setup/store-form?id=s1');
  expect(screen.getByLabelText('Store name')).toHaveDisplayValue('Corner Market');
  expect(screen.getByLabelText('Location')).toHaveDisplayValue('Main St');
  // The first department can only move down; the last only up.
  expect(departmentActions('Produce')).toEqual(['moveDown']);
  expect(departmentActions('Deli')).toEqual(['moveUp']);

  await type('Store name', 'Corner Mkt');
  await type('Location', '   ');
  await moveDepartment('Deli', 'up');
  await press('Remove Deli');
  await press('Save');

  expect(await screen.findByText('Corner Mkt')).toBeOnTheScreen();
  const store = await db.stores.findOne('s1').exec();
  expect(store?.toJSON()).toMatchObject({ name: 'Corner Mkt', departments: [{ id: 'd1', name: 'Produce' }] });
  expect(store?.location).toBeUndefined();

  const item = await db.items.findOne('i1').exec();
  expect(item?.toJSON().locations).toEqual([{ storeId: 's2', departmentId: 'd3' }]);
});

test('deleting a store asks for confirmation and removes it from items', async () => {
  const alert = answerAlertWith('Cancel');
  const db = await renderApp({ seed });

  await press('Corner Market, Main St');
  await press('Delete store');
  expect(alert).toHaveBeenCalledWith('Delete Corner Market?', expect.any(String), expect.any(Array));
  expect(screen).toHavePathnameWithParams('/setup/store-form?id=s1');

  answerAlertWith('Delete');
  await press('Delete store');

  await waitFor(() => expect(screen.queryByText('Corner Market')).toBeNull());
  expect(screen).toHavePathname('/setup');
  await press('Next');
  // Milk now only lists the remaining store.
  expect(await screen.findByText('Big Box · Frozen')).toBeOnTheScreen();
  expect(await db.stores.count().exec()).toBe(1);
});

test('editing an item', async () => {
  const db = await renderApp({ seed });

  await press('Next');
  expect(await screen.findByText('Corner Market · Deli, Big Box · Frozen')).toBeOnTheScreen();
  await press('Milk, Acme');
  expect(screen).toHavePathnameWithParams('/setup/item-form?id=i1');
  expect(screen.getByLabelText('Item name')).toHaveDisplayValue('Milk');
  expect(screen.getByRole('radio', { name: 'Deli in Corner Market' })).toBeChecked();
  // Edit mode uses Save/Cancel instead of Add more/Continue.
  expect(screen.queryByRole('button', { name: 'Add more' })).toBeNull();

  await type('Brand', '');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Big Box' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Produce in Corner Market' }));
  await press('Save');

  expect(await screen.findByText('Corner Market · Produce')).toBeOnTheScreen();
  const item = await db.items.findOne('i1').exec();
  expect(item?.brand).toBeUndefined();
  expect(item?.toJSON().locations).toEqual([{ storeId: 's1', departmentId: 'd1' }]);
});

test('edit mode validates and can be cancelled', async () => {
  const db = await renderApp({ seed });
  await press('Next');
  await press('Milk, Acme');

  await type('Item name', ' ');
  await press('Save');
  expect(await screen.findByText('Item name is required.')).toBeOnTheScreen();

  await press('Cancel');
  expect(await screen.findByText('Milk')).toBeOnTheScreen();
  expect((await db.items.findOne('i1').exec())?.name).toBe('Milk');
});

test('deleting an item', async () => {
  answerAlertWith('Cancel');
  const db = await renderApp({ seed });
  await press('Next');
  await press('Milk, Acme');
  await press('Delete item');
  expect(await db.items.count().exec()).toBe(1);

  answerAlertWith('Delete');
  await press('Delete item');
  expect(await screen.findByText('No items yet')).toBeOnTheScreen();
  expect(await db.items.count().exec()).toBe(0);
});

test('an item whose stores were all deleted shows that', async () => {
  await renderApp({
    seed: async (db) => {
      await seed(db);
      await db.items.findOne('i1').patch({ locations: [] });
    },
  });
  await press('Next');
  expect(await screen.findByText('No store selected')).toBeOnTheScreen();
});

test('the item form explains when there are no stores', async () => {
  await renderApp({ initialUrl: '/setup/item-form' });
  expect(await screen.findByText(/add a store first/)).toBeOnTheScreen();
});

test.each([
  ['/setup/store-form?id=missing', 'Store not found', '/setup'],
  ['/setup/item-form?id=missing', 'Item not found', '/setup/items'],
])('%s shows a not-found message and goes back', async (initialUrl, message, back) => {
  await renderApp({ initialUrl });
  expect(await screen.findByText(message)).toBeOnTheScreen();
  await press('Back');
  // Opened directly, so there is no history: back replaces with the parent screen.
  await waitFor(() => expect(screen).toHavePathname(back));
});

test('save errors are shown to the user', async () => {
  const db = await renderApp({ seed });
  jest.spyOn(db.stores, 'insert').mockRejectedValue(new Error('nope'));
  jest.spyOn(db.items, 'insert').mockRejectedValue(new Error('nope'));

  await press('Add a store');
  await type('Store name', 'Fails');
  await addDepartments('Deli');
  await press('Save');
  expect(await screen.findByText('Could not save this store. Please try again.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

  await press('Cancel');
  await press('Next');
  await press('Add an item');
  await type('Item name', 'Eggs');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Big Box' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Frozen in Big Box' }));
  await press('Continue');
  expect(await screen.findByText('Could not save this item. Please try again.')).toBeOnTheScreen();
  expect(screen).toHavePathname('/setup/item-form');
});

test('adding a duplicate or blank department shows an error', async () => {
  await renderApp();
  await press('Add a store');
  await addDepartments('Produce');

  await press('Add department');
  expect(await screen.findByText('Enter a department name.')).toBeOnTheScreen();

  await type('New department', 'produce');
  expect(screen.queryByText('Enter a department name.')).toBeNull();
  await fireEvent(screen.getByLabelText('New department'), 'submitEditing');
  expect(await screen.findByText('"produce" is already in the list.')).toBeOnTheScreen();
});

test('typing a new department suggests ones from other stores; tapping fills it in', async () => {
  await renderApp({
    seed: async (db) => {
      await db.stores.insert({
        id: 's1',
        name: 'Corner Market',
        departments: [
          { id: 'd1', name: 'Bakery' },
          { id: 'd2', name: 'Deli' },
        ],
        createdAt: 1,
      });
      await db.stores.insert({ id: 's2', name: 'Big Box', departments: [{ id: 'd3', name: 'Bakery' }], createdAt: 2 });
      await db.stores.insert({ id: 's3', name: 'Co-op', departments: [{ id: 'd4', name: 'Bakery' }], createdAt: 3 });
    },
  });
  await press('Add a store');
  await addDepartments('Deli');

  // Nothing until typing; then matching departments from other stores.
  expect(screen.queryByText('From your stores, tap to fill in:')).toBeNull();
  await type('New department', 'bak');

  // Three stores have "Bakery", but it's offered once.
  expect(await screen.findAllByRole('button', { name: 'Use Bakery' })).toHaveLength(1);
  const suggestion = screen.getByRole('button', { name: 'Use Bakery' });
  expect(suggestion).toHaveProp('accessibilityHint', 'Fills in the name; then tap Add. Used at Corner Market, Big Box, Co-op.');
  expect(screen.getByText('Corner Market, Big Box, Co-op')).toBeOnTheScreen();

  // Tapping fills the box but doesn't add yet; the suggestion is no longer offered.
  await fireEvent.press(suggestion);
  expect(screen.getByLabelText('New department')).toHaveDisplayValue('Bakery');
  expect(screen.queryByRole('button', { name: 'Remove Bakery' })).toBeNull();
  expect(screen.queryByText('From your stores, tap to fill in:')).toBeNull();

  // Add adds it and clears the box.
  await press('Add department');
  expect(screen.getByRole('button', { name: 'Remove Bakery' })).toBeOnTheScreen();
  expect(screen.getByLabelText('New department')).toHaveDisplayValue('');

  // Departments already in the list aren't suggested (Deli and Bakery were just added).
  await type('New department', 'del');
  expect(screen.queryByRole('button', { name: 'Use Deli' })).toBeNull();
  await type('New department', 'bak');
  expect(screen.queryByRole('button', { name: 'Use Bakery' })).toBeNull();
});

test('a lowercase match still offers the existing spelling', async () => {
  await renderApp({
    seed: async (db) => {
      await db.stores.insert({ id: 's1', name: 'Shop', departments: [{ id: 'd1', name: 'Bakery' }], createdAt: 1 });
    },
  });
  await press('Add a store');
  await type('New department', 'bakery');
  await press('Use Bakery');
  expect(screen.getByLabelText('New department')).toHaveDisplayValue('Bakery');
});

test('adding a typed name that matches another store reuses its spelling', async () => {
  await renderApp({
    seed: async (db) => {
      await db.stores.insert({ id: 's1', name: 'Shop', departments: [{ id: 'd1', name: 'Bulk Bins' }], createdAt: 1 });
    },
  });
  await press('Add a store');
  await type('New department', '  bulk   BINS ');
  await press('Add department');
  expect(await screen.findByRole('button', { name: 'Remove Bulk Bins' })).toBeOnTheScreen();
});
