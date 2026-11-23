import { router } from 'expo-router';
import { act, cleanup, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import type { AppDatabase } from '@/db/database';
import {
  addDepartments,
  answerAlertWith,
  departmentActions,
  moveDepartment,
  press,
  renderApp,
  type,
} from '@/test-utils/app';
import * as storesRepo from '@/data/stores-repo';
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

test('editing a store updates it and removes item locations for deleted departments', async () => {
  const alert = answerAlertWith('Remove and save');
  const db = await renderApp({ seed });

  await press(/^Corner Market, Main St\./);
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

  // Milk is in the Deli, so removing it asks first.
  expect(alert).toHaveBeenCalledWith(
    'Remove departments with items?',
    '1 item in Deli will no longer be listed under Corner Mkt.',
    expect.any(Array),
  );
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

  await press(/^Corner Market, Main St\./);
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
  await press(/^Milk, Acme\./);
  expect(screen).toHavePathnameWithParams('/setup/item-form?id=i1');
  expect(screen.getByLabelText('Item name')).toHaveDisplayValue('Milk');
  expect(screen.getByRole('radio', { name: 'Deli in Corner Market' })).toBeChecked();
  // Edit mode uses Save/Cancel instead of Add more/Continue.
  expect(screen.queryByRole('button', { name: 'Add more' })).toBeNull();

  await type('Brand/Distinguisher', '');
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
  await press(/^Milk, Acme\./);

  await type('Item name', ' ');
  await press('Save');
  expect(await screen.findByText('Item name is required.')).toBeOnTheScreen();

  const alert = answerAlertWith('Leave');
  await press('Cancel');
  expect(alert).toHaveBeenCalledWith('Leave without saving?', expect.stringContaining('item'), expect.any(Array));
  expect(await screen.findByText('Milk')).toBeOnTheScreen();
  expect((await db.items.findOne('i1').exec())?.name).toBe('Milk');
});

test('deleting an item', async () => {
  answerAlertWith('Cancel');
  const db = await renderApp({ seed });
  await press('Next');
  await press(/^Milk, Acme\./);
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

  answerAlertWith('Leave');
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

test('removing departments with items asks first; keeping editing saves nothing', async () => {
  const alert = answerAlertWith('Keep editing');
  const db = await renderApp({ seed });
  await press(/^Corner Market, Main St\./);

  // Produce has no items: removing it alone wouldn't ask. Deli has Milk.
  await press('Remove Produce');
  await press('Remove Deli');
  await addDepartments('Deli');
  await press('Save');

  // Deli was added back, but as a new, empty department.
  expect(alert).toHaveBeenCalledWith(
    'Remove departments with items?',
    '1 item in Deli will no longer be listed under Corner Market. A department added back with the same name starts out empty; its items aren’t moved to it.',
    expect.any(Array),
  );
  expect(screen).toHavePathnameWithParams('/setup/store-form?id=s1');
  expect((await db.stores.findOne('s1').exec())?.departments).toHaveLength(2);
});

test('removing only departments without items saves without asking', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const db = await renderApp({ seed });
  await press(/^Corner Market, Main St\./);
  await press('Remove Produce');
  await press('Save');

  expect(await screen.findByText('Deli')).toBeOnTheScreen();
  expect(alert).not.toHaveBeenCalled();
  expect((await db.stores.findOne('s1').exec())?.departments).toEqual([{ id: 'd2', name: 'Deli' }]);
});

test('deleting a store says how many items it takes out', async () => {
  const alert = answerAlertWith('Cancel');
  await renderApp({
    seed: async (db) => {
      await seed(db);
      await db.stores.insert({ id: 's3', name: 'Co-op', departments: [{ id: 'd4', name: 'Bulk' }], createdAt: 3 });
      await db.items.insert({ id: 'i2', name: 'Bread', locations: [{ storeId: 's1', departmentId: 'd1' }], createdAt: 2 });
    },
  });

  await press(/^Corner Market, Main St\./);
  await press('Delete store');
  expect(alert).toHaveBeenLastCalledWith(
    'Delete Corner Market?',
    '2 items will no longer be listed under this store.',
    expect.any(Array),
  );

  await press('Cancel');
  await press(/^Co-op\./);
  await press('Delete store');
  expect(alert).toHaveBeenLastCalledWith('Delete Co-op?', 'No items are listed under this store.', expect.any(Array));
});

test('going back from a form with unsaved changes asks first', async () => {
  const alert = answerAlertWith('Keep editing');
  await renderApp({ seed });
  await press(/^Corner Market, Main St\./);
  await type('Store name', 'Renamed');

  // As the header's back button, a back swipe or Android's back button would.
  await act(() => router.back());
  expect(alert).toHaveBeenCalledWith('Leave without saving?', expect.any(String), expect.any(Array));
  expect(screen.getByLabelText('Store name')).toHaveDisplayValue('Renamed');

  answerAlertWith('Leave');
  await act(() => router.back());
  expect(await screen.findByText('Corner Market')).toBeOnTheScreen();
  expect(screen).toHavePathname('/setup');
});

test('a failed delete is reported', async () => {
  const alert = answerAlertWith('Delete');
  const db = await renderApp({ seed });
  const failingRemove = { remove: () => Promise.reject(new Error('nope')) };

  jest.spyOn(db.stores, 'findOne').mockReturnValue(failingRemove as never);
  await press(/^Corner Market, Main St\./);
  await press('Delete store');
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith(WRITE_FAILED_TITLE, 'Could not delete Corner Market. Please try again.'),
  );
  expect(screen).toHavePathname('/setup');

  jest.spyOn(db.items, 'findOne').mockReturnValue(failingRemove as never);
  await press('Next');
  await press(/^Milk, Acme\./);
  await press('Delete item');
  await waitFor(() => expect(alert).toHaveBeenCalledWith(WRITE_FAILED_TITLE, 'Could not delete Milk. Please try again.'));
});

test('a missing department can be added from the item form, and is chosen for the item', async () => {
  const db = await renderApp({ seed });
  await press('Next');
  await press(/^Milk, Acme\./);

  await press('Add a department to Corner Market');
  await type('New department at Corner Market', '  Dairy ');
  await press('Add department to Corner Market');

  expect(await screen.findByRole('radio', { name: 'Dairy in Corner Market' })).toBeChecked();
  expect(
    screen.getByText('Added Dairy at the end of Corner Market’s departments. You can move it on the store’s page.'),
  ).toBeOnTheScreen();
  // The field closes; the store now has the department, at the end of its walking order.
  expect(screen.queryByLabelText('New department at Corner Market')).toBeNull();
  const store = await db.stores.findOne('s1').exec();
  expect(store?.departments.map((d) => d.name)).toEqual(['Produce', 'Deli', 'Dairy']);

  await press('Save');
  expect(await screen.findByText('Corner Market · Dairy, Big Box · Frozen')).toBeOnTheScreen();
  const dairy = store?.departments[2].id;
  expect((await db.items.findOne('i1').exec())?.toJSON().locations).toContainEqual({ storeId: 's1', departmentId: dairy });
});

test('adding a department the store already has from the item form just chooses it', async () => {
  const db = await renderApp({ seed });
  await press('Next');
  await press(/^Milk, Acme\./);

  await press('Add a department to Corner Market');
  await type('New department at Corner Market', 'produce');
  await fireEvent(screen.getByLabelText('New department at Corner Market'), 'submitEditing');

  expect(await screen.findByRole('radio', { name: 'Produce in Corner Market' })).toBeChecked();
  expect(screen.getByText('Corner Market already has Produce, so it’s chosen.')).toBeOnTheScreen();
  expect((await db.stores.findOne('s1').exec())?.departments).toHaveLength(2);
});

test('adding a department from the item form shows problems, and can be cancelled', async () => {
  await renderApp({ seed });
  await press('Next');
  await press(/^Milk, Acme\./);

  await press('Add a department to Big Box');
  await press('Add department to Big Box');
  expect(await screen.findByText('Enter a department name.')).toBeOnTheScreen();
  // Typing clears the error.
  await type('New department at Big Box', 'Bakery');
  expect(screen.queryByText('Enter a department name.')).toBeNull();

  jest.spyOn(storesRepo, 'addStoreDepartment').mockRejectedValue(new Error('nope'));
  await press('Add department to Big Box');
  expect(await screen.findByText('Could not add the department. Please try again.')).toBeOnTheScreen();

  await press('Cancel adding a department');
  expect(screen.queryByLabelText('New department at Big Box')).toBeNull();
  expect(screen.getByRole('button', { name: 'Add a department to Big Box' })).toBeOnTheScreen();
});

test('a department name the store already has, added since the form opened, is refused', async () => {
  await renderApp({ seed });
  await press('Next');
  await press(/^Milk, Acme\./);
  jest
    .spyOn(storesRepo, 'addStoreDepartment')
    .mockResolvedValue({ ok: false, error: '"Bakery" is already in the list.' });

  await press('Add a department to Big Box');
  await type('New department at Big Box', 'Bakery');
  await press('Add department to Big Box');
  expect(await screen.findByText('"Bakery" is already in the list.')).toBeOnTheScreen();
});

test('saving an item with the same name and brand as another asks first', async () => {
  const db = await renderApp({ seed });
  await press('Next');
  await press('Add an item');
  await type('Item name', ' milk ');
  await type('Brand/Distinguisher', 'ACME');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Big Box' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Frozen in Big Box' }));

  const alert = answerAlertWith('Keep editing');
  await press('Continue');
  expect(alert).toHaveBeenCalledWith(
    'Already in your list',
    'Milk (Acme) is already in your list. Save another one anyway?',
    expect.any(Array),
  );
  // Still on the form, and nothing saved.
  expect(screen.getByLabelText('Item name')).toHaveDisplayValue(' milk ');
  expect(await db.items.count().exec()).toBe(1);

  answerAlertWith('Save anyway');
  await press('Continue');
  await waitFor(async () => expect(await db.items.count().exec()).toBe(2));
  expect(screen).toHavePathname('/setup/items');
});

test('editing an item without making it a duplicate saves without asking', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const db = await renderApp({ seed });
  await press('Next');
  await press(/^Milk, Acme\./);
  // Milk matches only itself.
  await press('Save');
  expect(await screen.findByText('Corner Market · Deli, Big Box · Frozen')).toBeOnTheScreen();
  expect(alert).not.toHaveBeenCalled();
  expect(await db.items.count().exec()).toBe(1);
});

test('a store can’t have the same name and location as another', async () => {
  const db = await renderApp({ seed });
  await press('Add a store');
  await type('Store name', 'corner market');
  await type('Location', 'MAIN ST');
  await addDepartments('Deli');
  await press('Save');
  expect(
    await screen.findByText('You already have Corner Market at Main St. Use a different location to tell them apart.'),
  ).toBeOnTheScreen();

  // A different location tells them apart.
  await type('Location', 'Elm St');
  expect(screen.queryByText(/You already have/)).toBeNull();
  await press('Save');
  await waitFor(async () => expect(await db.stores.count().exec()).toBe(3));
});

test('name fields are limited to the longest name allowed', async () => {
  await renderApp({ seed });
  await press('Add a store');
  expect(screen.getByLabelText('Store name')).toHaveProp('maxLength', 100);
  expect(screen.getByLabelText('Location')).toHaveProp('maxLength', 100);
  expect(screen.getByLabelText('New department')).toHaveProp('maxLength', 100);
});

test('the duplicate warning names an item without a brand by its name alone', async () => {
  const alert = answerAlertWith('Keep editing');
  await renderApp({
    seed: async (db) => {
      await seed(db);
      await db.items.insert({ id: 'i2', name: 'Bread', locations: [{ storeId: 's2', departmentId: 'd3' }], createdAt: 2 });
    },
  });
  await press('Next');
  await press('Add an item');
  await type('Item name', 'bread');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Big Box' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Frozen in Big Box' }));
  await press('Add more');
  expect(alert).toHaveBeenCalledWith(
    'Already in your list',
    'Bread is already in your list. Save another one anyway?',
    expect.any(Array),
  );
});

test('screen readers hear where each item is on the setup items list', async () => {
  await renderApp({ seed });
  await press('Next');
  expect(
    await screen.findByRole('button', { name: 'Milk, Acme. Deli at Corner Market, Frozen at Big Box.' }),
  ).toBeOnTheScreen();
});

test('screen titles and form sections are headings, so screen readers can jump between them', async () => {
  await renderApp({ seed });
  expect(await screen.findByRole('header', { name: 'Where do you shop?' })).toBeOnTheScreen();

  await press(/^Corner Market, Main St\./);
  expect(await screen.findByRole('header', { name: 'Departments' })).toBeOnTheScreen();
  await press('Cancel');

  await press('Next');
  expect(await screen.findByRole('header', { name: 'What do you usually buy?' })).toBeOnTheScreen();
  await press('Add an item');
  expect(await screen.findByRole('header', { name: 'Where to find it' })).toBeOnTheScreen();
});
