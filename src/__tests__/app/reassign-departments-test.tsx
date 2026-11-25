import { router } from 'expo-router';
import { act, cleanup, fireEvent, screen, within } from 'expo-router/testing-library';
import { AccessibilityInfo, Alert, Platform } from 'react-native';

import * as storesRepo from '@/data/stores-repo';
import type { AppDatabase } from '@/db/database';
import { answerAlertWith, eventually, press, renderApp, type } from '@/test-utils/app';
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
    departments: [
      { id: 'prod', name: 'Produce' },
      { id: 'deli', name: 'Deli' },
      { id: 'froz', name: 'Frozen' },
    ],
    createdAt: 1,
  });
  await db.stores.insert({
    id: 'b1',
    name: 'Big Box',
    location: 'Main St',
    departments: [
      { id: 'bd', name: 'Deli' },
      { id: 'bs', name: 'Snacks' },
    ],
    createdAt: 2,
  });
  await db.items.insert({
    id: 'ham',
    name: 'Ham',
    brand: 'Acme',
    tags: ['Work'],
    locations: [
      { storeId: 'k1', departmentId: 'deli' },
      { storeId: 'b1', departmentId: 'bd' },
    ],
    createdAt: 1,
  });
  await db.items.insert({ id: 'soup', name: 'Soup', locations: [{ storeId: 'k1', departmentId: 'deli' }], createdAt: 2 });
  await db.items.insert({ id: 'kale', name: 'Kale', locations: [{ storeId: 'k1', departmentId: 'prod' }], createdAt: 3 });
}

const locationsOf = async (db: AppDatabase, id: string) => (await db.items.findOne(id).exec())?.toJSON().locations;
const field = (item: string) => screen.getByRole('button', { name: new RegExp(`^Department at Kroger for ${item}: `) });
/** The department options in the open list (titled "Department for <item>"), in order. */
const options = (item: string) => {
  let modal = screen.getByRole('header', { name: `Department for ${item}` });
  while (modal.type !== 'Modal' && modal.parent) modal = modal.parent;
  return within(modal)
    .getAllByRole('button')
    .map((b) => b.props.accessibilityLabel as string)
    .filter((label) => !label.startsWith('Cancel'));
};

/** Chooses `option` for `item`. On iOS, the list then finishes closing (so the dialog can open). */
async function choose(item: string, option: string) {
  await fireEvent.press(field(item));
  const button = await screen.findByRole('button', { name: option });
  let modal = button;
  while (modal.type !== 'Modal' && modal.parent) modal = modal.parent;
  // (Grabbed now: the test renderer's Modal goes as soon as it's hidden.)
  const finishClosing = modal.props.onDismiss as () => void;
  await fireEvent.press(button);
  if (Platform.OS === 'ios') await act(async () => finishClosing());
}

/** Presses a button that closes its list or dialog; on iOS, the modal then finishes closing. */
async function pressClosing(name: string) {
  const button = await screen.findByRole('button', { name });
  let modal = button;
  while (modal.type !== 'Modal' && modal.parent) modal = modal.parent;
  const finishClosing = modal.props.onDismiss as () => void;
  await fireEvent.press(button);
  if (Platform.OS === 'ios') await act(async () => finishClosing());
}

/** Opens Kroger's form, removes Deli (Ham and Soup are in it) and taps Save. */
async function openReassign() {
  const db = await renderApp({ seed, initialUrl: '/stores' });
  await press(/^Kroger\./);
  await press('Remove Deli');
  await press('Save');
  await screen.findByRole('header', { name: 'Reassign 2 items from Deli' });
  return db;
}

const lastFocused = (focus: jest.SpyInstance) => {
  const [target, event] = focus.mock.calls.at(-1) ?? [];
  expect(event).toBe('focus');
  return String((target as { props?: Record<string, unknown> })?.props?.accessibilityLabel);
};

test('removing a department with items shows each item, with where else it is and a department to choose', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  await openReassign();
  expect(lastFocused(focus)).toBe('Reassign 2 items from Deli');
  expect(screen.getByText(/^Deli has 2 items at Kroger\. Deleting it takes them off Kroger\./)).toBeOnTheScreen();
  expect(screen.getByText(/will be left with no store: they stay in your Items list/)).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'From Deli, 2 items' })).toBeOnTheScreen();
  expect(screen.getByLabelText('Ham, Acme. Tags: Work. Also at Big Box, Main St.')).toBeOnTheScreen();
  expect(screen.getByLabelText('Soup. Only at Kroger.')).toBeOnTheScreen();
  expect(field('Ham')).toHaveProp('accessibilityLabel', 'Department at Kroger for Ham: Select');
  expect(field('Ham')).toHaveProp('accessibilityHint', 'Opens the list of departments');
  expect(field('Ham')).not.toBeExpanded();
  // Kale isn't in Deli.
  expect(screen.queryByLabelText(/^Kale/)).toBeNull();

  await fireEvent.press(field('Ham'));
  expect(field('Ham')).toBeExpanded();
  expect(screen.getByRole('header', { name: 'Department for Ham' })).toBeOnTheScreen();
  // A–Z, with New department… last.
  expect(options('Ham')).toEqual(['Frozen', 'Produce', 'New department…']);
  expect(screen.getByRole('button', { name: 'New department…' })).toHaveProp(
    'accessibilityHint',
    'Add a department to Kroger for this item',
  );
  await pressClosing('Cancel choosing a department for Ham');
  expect(lastFocused(focus)).toBe('Department at Kroger for Ham: Select');
});

test('a chosen department is shown, and marked as chosen in the list', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  await openReassign();
  await choose('Ham', 'Produce');
  expect(field('Ham')).toHaveProp('accessibilityLabel', 'Department at Kroger for Ham: Produce');
  expect(lastFocused(focus)).toBe('Department at Kroger for Ham: Produce');
  await fireEvent.press(field('Ham'));
  expect(screen.getByRole('button', { name: 'Produce' })).toBeSelected();
  expect(screen.getByRole('button', { name: 'Frozen' })).not.toBeSelected();
});

test('New department… asks for a name, checking it as it’s typed, and chooses the new department', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  await openReassign();
  await choose('Soup', 'New department…');
  expect(field('Soup')).toHaveProp('accessibilityLabel', 'Department at Kroger for Soup: New department…');
  expect(screen.getByRole('header', { name: 'New department at Kroger' })).toBeOnTheScreen();
  expect(lastFocused(focus)).toBe('Department name');

  // Blank: only said once Add is tapped.
  expect(screen.queryByText('Enter a department name.')).toBeNull();
  await press('Add department');
  expect(screen.getByText('Enter a department name.')).toBeOnTheScreen();
  // Already at the store (in any case): said while typing, and Add is refused.
  await type('Department name', 'produce');
  expect(screen.getByText('"produce" is already in the list.')).toBeOnTheScreen();
  await press('Add department');
  expect(screen.getByRole('header', { name: 'New department at Kroger' })).toBeOnTheScreen();

  await type('Department name', ' bakery ');
  expect(screen.queryByText(/already in the list/)).toBeNull();
  await pressClosing('Add department');
  expect(screen.queryByRole('header', { name: 'New department at Kroger' })).toBeNull();
  expect(field('Soup')).toHaveProp('accessibilityLabel', 'Department at Kroger for Soup: bakery');
  expect(screen.getByText('Added bakery at the end of Kroger’s departments.')).toBeOnTheScreen();
  expect(lastFocused(focus)).toBe('Department at Kroger for Soup: bakery');

  // Offered for the other items too, in A–Z order, New department… still last.
  await fireEvent.press(field('Ham'));
  expect(options('Ham')).toEqual(['bakery', 'Frozen', 'Produce', 'New department…']);
});

test('a name used at another store keeps that spelling; cancelling the dialog goes back to Select', async () => {
  await openReassign();
  await choose('Ham', 'Produce');
  await choose('Ham', 'New department…');
  // Deli is being removed, so it can't be made again here.
  await type('Department name', 'DELI');
  expect(
    screen.getByText('"Deli" is being removed. To keep it, go back to the store and cancel the removal instead.'),
  ).toBeOnTheScreen();
  await press('Add department');
  expect(screen.getByRole('header', { name: 'New department at Kroger' })).toBeOnTheScreen();
  await pressClosing('Cancel adding a department');
  expect(field('Ham')).toHaveProp('accessibilityLabel', 'Department at Kroger for Ham: Select');

  // Big Box spells it "Snacks".
  await choose('Soup', 'New department…');
  await type('Department name', 'snacks');
  expect(screen.queryByText(/is being removed|already in the list/)).toBeNull();
  const dialogModal = (() => {
    let m = screen.getByLabelText('Department name');
    while (m.type !== 'Modal' && m.parent) m = m.parent;
    return m;
  })();
  const finishClosing = dialogModal.props.onDismiss as () => void;
  await fireEvent(screen.getByLabelText('Department name'), 'submitEditing');
  if (Platform.OS === 'ios') await act(async () => finishClosing());
  expect(field('Soup')).toHaveProp('accessibilityLabel', 'Department at Kroger for Soup: Snacks');
});

test('Android’s back button cancels the dialog and the list', async () => {
  await openReassign();
  await choose('Soup', 'New department…');
  const dialog = screen.getByRole('header', { name: 'New department at Kroger' });
  let modal = dialog;
  while (modal.type !== 'Modal' && modal.parent) modal = modal.parent;
  await fireEvent(modal, 'requestClose');
  expect(field('Soup')).toHaveProp('accessibilityLabel', 'Department at Kroger for Soup: Select');
});

test('saving moves each item to its chosen department; a new one goes last in the store’s order', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const db = await openReassign();
  await choose('Ham', 'Produce');
  await choose('Soup', 'New department…');
  await type('Department name', 'Bakery');
  await pressClosing('Add department');
  await press('Reassign items and delete Deli');

  expect(alert).not.toHaveBeenCalled();
  await eventually(async () => expect(screen).toHavePathname('/stores'));
  const kroger = (await db.stores.findOne('k1').exec())?.toJSON();
  expect(kroger?.departments.map((d) => d.name)).toEqual(['Produce', 'Frozen', 'Bakery']);
  const bakery = kroger?.departments[2].id;
  expect(await locationsOf(db, 'ham')).toEqual([
    { storeId: 'k1', departmentId: 'prod' },
    { storeId: 'b1', departmentId: 'bd' },
  ]);
  expect(await locationsOf(db, 'soup')).toEqual([{ storeId: 'k1', departmentId: bakery }]);
  expect(await locationsOf(db, 'kale')).toEqual([{ storeId: 'k1', departmentId: 'prod' }]);
});

test('items left without a department are warned about; keeping reassigning stays, continuing saves', async () => {
  const keep = answerAlertWith('Keep reassigning');
  const db = await openReassign();
  await choose('Ham', 'Produce');
  // Soup is left on "New department…" (the dialog was dismissed by Back).
  await choose('Soup', 'New department…');
  await press('Reassign items and delete Deli');
  expect(keep).toHaveBeenCalledWith(
    '1 item isn’t reassigned',
    'It’ll no longer be listed under Kroger. If it isn’t listed at another store, it will be left with no store, and won’t show up on a shopping trip.',
    expect.any(Array),
  );
  expect(screen.getByRole('header', { name: 'Reassign 2 items from Deli' })).toBeOnTheScreen();
  keep.mockRestore();

  answerAlertWith('Continue');
  await press('Reassign items and delete Deli');
  await eventually(async () => expect(screen).toHavePathname('/stores'));
  expect(await locationsOf(db, 'soup')).toEqual([]);
  expect(await locationsOf(db, 'ham')).toEqual([
    { storeId: 'k1', departmentId: 'prod' },
    { storeId: 'b1', departmentId: 'bd' },
  ]);
});

test('several items unassigned are counted in the warning', async () => {
  const alert = answerAlertWith('Keep reassigning');
  await openReassign();
  await press('Reassign items and delete Deli');
  expect(alert).toHaveBeenCalledWith(
    '2 items aren’t reassigned',
    'They’ll no longer be listed under Kroger. Any that aren’t listed at another store will be left with no store, and won’t show up on a shopping trip.',
    expect.any(Array),
  );
});

test('Cancel, or Back, returns to the form as it was, with nothing saved', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  const alert = jest.spyOn(Alert, 'alert');
  const db = await openReassign();
  await choose('Soup', 'New department…');
  await type('Department name', 'Bakery');
  await pressClosing('Add department');
  await press('Cancel, back to the store');

  expect(screen).toHavePathnameWithParams('/store-form?id=k1');
  expect(screen.getByLabelText('Store name')).toHaveDisplayValue('Kroger');
  // Deli is still removed on the form; Bakery was never added.
  expect(screen.queryByRole('button', { name: 'Remove Deli' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Remove Bakery' })).toBeNull();
  expect(lastFocused(focus)).toBe('Save');
  expect((await db.stores.findOne('k1').exec())?.toJSON().departments).toHaveLength(3);
  expect(await locationsOf(db, 'soup')).toEqual([{ storeId: 'k1', departmentId: 'deli' }]);

  // Saving again starts afresh; Back does the same as Cancel, without asking to leave.
  await press('Save');
  expect(field('Soup')).toHaveProp('accessibilityLabel', 'Department at Kroger for Soup: Select');
  await act(() => router.back());
  expect(screen).toHavePathnameWithParams('/store-form?id=k1');
  expect(screen.getByLabelText('Store name')).toBeOnTheScreen();
  expect(alert).not.toHaveBeenCalled();
});

test('a failed save keeps the choices, so it can be tried again; nothing can be changed while saving', async () => {
  const save = storesRepo.saveStore;
  let fail = true;
  let finish: () => void = () => {};
  jest.spyOn(storesRepo, 'saveStore').mockImplementation(async (...args) => {
    await new Promise<void>((resolve) => (finish = resolve));
    if (fail) throw new Error('disk full');
    return save(...args);
  });
  const db = await openReassign();
  await choose('Ham', 'Produce');
  await choose('Soup', 'Frozen');
  await press('Reassign items and delete Deli');
  expect(await screen.findByLabelText(/^Saving store… /)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Cancel, back to the store' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Reassign items and delete Deli' })).toBeDisabled();
  await act(async () => finish());

  expect(await screen.findByText('Could not save this store. Please try again.')).toBeOnTheScreen();
  expect(field('Soup')).toHaveProp('accessibilityLabel', 'Department at Kroger for Soup: Frozen');
  fail = false;
  await press('Reassign items and delete Deli');
  await act(async () => finish());
  await eventually(async () => expect(await locationsOf(db, 'soup')).toEqual([{ storeId: 'k1', departmentId: 'froz' }]));
});

test('with several departments removed, items are grouped under each', async () => {
  await renderApp({ seed, initialUrl: '/store-form?id=k1' });
  await press('Remove Deli');
  await press('Remove Produce');
  await press('Save');
  expect(await screen.findByRole('header', { name: 'Reassign 3 items from Produce and Deli' })).toBeOnTheScreen();
  expect(screen.getByText(/^Produce and Deli have 3 items at Kroger\. Deleting them takes those items off Kroger\./)).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'From Produce, 1 item' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Reassign items and delete Produce and Deli' })).toBeOnTheScreen();
  expect(screen.getByText('Reassign items & delete')).toBeOnTheScreen();
});

test('a quick double tap saves only once', async () => {
  const save = jest.spyOn(storesRepo, 'saveStore');
  // Continue is tapped twice, before the screen re-renders with the buttons disabled.
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    const go = buttons?.find((b) => b.text === 'Continue')?.onPress;
    go?.();
    go?.();
  });
  await openReassign();
  await press('Reassign items and delete Deli');
  await eventually(async () => expect(screen).toHavePathname('/stores'));
  expect(save).toHaveBeenCalledTimes(1);
});
