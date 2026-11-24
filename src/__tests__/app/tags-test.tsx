import { router } from 'expo-router';
import { act, cleanup, fireEvent, screen, within } from 'expo-router/testing-library';
import { AccessibilityInfo, Platform } from 'react-native';

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

const DAY = 24 * 60 * 60 * 1000;

async function seed(db: AppDatabase) {
  await db.settings.insert({ id: 'app', setupComplete: true, tripStoreId: 'corner' });
  await db.stores.insert({
    id: 'corner',
    name: 'Corner Market',
    departments: [{ id: 'deli', name: 'Deli' }],
    createdAt: 1,
  });
  const at = [{ storeId: 'corner', departmentId: 'deli' }];
  await db.items.insert({ id: 'milk', name: 'Milk', locations: at, tags: ['Work'], createdAt: 1 });
  await db.items.insert({ id: 'ham', name: 'Ham', locations: at, tags: ['Patient', 'Work'], createdAt: 2 });
  await db.items.insert({ id: 'peas', name: 'Peas', locations: at, createdAt: 3 });
  await db.listEntries.insert({ itemId: 'milk', checkedAt: 1 });
  await db.trips.insert({
    id: 'tagged',
    storeId: 'corner',
    storeName: 'Corner Market',
    finishedAt: Date.now() - DAY,
    items: [{ itemId: 'ham', name: 'Ham', department: 'Deli', tags: ['Patient'] }],
  });
  // Logged before tags existed: Ham had none then.
  await db.trips.insert({
    id: 'untagged',
    storeId: 'corner',
    storeName: 'Corner Market',
    finishedAt: Date.now() - 2 * DAY,
    items: [{ itemId: 'ham', name: 'Ham', department: 'Deli' }],
  });
}

const tagsOf = async (db: AppDatabase, id: string) => (await db.items.findOne(id).exec())?.toJSON().tags;

test('tags can be added from suggestions or by typing, removed, and are saved', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  const db = await renderApp({ seed, initialUrl: '/item-form?id=peas' });
  expect(await screen.findByRole('header', { name: 'Tags (optional)' })).toBeOnTheScreen();

  // Tags on other items are offered while typing, and added with one tap.
  await type('New tag', 'wo');
  // The suggestions are kept above the keyboard with the field.
  await fireEvent(screen.getByLabelText('Tags on your other items'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 120 } },
  });
  const suggestion = screen.getByRole('button', { name: 'Add tag Work' });
  expect(suggestion).toHaveProp('accessibilityHint', 'Used on 2 items.');
  await fireEvent.press(suggestion);
  expect(screen.getByRole('button', { name: 'Remove tag Work' })).toBeOnTheScreen();
  expect(screen.getByText('Added tag Work.')).toBeOnTheScreen();
  if (Platform.OS === 'ios') expect(announce).toHaveBeenCalledWith('Added tag Work.');
  expect(screen.getByLabelText('New tag')).toHaveDisplayValue('');
  // Already on the item, so not offered again.
  await type('New tag', 'w');
  expect(screen.queryByRole('button', { name: 'Add tag Work' })).toBeNull();

  // Typed in another case: it's the same tag.
  await type('New tag', 'WORK');
  await press('Add tag');
  expect(screen.getByText('“Work” is already added.')).toBeOnTheScreen();
  // A typed tag matching one used elsewhere keeps that spelling; Return adds it too.
  await type('New tag', ' patient ');
  await fireEvent(screen.getByLabelText('New tag'), 'submitEditing');
  expect(screen.getByRole('button', { name: 'Remove tag Patient' })).toBeOnTheScreen();
  await type('New tag', 'Errands');
  await press('Add tag');

  await press('Remove tag Work');
  expect(screen.queryByRole('button', { name: 'Remove tag Work' })).toBeNull();
  expect(screen.getByText('Removed tag Work.')).toBeOnTheScreen();

  await press('Save');
  await eventually(async () => expect(await tagsOf(db, 'peas')).toEqual(['Patient', 'Errands']));

  // Removing them all saves no tags at all.
  await act(() => router.push('/item-form?id=peas'));
  await press('Remove tag Patient');
  await press('Remove tag Errands');
  await press('Save');
  await eventually(async () => expect(await tagsOf(db, 'peas')).toBeUndefined());
});

test('changing tags counts as an unsaved change', async () => {
  const alert = answerAlertWith('Keep editing');
  await renderApp({ seed, initialUrl: '/item-form?id=milk' });
  await press('Remove tag Work');
  await press('Cancel');
  expect(alert).toHaveBeenCalledWith('Leave without saving?', expect.stringContaining('item'), expect.any(Array));
});

test('the items list shows and says each item’s tags, and can be filtered by them', async () => {
  await renderApp({ seed });
  const ham = await screen.findByRole('button', { name: /^Ham\. Tags: Patient, Work\. / });
  expect(within(ham).getByText('Patient · Work')).toBeOnTheScreen();
  // An item without tags says nothing about them.
  expect(screen.getByRole('button', { name: /^Peas\. / }).props.accessibilityLabel).not.toMatch(/Tags/);

  await press(/^Sort and filter/);
  await press('Tags');
  expect(screen.getAllByRole('checkbox', { name: /^Tags: / }).map((c) => c.props.accessibilityLabel)).toEqual([
    'Tags: Patient',
    'Tags: Work',
  ]);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Tags: Patient' }));
  expect(screen.queryByRole('checkbox', { name: 'Milk' })).toBeNull();
  expect(screen.getByRole('checkbox', { name: 'Ham' })).toBeOnTheScreen();
});

test('the shopping trip shows tags, and finishing saves them with the trip', async () => {
  answerAlertWith('Finish trip');
  const db = await renderApp({ seed, initialUrl: '/trip' });
  const milk = await screen.findByRole('checkbox', { name: 'Milk, Tags: Work' });
  expect(within(milk).getByText('Work')).toBeOnTheScreen();
  await fireEvent.press(milk);
  await eventually(async () => expect(screen.getByRole('button', { name: 'Finish trip' })).toBeEnabled());
  await press('Finish trip');
  await eventually(async () => expect(await db.trips.count().exec()).toBe(3));
  const latest = (await db.trips.find({ sort: [{ finishedAt: 'desc' }] }).exec())[0].toJSON();
  expect(latest.items).toEqual([{ itemId: 'milk', name: 'Milk', department: 'Deli', tags: ['Work'] }]);
});

test('trip history can be filtered by the tags items had then, and shows them on the trip', async () => {
  await renderApp({ seed, initialUrl: '/trip/history' });
  const history = () => within(screen.getByTestId('trip-history'));
  const trips = () => history().queryAllByRole('button', { name: /^Corner Market\. / });
  await history().findByText('2 trips, last 90 days');
  expect(trips()).toHaveLength(2);

  await fireEvent.press(history().getByRole('button', { name: /^Filter trips, / }));
  await fireEvent.press(history().getByRole('button', { name: 'Tags' }));
  // Only tags saved with trips: Work was never on a bought item then.
  expect(history().getAllByRole('checkbox', { name: /^Tags: / }).map((c) => c.props.accessibilityLabel)).toEqual([
    'Tags: Patient',
  ]);
  await fireEvent.press(history().getByRole('checkbox', { name: 'Tags: Patient' }));
  expect(trips()).toHaveLength(1);
  expect(history().getByRole('button', { name: /^Filter trips, last 90 days, 1 filter on/ })).toBeOnTheScreen();

  await fireEvent.press(trips()[0]);
  const item = await screen.findByTestId('trip-item');
  expect(item).toHaveProp('accessibilityLabel', 'Ham, Deli, Tags: Patient');
  expect(within(item).getByText('Patient')).toBeOnTheScreen();
});

test('a tag typed but not added is saved too, or blocks saving if it can’t be', async () => {
  const db = await renderApp({ seed, initialUrl: '/item-form?id=peas' });
  await type('New tag', 'Work; Home');
  await press('Save');
  expect(await screen.findByText('A tag can’t contain “;”.')).toBeOnTheScreen();
  expect(screen).toHavePathnameWithParams('/item-form?id=peas');
  expect(await tagsOf(db, 'peas')).toBeUndefined();

  await type('New tag', ' errands ');
  await press('Save');
  await eventually(async () => expect(await tagsOf(db, 'peas')).toEqual(['errands']));
});

test('a tag typed but not added counts as an unsaved change', async () => {
  const alert = answerAlertWith('Keep editing');
  await renderApp({ seed, initialUrl: '/item-form?id=peas' });
  await type('New tag', 'Errands');
  await press('Cancel');
  expect(alert).toHaveBeenCalledWith('Leave without saving?', expect.any(String), expect.any(Array));
});

test('Add more starts the next item with no tags and a clear tag section', async () => {
  const db = await renderApp({ seed, initialUrl: '/item-form' });
  await type('Item name', 'Soap');
  await fireEvent.press(await screen.findByRole('checkbox', { name: 'Corner Market' }));
  await fireEvent.press(await screen.findByRole('radio', { name: 'Deli in Corner Market' }));
  await type('New tag', 'Work');
  await press('Add tag');
  expect(screen.getByText('Added tag Work.')).toBeOnTheScreen();
  // Typed but not added: saved with the item.
  await type('New tag', 'Errands');
  await press('Add more');

  expect(await screen.findByText(/^Saved “Soap”/)).toBeOnTheScreen();
  const soap = (await db.items.find({ selector: { name: 'Soap' } }).exec())[0];
  expect(soap.toJSON().tags).toEqual(['Work', 'Errands']);
  expect(screen.queryByRole('button', { name: /^Remove tag / })).toBeNull();
  expect(screen.queryByText('Added tag Work.')).toBeNull();
  expect(screen.getByLabelText('New tag')).toHaveDisplayValue('');
});

test('after a tag is removed, the screen reader moves to the next tag, or to the field after the last', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  await renderApp({ seed, initialUrl: '/item-form?id=ham' });
  const focused = () => {
    const [target, event] = focus.mock.calls.at(-1) ?? [];
    expect(event).toBe('focus');
    return String((target as unknown as { props?: Record<string, unknown> })?.props?.accessibilityLabel);
  };
  await press('Remove tag Patient');
  expect(focused()).toBe('Remove tag Work');
  await press('Remove tag Work');
  expect(focused()).toBe('New tag');
});
