import { router } from 'expo-router';
import { act, cleanup, fireEvent, screen, within } from 'expo-router/testing-library';
import { Alert, Appearance, type AlertButton } from 'react-native';

import { Colors } from '@/constants/theme';
import type { AppDatabase } from '@/db/database';
import { eventually, renderApp } from '@/test-utils/app';
import { closeTestDatabases } from '@/test-utils/db';

jest.mock('@/db/database', () => ({
  ...jest.requireActual('@/db/database'),
  getAppDatabase: jest.fn(),
}));

let setNativeScheme: jest.SpyInstance;

beforeEach(() => {
  setNativeScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
});

afterEach(async () => {
  jest.restoreAllMocks();
  await cleanup();
  jest.useRealTimers();
  await closeTestDatabases();
});

async function seed(db: AppDatabase, colorScheme?: 'light' | 'dark') {
  await db.settings.insert({ id: 'app', setupComplete: true, ...(colorScheme ? { colorScheme } : {}) });
  await db.stores.insert({ id: 's1', name: 'Corner Market', departments: [{ id: 'd1', name: 'Deli' }], createdAt: 1 });
  await db.items.insert({ id: 'i1', name: 'Ham', locations: [{ storeId: 's1', departmentId: 'd1' }], createdAt: 1 });
  await db.listEntries.insert({ itemId: 'i1', checkedAt: 2 });
}

/** The native tab bar isn't rendered in Jest, so switch tabs the way a tab press does. */
const openSettings = () => act(() => router.navigate('/settings'));

/** Queries limited to the Settings screen (native tabs keep the other tabs mounted in Jest). */
const settings = () => within(screen.getByTestId('settings-screen'));

const background = () => screen.getByTestId('settings-screen');

/** Waits for deleted items to be purged from storage (not just marked deleted). */
const purged = (db: AppDatabase) =>
  eventually(async () => expect(await db.items.storageInstance.findDocumentsById(['i1'], true)).toHaveLength(0));

/** Answers every Alert by pressing the button with the given text; returns the spy. */
function answerAlertsWith(text: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((b) => b.text === text)?.onPress?.();
  });
}

test('the settings tab offers system, light and dark appearance, following the system by default', async () => {
  const db = await renderApp({ seed: (db) => seed(db) });
  await openSettings();

  expect(screen).toHavePathname('/settings');
  expect(await settings().findByText('Appearance')).toBeOnTheScreen();
  expect(settings().getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual([
    'Match system appearance',
    'Light mode',
    'Dark mode',
    'Default sort: name',
    'Default sort: department',
    'Default sort: last bought',
    'Default order: A to Z',
    'Default order: Z to A',
  ]);
  expect(settings().getByRole('radio', { name: 'Match system appearance' })).toBeChecked();
  expect(settings().getByText('Follows your device’s light or dark setting.')).toBeOnTheScreen();
  // Jest's device is light.
  expect(background()).toHaveStyle({ backgroundColor: Colors.light.background });
  expect(setNativeScheme).toHaveBeenLastCalledWith('unspecified');

  await fireEvent.press(settings().getByRole('radio', { name: 'Dark mode' }));
  await eventually(async () => expect(background()).toHaveStyle({ backgroundColor: Colors.dark.background }));
  expect(settings().getByRole('radio', { name: 'Dark mode' })).toBeChecked();
  expect(settings().getByText('Always dark, whatever your device is set to.')).toBeOnTheScreen();
  expect(setNativeScheme).toHaveBeenLastCalledWith('dark');
  expect((await db.settings.findOne('app').exec())?.colorScheme).toBe('dark');

  await fireEvent.press(settings().getByRole('radio', { name: 'Light mode' }));
  await eventually(async () => expect(setNativeScheme).toHaveBeenLastCalledWith('light'));
  expect(background()).toHaveStyle({ backgroundColor: Colors.light.background });

  await fireEvent.press(settings().getByRole('radio', { name: 'Match system appearance' }));
  await eventually(async () => expect(setNativeScheme).toHaveBeenLastCalledWith('unspecified'));
  expect((await db.settings.findOne('app').exec())?.colorScheme).toBe('system');
});

test('a saved choice is applied when the app opens', async () => {
  await renderApp({ seed: (db) => seed(db, 'dark') });
  await openSettings();
  expect(await settings().findByRole('radio', { name: 'Dark mode' })).toBeChecked();
  expect(background()).toHaveStyle({ backgroundColor: Colors.dark.background });
  expect(setNativeScheme).toHaveBeenCalledWith('dark');
});

test('deleting all data asks first, then erases everything and starts setup again', async () => {
  const db = await renderApp({ seed: (db) => seed(db, 'dark') });
  await openSettings();

  // Cancelling keeps everything.
  const cancel = answerAlertsWith('Cancel');
  await fireEvent.press(await settings().findByRole('button', { name: 'Delete all data' }));
  expect(cancel).toHaveBeenCalledWith(
    'Delete all data?',
    'This permanently deletes your stores, items, shopping list and trip history from this device, then starts setup again. It can’t be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete everything', style: 'destructive', onPress: expect.any(Function) },
    ],
  );
  expect(await db.items.count().exec()).toBe(1);
  expect(screen).toHavePathname('/settings');

  answerAlertsWith('Delete everything');
  await fireEvent.press(settings().getByRole('button', { name: 'Delete all data' }));

  expect(await screen.findByText('No stores yet')).toBeOnTheScreen();
  expect(screen).toHavePathname('/setup');
  expect(await db.stores.count().exec()).toBe(0);
  expect(await db.items.count().exec()).toBe(0);
  expect(await db.listEntries.count().exec()).toBe(0);
  await purged(db);
  // The appearance choice is kept.
  expect((await db.settings.findOne('app').exec())?.colorScheme).toBe('dark');
});

test('if deleting fails, it says so and can be tried again', async () => {
  const db = await renderApp({ seed: (db) => seed(db) });
  await openSettings();
  jest.spyOn(db.items, 'bulkRemove').mockResolvedValueOnce({ success: [], error: [{} as never] });
  answerAlertsWith('Delete everything');

  await fireEvent.press(await settings().findByRole('button', { name: 'Delete all data' }));
  expect(await settings().findByText('Could not delete all of your data. Please try again.')).toBeOnTheScreen();
  expect(settings().getByRole('button', { name: 'Delete all data' })).toBeEnabled();
  expect(screen).toHavePathname('/settings');

  await fireEvent.press(settings().getByRole('button', { name: 'Delete all data' }));
  expect(await screen.findByText('No stores yet')).toBeOnTheScreen();
  await purged(db);
});

test('the items list’s default sort can be chosen; it’s remembered and the Items tab opens that way', async () => {
  const db = await renderApp({
    seed: async (d) => {
      await seed(d);
      await d.items.insert({ id: 'i2', name: 'Apples', locations: [{ storeId: 's1', departmentId: 'd1' }], createdAt: 2 });
    },
  });
  await openSettings();

  // By name, A–Z, until changed.
  expect(await settings().findByRole('radio', { name: 'Default sort: name' })).toBeChecked();
  expect(settings().getByRole('radio', { name: 'Default order: A to Z' })).toBeChecked();
  expect(settings().getByText(/How the Items tab is sorted when it opens/)).toBeOnTheScreen();

  await fireEvent.press(settings().getByRole('radio', { name: 'Default sort: last bought' }));
  await eventually(async () => expect((await db.settings.findOne('app').exec())?.itemSort).toBe('lastBought'));
  // The order's names follow the sort.
  expect(settings().getByRole('radio', { name: 'Default order: Newest first' })).toBeChecked();

  await fireEvent.press(settings().getByRole('radio', { name: 'Default order: Oldest first' }));
  await eventually(async () => expect((await db.settings.findOne('app').exec())?.itemSortDirection).toBe('desc'));
  expect(settings().getByRole('radio', { name: 'Default sort: last bought' })).toBeChecked();

  // The Items tab now shows last bought, oldest first.
  await act(() => router.navigate('/'));
  expect(await screen.findByRole('button', { name: 'Sort and filter, by last bought, Oldest first' })).toBeOnTheScreen();
});

test('delete all data keeps the default sort', async () => {
  answerAlertsWith('Delete everything');
  const db = await renderApp({
    seed: async (d) => {
      await seed(d);
      await d.settings.findOne('app').patch({ itemSort: 'department', itemSortDirection: 'desc' });
    },
  });
  await openSettings();
  await fireEvent.press(await settings().findByRole('button', { name: 'Delete all data' }));
  await purged(db);
  expect((await db.settings.findOne('app').exec())?.toJSON()).toEqual({
    id: 'app',
    setupComplete: false,
    itemSort: 'department',
    itemSortDirection: 'desc',
  });
});
