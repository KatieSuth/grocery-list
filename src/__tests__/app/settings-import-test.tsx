import { router } from 'expo-router';
import { act, cleanup, fireEvent, screen, within } from 'expo-router/testing-library';
import { Alert, Appearance, type AlertButton } from 'react-native';

import type { AppDatabase } from '@/db/database';
import { eventually, renderApp } from '@/test-utils/app';
import { closeTestDatabases } from '@/test-utils/db';
import { pickCsvFile } from '@/utils/pick-csv-file';

jest.mock('@/db/database', () => ({
  ...jest.requireActual('@/db/database'),
  getAppDatabase: jest.fn(),
}));
// The system file picker can't run in Jest; each test says what the user picked.
jest.mock('@/utils/pick-csv-file', () => ({ pickCsvFile: jest.fn() }));
const picks = (result: Awaited<ReturnType<typeof pickCsvFile>>) => jest.mocked(pickCsvFile).mockResolvedValue(result);
const picksCsv = (...lines: string[]) => picks({ status: 'picked', text: lines.join('\n') });

beforeEach(() => {
  jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
});

afterEach(async () => {
  jest.restoreAllMocks();
  await cleanup();
  jest.useRealTimers();
  await closeTestDatabases();
});

async function seed(db: AppDatabase) {
  await db.settings.insert({ id: 'app', setupComplete: true });
  await db.stores.insert({ id: 's1', name: 'Kroger', departments: [{ id: 'd1', name: 'Dairy' }], createdAt: 1 });
  await db.items.insert({ id: 'i1', name: 'Milk', locations: [{ storeId: 's1', departmentId: 'd1' }], createdAt: 1 });
}

const settings = () => within(screen.getByTestId('settings-screen'));

/** Opens Settings and taps Import; resolves once the import has run as far as it will. */
async function importFile() {
  await act(() => router.navigate('/settings'));
  await fireEvent.press(await settings().findByRole('button', { name: 'Import from CSV' }));
  await act(async () => {});
}

/** Records every Alert, answering with the button named `answer` (if any). */
function alerts(answer?: string) {
  const shown: { title?: string | null; message?: string | null }[] = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons?: AlertButton[]) => {
    shown.push({ title, message });
    buttons?.find((b) => b.text === answer)?.onPress?.();
  });
  return shown;
}

const snapshot = async (db: AppDatabase) => ({
  stores: (await db.stores.find().exec()).map((d) => d.toJSON()),
  items: (await db.items.find().exec()).map((d) => d.toJSON()),
});

test('importing a CSV asks first, then adds the stores, departments and items', async () => {
  const shown = alerts('Import');
  picksCsv('Store,Item name,Department,Brand', 'Kroger,Milk,Dairy', 'Kroger,Bread,Bakery,Acme', 'Aldi,Apples,Produce');
  const db = await renderApp({ seed });
  await importFile();

  expect(shown[0]).toEqual({
    title: 'Import from CSV?',
    message:
      'This adds 2 new items, 1 new store and 2 new departments. 1 row is already in your list and will be skipped.',
  });
  await eventually(async () => expect(shown[1]).toEqual({ title: 'Imported', message: 'Added 2 new items, 1 new store and 2 new departments.' }));

  const { stores, items } = await snapshot(db);
  expect(stores.map((s) => [s.name, s.departments.map((d) => d.name)])).toEqual([
    ['Kroger', ['Dairy', 'Bakery']],
    ['Aldi', ['Produce']],
  ]);
  expect(items.map((i) => i.name).sort()).toEqual(['Apples', 'Bread', 'Milk']);

  // The new things show up in the app.
  await act(() => router.navigate('/'));
  expect(await screen.findByText('Kroger · Bakery')).toBeOnTheScreen();
  expect(screen.getByText('Aldi · Produce')).toBeOnTheScreen();
});

test('canceling the question imports nothing', async () => {
  const shown = alerts('Cancel');
  picksCsv('Aldi,Apples,Produce');
  const db = await renderApp({ seed });
  const before = await snapshot(db);
  await importFile();

  expect(shown.map((a) => a.title)).toEqual(['Import from CSV?']);
  expect(await snapshot(db)).toEqual(before);
});

test('a file with problems is explained and nothing is imported', async () => {
  const shown = alerts('Import');
  picksCsv('Kroger,Bread,Bakery', ',Eggs,Dairy', 'Kroger,Milk,Produce');
  const db = await renderApp({ seed });
  const before = await snapshot(db);
  await importFile();

  expect(shown).toEqual([{ title: 'Can’t import this file', message: 'Row 2: Store is empty.\n\nNothing was imported.' }]);
  expect(await snapshot(db)).toEqual(before);

  // Once each row is fine, a clash with an item already in the app is caught too.
  picksCsv('Kroger,Bread,Bakery', 'Kroger,Milk,Produce');
  shown.length = 0;
  await fireEvent.press(settings().getByRole('button', { name: 'Import from CSV' }));
  await act(async () => {});
  expect(shown).toEqual([
    {
      title: 'Can’t import this file',
      message:
        'Row 2: “Milk” is already in “Dairy” at “Kroger”, not “Produce”. An item can be in only one department per store.\n\nNothing was imported.',
    },
  ]);
  expect(await snapshot(db)).toEqual(before);
});

test('a file that couldn’t be read is explained; canceling the picker does nothing', async () => {
  const shown = alerts();
  picks({ status: 'error', message: 'The file is too big. Import files of up to 1 MB.' });
  await renderApp({ seed });
  await importFile();
  expect(shown).toEqual([{ title: 'Can’t import this file', message: 'The file is too big. Import files of up to 1 MB.' }]);

  shown.length = 0;
  picks({ status: 'canceled' });
  await fireEvent.press(settings().getByRole('button', { name: 'Import from CSV' }));
  await act(async () => {});
  expect(shown).toEqual([]);
});

test('a file with nothing new says so instead of asking', async () => {
  const shown = alerts('Import');
  picksCsv('kroger,MILK,dairy');
  await renderApp({ seed });
  await importFile();
  expect(shown).toEqual([{ title: 'Nothing new to import', message: 'Everything in this file is already in your list.' }]);
});

test('if picking or saving fails, the settings screen says so', async () => {
  alerts('Import');
  jest.mocked(pickCsvFile).mockRejectedValue(new Error('picker crashed'));
  const db = await renderApp({ seed });
  await importFile();
  expect(settings().getByText('Could not import that file. Please try again.')).toBeOnTheScreen();

  picksCsv('Aldi,Apples,Produce');
  jest.spyOn(db.stores, 'bulkInsert').mockRejectedValue(new Error('disk full'));
  await fireEvent.press(settings().getByRole('button', { name: 'Import from CSV' }));
  expect(
    await settings().findByText('Could not finish the import. Some of it may have been saved; check your stores and items.')
  ).toBeOnTheScreen();
  expect(settings().getByRole('button', { name: 'Import from CSV' })).toBeEnabled();
});
