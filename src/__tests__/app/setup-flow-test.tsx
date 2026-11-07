import { cleanup, fireEvent, screen } from 'expo-router/testing-library';
import { firstValueFrom } from 'rxjs';

import { observeSetupComplete } from '@/data/settings-repo';
import { observeStores } from '@/data/stores-repo';
import { addDepartments, dragDepartment, moveDepartment, press, renderApp, type } from '@/test-utils/app';
import { closeTestDatabases } from '@/test-utils/db';

jest.mock('@/db/database', () => ({
  ...jest.requireActual('@/db/database'),
  getAppDatabase: jest.fn(),
}));

afterEach(async () => {
  await cleanup();
  // renderRouter enables fake timers; RxDB needs real ones to shut down.
  jest.useRealTimers();
  await closeTestDatabases();
});

test('a fresh install starts on the empty store setup screen', async () => {
  await renderApp();

  expect(await screen.findByText('No stores yet')).toBeOnTheScreen();
  expect(screen).toHavePathname('/setup');
  expect(screen.getByText(/add, edit, or remove stores and items at any time/)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Skip for now' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
});

test('adding a store with custom, reordered departments', async () => {
  const db = await renderApp();

  await press('Add a store');
  expect(screen).toHavePathname('/setup/store-form');

  // A new store starts with no departments, and shows an example of what to add.
  expect(screen.getByText('No departments yet. For example: Produce, Deli, Frozen.')).toBeOnTheScreen();
  expect(screen.queryByLabelText(/^Reorder /)).toBeNull();
  await addDepartments('Produce', 'Deli', 'Frozen');
  expect(screen.queryByText(/No departments yet/)).toBeNull();

  // Name is required.
  await press('Save');
  expect(await screen.findByText('Store name is required.')).toBeOnTheScreen();
  expect(screen).toHavePathname('/setup/store-form');

  await type('Store name', '  Corner   Market ');
  await type('Location', 'Main St');
  await press('Remove Deli');
  // Reorder with the screen-reader actions on the drag handle...
  await moveDepartment('Produce', 'down');
  await moveDepartment('Produce', 'up');
  await type('New department', 'Bakery');
  await press('Add department');
  // ...and by dragging: Produce, Frozen, Bakery → drop Bakery in the middle.
  await dragDepartment(2, 1);
  await press('Save');

  // Back on the store list, which now shows the store and a Next button.
  expect(await screen.findByText('Corner Market')).toBeOnTheScreen();
  expect(screen).toHavePathname('/setup');
  expect(screen.getByText('Main St')).toBeOnTheScreen();
  expect(screen.getByText('Produce → Bakery → Frozen')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Next' })).toBeOnTheScreen();
  expect(screen.queryByText(/at any time/)).toBeNull();

  const [store] = await firstValueFrom(observeStores(db));
  expect(store).toMatchObject({ name: 'Corner Market', location: 'Main St' });
  expect(store.departments.map((d) => d.name)).toEqual(['Produce', 'Bakery', 'Frozen']);
});

test('cancel leaves the store list unchanged', async () => {
  const db = await renderApp();

  await press('Add a store');
  await type('Store name', 'Never saved');
  await press('Cancel');

  expect(await screen.findByText('No stores yet')).toBeOnTheScreen();
  expect(await firstValueFrom(observeStores(db))).toEqual([]);
});

test('skipping store setup goes straight to the main app', async () => {
  const db = await renderApp();

  await press('Skip for now');

  expect(await screen.findByText('No stores to shop at yet')).toBeOnTheScreen();
  expect(screen).toHavePathname('/');
  expect(await firstValueFrom(observeSetupComplete(db))).toBe(true);
});

test('the full setup: store, items with add more / continue, back, finish', async () => {
  await renderApp();

  await press('Add a store');
  await type('Store name', 'Corner Market');
  await addDepartments('Produce', 'Deli', 'Frozen');
  await press('Save');
  await screen.findByText('Corner Market');
  // renderRouter freezes the clock; move it so stores sort in creation order.
  jest.setSystemTime(Date.now() + 1000);
  await press('Add a store');
  await type('Store name', 'Big Box');
  await addDepartments('Produce', 'Deli', 'Frozen');
  await press('Save');
  await screen.findByText('Big Box');

  await press('Next');
  expect(screen).toHavePathname('/setup/items');
  expect(await screen.findByText('No items yet')).toBeOnTheScreen();
  expect(screen.getByText(/at any time/)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Skip for now' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Finish' })).toBeNull();

  await press('Add an item');
  expect(screen).toHavePathname('/setup/item-form');

  // Everything is validated.
  await press('Add more');
  expect(await screen.findByText('Item name is required.')).toBeOnTheScreen();
  expect(screen.getByText('Choose at least one store.')).toBeOnTheScreen();

  await type('Item name', 'Milk');
  await type('Brand', 'Organic Valley');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Corner Market' }));
  await press('Add more');
  expect(await screen.findByText('Choose a department in Corner Market.')).toBeOnTheScreen();
  // Departments are offered A–Z here, not in the store's walking order (Produce, Deli, Frozen).
  expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual([
    'Deli in Corner Market',
    'Frozen in Corner Market',
    'Produce in Corner Market',
  ]);

  await fireEvent.press(screen.getByRole('radio', { name: 'Deli in Corner Market' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Big Box' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Frozen in Big Box' }));
  await press('Add more');

  // Saved, and the form is fresh.
  expect(await screen.findByText(/Saved “Milk”/)).toBeOnTheScreen();
  expect(screen.getByLabelText('Item name')).toHaveDisplayValue('');
  expect(screen.getByRole('checkbox', { name: 'Corner Market' })).not.toBeChecked();

  await type('Item name', 'Bananas');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Big Box' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Produce in Big Box' }));
  await press('Continue');

  // The list shows both, alphabetically, with where to find them.
  expect(await screen.findByText('Bananas')).toBeOnTheScreen();
  expect(screen).toHavePathname('/setup/items');
  expect(screen.getByText('Milk')).toBeOnTheScreen();
  expect(screen.getByText('Organic Valley')).toBeOnTheScreen();
  expect(screen.getByText('Corner Market · Deli, Big Box · Frozen')).toBeOnTheScreen();
  expect(screen.getByText('Big Box · Produce')).toBeOnTheScreen();
  expect(screen.queryByText(/at any time/)).toBeNull();

  // Back to stores keeps the items.
  await press('Back');
  expect(await screen.findByText('Where do you shop?')).toBeOnTheScreen();
  expect(screen).toHavePathname('/setup');
  await press('Next');
  expect(await screen.findByText('Bananas')).toBeOnTheScreen();

  await press('Finish');
  expect(await screen.findByText('Where are you shopping?')).toBeOnTheScreen();
  expect(screen).toHavePathname('/');
});

test('continue on an untouched form just goes back', async () => {
  const db = await renderApp({
    seed: async (d) => {
      await d.stores.insert({ id: 's1', name: 'Shop', departments: [{ id: 'd1', name: 'Deli' }], createdAt: 1 });
    },
  });

  await press('Next');
  await press('Add an item');
  await press('Continue');

  expect(await screen.findByText('No items yet')).toBeOnTheScreen();
  expect(await db.items.count().exec()).toBe(0);
});

test('a store with no departments cannot be saved', async () => {
  await renderApp();
  await press('Add a store');
  await type('Store name', 'Empty');
  await press('Save');
  expect(await screen.findByText(/Add at least one department/)).toBeOnTheScreen();

  // Removing the last department brings the example back.
  await addDepartments('Deli');
  await press('Remove Deli');
  expect(screen.getByText('No departments yet. For example: Produce, Deli, Frozen.')).toBeOnTheScreen();
});

test('returning users with setup complete land in the main app', async () => {
  await renderApp({
    seed: async (db) => {
      await db.settings.insert({ id: 'app', setupComplete: true });
    },
  });
  expect(await screen.findByText('No stores to shop at yet')).toBeOnTheScreen();
  expect(screen).toHavePathname('/');
});

test('setup screens are not reachable once setup is complete', async () => {
  await renderApp({
    initialUrl: '/setup/store-form',
    seed: async (db) => {
      await db.settings.insert({ id: 'app', setupComplete: true });
    },
  });
  expect(await screen.findByText('No stores to shop at yet')).toBeOnTheScreen();
});

test('shows a message if the database fails to open', async () => {
  const { getAppDatabase } = jest.requireMock('@/db/database');
  jest.mocked(getAppDatabase).mockRejectedValue(new Error('disk full'));
  const { renderRouter } = jest.requireActual('expo-router/testing-library');
  await renderRouter('./src/app');
  expect(await screen.findByText('disk full')).toBeOnTheScreen();
});

test('launches in dark mode', async () => {
  const spy = jest.spyOn(jest.requireActual('react-native'), 'useColorScheme').mockReturnValue('dark');
  await renderApp();
  expect(await screen.findByText('No stores yet')).toBeOnTheScreen();
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});
