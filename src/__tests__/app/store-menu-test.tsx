import { router } from 'expo-router';
import { act, cleanup, fireEvent, screen, within } from 'expo-router/testing-library';
import { Alert, Platform } from 'react-native';

import * as storesRepo from '@/data/stores-repo';
import type { AppDatabase } from '@/db/database';
import { addDepartments, answerAlertWith, eventually, press, renderApp, type } from '@/test-utils/app';
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
    id: 'k1',
    name: 'Kroger',
    location: 'Main St',
    departments: [
      { id: 'prod', name: 'Produce' },
      { id: 'deli', name: 'Deli' },
      { id: 'bake', name: 'Bakery' },
    ],
    createdAt: 1,
  });
  await db.stores.insert({ id: 'b1', name: 'Big Box', departments: [{ id: 'froz', name: 'Frozen' }], createdAt: 2 });
  const item = (id: string, name: string, locations: [string, string][], createdAt: number) =>
    db.items.insert({
      id,
      name,
      locations: locations.map(([storeId, departmentId]) => ({ storeId, departmentId })),
      createdAt,
    });
  await item('kale', 'Kale', [['k1', 'prod']], 1);
  await item('ham', 'Ham', [['k1', 'deli']], 2);
  await item('bread', 'Bread', [['k1', 'bake'], ['b1', 'froz']], 3);
  await item('peas', 'Peas', [['b1', 'froz']], 4);
}

const krogerCard = () => screen.findByRole('button', { name: /^Kroger, Main St\./ });
const openMenu = async () => fireEvent(await krogerCard(), 'longPress');
/** Chooses a menu option. On iOS the option runs once the menu has finished closing. */
const pressMenuItem = async (name: string) => {
  const item = await screen.findByRole('menuitem', { name });
  let modal = item;
  while (modal.type !== 'Modal' && modal.parent) modal = modal.parent;
  // (Grabbed now: the test renderer's Modal goes as soon as it's hidden.)
  const finishClosing = modal.props.onDismiss as () => void;
  await fireEvent.press(item);
  if (Platform.OS === 'ios') await act(async () => finishClosing());
};
const menuItems = () => screen.getAllByRole('menuitem').map((el) => el.props.accessibilityLabel as string);

const locationsOf = async (db: AppDatabase, id: string) =>
  (await db.items.findOne(id).exec())?.toJSON().locations ?? [];

test('a store says it has more options, and long-pressing it shows them', async () => {
  await renderApp({ seed, initialUrl: '/stores' });
  const card = await krogerCard();
  expect(card.props.accessibilityHint).toBe('Edit this store. Long-press for more options.');
  expect((card.props.accessibilityActions as { label: string }[]).map((a) => a.label)).toEqual([
    'More options',
    'Copy store',
    'Delete store',
  ]);

  await openMenu();
  expect(screen.getByLabelText('Options for Kroger, Main St')).toHaveProp('accessibilityRole', 'menu');
  expect(menuItems()).toEqual(['Edit Kroger, Main St', 'Copy Kroger, Main St', 'Delete Kroger, Main St']);
  expect(within(screen.getByLabelText('Options for Kroger, Main St')).getByText('Copy store')).toBeOnTheScreen();

  // Tapping outside closes it, as does the screen reader's escape gesture (or Back, which does the same).
  await fireEvent.press(screen.getByTestId('store-menu-backdrop', { includeHiddenElements: true }));
  expect(screen.queryByLabelText(/^Options for/)).toBeNull();
  await fireEvent(await krogerCard(), 'accessibilityAction', { nativeEvent: { actionName: 'longpress' } });
  expect(screen.getByLabelText('Options for Kroger, Main St')).toBeOnTheScreen();
  await fireEvent(screen.getByLabelText('Options for Kroger, Main St'), 'accessibilityEscape');
  expect(screen.queryByLabelText(/^Options for/)).toBeNull();
  expect(screen).toHavePathname('/stores');
});

test('Edit opens the store, as tapping it does', async () => {
  await renderApp({ seed, initialUrl: '/stores' });
  await openMenu();
  await pressMenuItem('Edit Kroger, Main St');
  expect(screen.queryByLabelText(/^Options for/)).toBeNull();
  expect(screen).toHavePathnameWithParams('/store-form?id=k1');
  expect(screen.getByLabelText('Store name')).toHaveDisplayValue('Kroger');
});

test('Delete asks first, as on the store form, then deletes the store', async () => {
  const alert = answerAlertWith('Delete');
  const db = await renderApp({ seed, initialUrl: '/stores' });
  await openMenu();
  await pressMenuItem('Delete Kroger, Main St');
  expect(alert).toHaveBeenCalledWith(
    'Delete Kroger?',
    '3 items will no longer be listed under this store.',
    expect.any(Array),
  );
  await eventually(async () => expect(await db.stores.findOne('k1').exec()).toBeNull());
  expect(await screen.findByRole('button', { name: /^Big Box\./ })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /^Kroger/ })).toBeNull();
});

test('while a store is being deleted from the menu, a spinner covers the list until it is done', async () => {
  answerAlertWith('Delete');
  const db = await renderApp({ seed, initialUrl: '/stores' });
  const remove = storesRepo.deleteStore;
  let finish: () => void = () => {};
  jest.spyOn(storesRepo, 'deleteStore').mockImplementation(async (...args) => {
    await new Promise<void>((resolve) => (finish = resolve));
    return remove(...args);
  });
  await openMenu();
  await pressMenuItem('Delete Kroger, Main St');
  // Another delete can't be started meanwhile, even before the spinner appears.
  const alert = jest.mocked(Alert.alert);
  alert.mockClear();
  await fireEvent(await screen.findByRole('button', { name: /^Big Box\./ }), 'accessibilityAction', {
    nativeEvent: { actionName: 'delete' },
  });
  expect(alert).not.toHaveBeenCalled();
  expect(await screen.findByLabelText(/^Deleting store… Please keep the app open/)).toBeOnTheScreen();

  await act(async () => finish());
  await eventually(async () => expect(await db.stores.findOne('k1').exec()).toBeNull());
  await eventually(async () => expect(screen.queryByLabelText(/^Deleting store/)).toBeNull());
  expect(screen).toHavePathname('/stores');
});

test('a failed delete from the menu is said on the Stores tab', async () => {
  answerAlertWith('Delete');
  jest.spyOn(storesRepo, 'deleteStore').mockRejectedValueOnce(new Error('disk full'));
  const db = await renderApp({ seed, initialUrl: '/stores' });
  await openMenu();
  await pressMenuItem('Delete Kroger, Main St');
  expect(await screen.findByText('Could not delete Kroger. Please try again.')).toBeOnTheScreen();
  expect(screen.queryByLabelText(/^Deleting store/)).toBeNull();
  expect(await db.stores.findOne('k1').exec()).not.toBeNull();

  // Trying again clears it.
  await openMenu();
  await pressMenuItem('Delete Kroger, Main St');
  await eventually(async () => expect(await db.stores.findOne('k1').exec()).toBeNull());
  expect(screen.queryByText(/^Could not delete/)).toBeNull();
});

test("screen readers can copy or delete a store straight from its row's actions", async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await renderApp({ seed, initialUrl: '/stores' });
  await fireEvent(await krogerCard(), 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
  expect(alert).toHaveBeenCalledWith('Delete Kroger?', expect.any(String), expect.any(Array));
  await fireEvent(await krogerCard(), 'accessibilityAction', { nativeEvent: { actionName: 'copy' } });
  expect(screen).toHavePathnameWithParams('/store-form?copyFrom=k1');
});

test('Copy starts a new store with the departments and the option to copy items', async () => {
  await renderApp({ seed, initialUrl: '/stores' });
  await openMenu();
  await pressMenuItem('Copy Kroger, Main St');
  expect(screen).toHavePathnameWithParams('/store-form?copyFrom=k1');
  expect(screen.getByText('Copying Kroger, Main St. Give the new store its own name or location.')).toBeOnTheScreen();
  expect(screen.getByLabelText('Store name')).toHaveDisplayValue('');
  expect(screen.getByLabelText('Location, optional')).toHaveDisplayValue('');
  expect(screen.getAllByLabelText(/^Reorder /).map((el) => el.props.accessibilityLabel)).toEqual([
    expect.stringMatching(/^Reorder Produce,/),
    expect.stringMatching(/^Reorder Deli,/),
    expect.stringMatching(/^Reorder Bakery,/),
  ]);
  const copyItems = screen.getByRole('switch', { name: 'Copy items from Kroger, Main St' });
  expect(copyItems).toBeChecked();
  expect(copyItems.props.accessibilityHint).toMatch(/^The 3 items listed under Kroger will also be listed/);
  // No Delete when copying.
  expect(screen.queryByRole('button', { name: 'Delete store' })).toBeNull();
});

test('a copy needs its own name and location, and says so as soon as they match a store', async () => {
  const save = jest.spyOn(storesRepo, 'copyStore');
  await renderApp({ seed, initialUrl: '/store-form?copyFrom=k1' });
  await screen.findByLabelText('Store name');
  // Nothing to complain about before anything is typed.
  expect(screen.queryByText(/already have/)).toBeNull();

  // Kroger has a location, so a Kroger without one is a different store.
  await type('Store name', 'kroger');
  expect(screen.queryByText(/already have/)).toBeNull();
  await type('Location, optional', ' main st ');
  expect(
    await screen.findByText('You already have Kroger at Main St. Use a different location to tell them apart.'),
  ).toBeOnTheScreen();
  await press('Save');
  expect(save).not.toHaveBeenCalled();

  await type('Location, optional', 'Elm St');
  expect(screen.queryByText(/already have/)).toBeNull();
});

test("saving a copy lists the source's items under it, except in departments removed for good", async () => {
  const db = await renderApp({ seed, initialUrl: '/store-form?copyFrom=k1' });
  await type('Store name', 'Kroger');
  await type('Location, optional', 'Elm St');
  // Bakery is removed for good; Deli is removed and added back.
  await press('Remove Bakery');
  await press('Remove Deli');
  await addDepartments(' deli ');
  await press('Save');

  await eventually(async () => expect(await db.stores.count().exec()).toBe(3));
  expect(screen).toHavePathname('/stores');
  const copy = (await db.stores.find({ selector: { location: 'Elm St' } }).exec())[0].toJSON();
  expect(copy.departments.map((d) => d.name)).toEqual(['Produce', 'Deli']);
  const [produce, deli] = copy.departments;
  await eventually(async () =>
    expect(await locationsOf(db, 'kale')).toEqual([
      { storeId: 'k1', departmentId: 'prod' },
      { storeId: copy.id, departmentId: produce.id },
    ]),
  );
  expect(await locationsOf(db, 'ham')).toEqual([
    { storeId: 'k1', departmentId: 'deli' },
    { storeId: copy.id, departmentId: deli.id },
  ]);
  expect(await locationsOf(db, 'bread')).toEqual([
    { storeId: 'k1', departmentId: 'bake' },
    { storeId: 'b1', departmentId: 'froz' },
  ]);
  expect(await locationsOf(db, 'peas')).toEqual([{ storeId: 'b1', departmentId: 'froz' }]);
  expect(await db.items.count().exec()).toBe(4);
});

test('with Copy items off, the copy starts with no items', async () => {
  const db = await renderApp({ seed, initialUrl: '/store-form?copyFrom=b1' });
  const copyItems = await screen.findByRole('switch', { name: 'Copy items from Big Box' });
  expect(copyItems.props.accessibilityHint).toMatch(/^The 2 items listed under Big Box/);
  await fireEvent.press(copyItems);
  expect(screen.getByRole('switch', { name: 'Copy items from Big Box' })).not.toBeChecked();
  await type('Location, optional', 'Elm St');
  await type('Store name', 'Big Box');
  await press('Save');
  await eventually(async () => expect(await db.stores.count().exec()).toBe(3));
  expect(await locationsOf(db, 'peas')).toEqual([{ storeId: 'b1', departmentId: 'froz' }]);
});

test('copying a store with no items says so, and a failed save can be tried again', async () => {
  jest.spyOn(storesRepo, 'copyStore').mockRejectedValueOnce(new Error('disk full'));
  await renderApp({
    seed: async (db) => {
      await seed(db);
      await db.stores.insert({ id: 'e1', name: 'Empty', departments: [{ id: 'x', name: 'Aisle 1' }], createdAt: 3 });
    },
    initialUrl: '/store-form?copyFrom=e1',
  });
  expect(await screen.findByRole('switch', { name: 'Copy items from Empty' })).toHaveProp(
    'accessibilityHint',
    'Empty has no items yet.',
  );
  await type('Store name', 'Empty 2');
  await press('Save');
  expect(await screen.findByText('Could not copy this store. Please try again.')).toBeOnTheScreen();
  await press('Save');
  await act(async () => {});
  expect(screen).toHavePathname('/stores');
});

test('copying a store that no longer exists says so', async () => {
  await renderApp({ seed, initialUrl: '/store-form?copyFrom=gone' });
  expect(await screen.findByText('Store not found')).toBeOnTheScreen();
});

test('the copy carries on if its source is deleted meanwhile, copying no items', async () => {
  const db = await renderApp({ seed, initialUrl: '/store-form?copyFrom=k1' });
  await type('Store name', 'Kroger');
  await act(() => storesRepo.deleteStore(db, 'k1'));
  // Still the copy form, with the departments it started with.
  expect(screen.getByRole('switch', { name: 'Copy items from Kroger, Main St' })).toBeOnTheScreen();
  await press('Save');
  await eventually(async () => expect(await db.stores.count().exec()).toBe(2));
  expect(await locationsOf(db, 'kale')).toEqual([]);
});

test('while a copy is being saved, a spinner keeps the form open until it is done', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const db = await renderApp({ seed, initialUrl: '/stores' });
  // Hold the copy up once the new store is saved, while its items are written.
  const write = db.items.bulkUpsert.bind(db.items);
  let finish: () => void = () => {};
  jest.spyOn(db.items, 'bulkUpsert').mockImplementation(async (docs) => {
    await new Promise<void>((resolve) => (finish = resolve));
    return write(docs);
  });
  await openMenu();
  await pressMenuItem('Copy Kroger, Main St');
  await type('Store name', 'Kroger');
  await type('Location, optional', 'Elm St');
  await press('Save');

  expect(await screen.findByLabelText(/^Copying store… Please keep the app open/)).toBeOnTheScreen();
  expect(await db.stores.count().exec()).toBe(3);
  // The new store isn't mistaken for one with the same name and location.
  expect(screen.queryByText(/already have/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  // Back (or a swipe) does nothing, and doesn't offer to discard the copy.
  await act(() => router.back());
  expect(screen).toHavePathnameWithParams('/store-form?copyFrom=k1');
  expect(alert).not.toHaveBeenCalled();

  await act(async () => finish());
  await eventually(async () => expect(await locationsOf(db, 'kale')).toHaveLength(2));
  expect(screen).toHavePathname('/stores');
  expect(screen.queryByLabelText(/^Copying store/)).toBeNull();
});

test('a copy that fails and can’t be undone says to check the store', async () => {
  jest
    .spyOn(storesRepo, 'copyStore')
    .mockRejectedValueOnce(new storesRepo.CopyNotUndoneError(new Error('disk full')));
  await renderApp({ seed, initialUrl: '/store-form?copyFrom=k1' });
  await type('Store name', ' Kroger ');
  await type('Location, optional', 'Elm St');
  await press('Save');
  expect(
    await screen.findByText('The copy was only partly saved, and couldn’t be undone. Check Kroger on the Stores tab.'),
  ).toBeOnTheScreen();
});
