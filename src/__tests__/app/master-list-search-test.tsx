import { router } from 'expo-router';
import { act, cleanup, fireEvent, screen, within } from 'expo-router/testing-library';

import type { AppDatabase } from '@/db/database';
import { eventually, press, renderApp, type } from '@/test-utils/app';
import { closeTestDatabases } from '@/test-utils/db';

jest.mock('@/db/database', () => ({
  ...jest.requireActual('@/db/database'),
  getAppDatabase: jest.fn(),
}));

afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
  await closeTestDatabases();
});

async function seed(db: AppDatabase) {
  await db.settings.insert({ id: 'app', setupComplete: true });
  await db.stores.insert({
    id: 'corner',
    name: 'Corner Market',
    departments: [
      { id: 'c-produce', name: 'Produce' },
      { id: 'c-deli', name: 'Deli' },
    ],
    createdAt: 1,
  });
  await db.stores.insert({
    id: 'bigbox',
    name: 'Big Box',
    departments: [
      { id: 'b-deli', name: 'Deli' },
      { id: 'b-frozen', name: 'Frozen' },
    ],
    createdAt: 2,
  });
  const add = (id: string, name: string, brand: string | undefined, storeId: string, departmentId: string) =>
    db.items.insert({ id, name, ...(brand ? { brand } : {}), locations: [{ storeId, departmentId }], createdAt: 1 });
  await add('milk', 'Milk', 'Acme', 'corner', 'c-deli');
  await add('ham', 'Ham', 'acme', 'bigbox', 'b-deli');
  await add('peas', 'Peas', 'Green Giant', 'bigbox', 'b-frozen');
  await add('apples', 'Apples', undefined, 'corner', 'c-produce');
}

const openItems = async () => {
  await act(() => router.navigate('/items'));
  await screen.findByRole('checkbox', { name: 'Milk' });
};

/** Names of the item rows shown (filter chips are checkboxes too, labelled "Group: option"). */
const visibleItems = () =>
  screen
    .queryAllByRole('checkbox')
    .map((c) => c.props.accessibilityLabel as string)
    .filter((label) => !label.includes(': '));

test('the search box narrows the list by item name, and ✕ clears it', async () => {
  await renderApp({ seed });
  await openItems();
  expect(visibleItems()).toEqual(['Apples', 'Ham', 'Milk', 'Peas']);
  expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();

  await type('Search items', 'm');
  expect(visibleItems()).toEqual(['Ham', 'Milk']);
  expect(screen.getByText('Showing 2 of 4 items')).toBeOnTheScreen();

  await type('Search items', 'MILK');
  expect(visibleItems()).toEqual(['Milk']);

  await press('Clear search');
  expect(screen.getByLabelText('Search items')).toHaveDisplayValue('');
  expect(visibleItems()).toEqual(['Apples', 'Ham', 'Milk', 'Peas']);
  expect(screen.queryByText(/^Showing/)).toBeNull();
});

test('a search with no matches offers to clear everything', async () => {
  await renderApp({ seed });
  await openItems();

  await type('Search items', 'acme'); // brands aren't searched
  expect(screen.getByText('No matching items')).toBeOnTheScreen();
  expect(screen.getByText('Showing 0 of 4 items')).toBeOnTheScreen();

  await press('Clear search and filters');
  expect(visibleItems()).toEqual(['Apples', 'Ham', 'Milk', 'Peas']);
});

test('the filter panel lists each store, department and brand once', async () => {
  await renderApp({ seed });
  await openItems();
  expect(screen.queryByText('Departments')).toBeNull();

  await press('Filters');
  expect(screen.getByRole('button', { name: 'Filters' })).toBeExpanded();

  const options = (group: string) =>
    screen
      .queryAllByRole('checkbox', { name: new RegExp(`^${group}: `) })
      .map((c) => (c.props.accessibilityLabel as string).replace(`${group}: `, ''));
  expect(options('Stores')).toEqual(['Corner Market', 'Big Box']);
  // Both stores have a Deli; it appears once.
  expect(options('Departments')).toEqual(['Deli', 'Frozen', 'Produce']);
  // "Acme" and "acme" are one brand.
  expect(options('Brands')).toEqual(['Acme', 'Green Giant']);

  await press('Filters');
  expect(screen.queryByText('Departments')).toBeNull();
  expect(screen.getByRole('button', { name: 'Filters' })).not.toBeExpanded();
});

test('filters narrow the list and combine; Clear filters resets them but keeps the search', async () => {
  await renderApp({ seed });
  await openItems();
  await press('Filters');

  // A department across all stores.
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Departments: Deli' }));
  expect(screen.getByRole('checkbox', { name: 'Departments: Deli' })).toBeChecked();
  expect(visibleItems()).toEqual(['Ham', 'Milk']);
  expect(screen.getByText('1 filter on')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Filters, 1 on' })).toBeOnTheScreen();

  // ...at one store: the Deli at Big Box.
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Stores: Big Box' }));
  expect(visibleItems()).toEqual(['Ham']);
  expect(screen.getByText('2 filters on')).toBeOnTheScreen();

  // Unticking an option widens again.
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Departments: Deli' }));
  expect(visibleItems()).toEqual(['Ham', 'Peas']);

  // Brand, plus a search.
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Brands: Green Giant' }));
  expect(visibleItems()).toEqual(['Peas']);
  await type('Search items', 'pe');
  expect(visibleItems()).toEqual(['Peas']);

  // Clear filters is available even with the panel closed.
  await press('Filters, 2 on');
  await press('Clear filters');
  expect(screen.getByLabelText('Search items')).toHaveDisplayValue('pe');
  expect(visibleItems()).toEqual(['Peas']);
  expect(screen.getByRole('button', { name: 'Filters' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
});

test('filters on deleted stores stop applying', async () => {
  const db = await renderApp({ seed });
  await openItems();
  await press('Filters');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Stores: Corner Market' }));
  expect(visibleItems()).toEqual(['Apples', 'Milk']);

  await act(async () => {
    await db.stores.findOne('corner').remove();
  });
  expect(await screen.findByRole('checkbox', { name: 'Ham' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
});

test('the filter panel explains when there is nothing to filter by', async () => {
  await renderApp({
    seed: async (db) => {
      await db.settings.insert({ id: 'app', setupComplete: true });
    },
  });
  await act(() => router.navigate('/items'));
  await press('Filters');
  expect(screen.getByText('No stores yet.')).toBeOnTheScreen();
  expect(screen.getByText('No departments yet.')).toBeOnTheScreen();
  expect(screen.getByText('No items have a brand yet.')).toBeOnTheScreen();
  // With no items, the usual empty state shows, not "No matching items".
  expect(screen.getByText('No items yet')).toBeOnTheScreen();
});

/** Department headings and item rows, in display order. */
const listRows = () =>
  within(screen.getByTestId('master-list'))
    .queryAllByRole(/^(header|checkbox)$/)
    .map((el) => (el.props.accessibilityRole === 'header' ? `# ${el.props.children}` : el.props.accessibilityLabel))
    .filter((label: string) => !label.includes(': '));

const radio = (name: string) => screen.getByRole('radio', { name });

test('the sort button switches between name and department, A–Z or Z–A', async () => {
  await renderApp({ seed });
  await openItems();
  const sortButton = () => screen.getByRole('button', { name: /^Sort, by/ });
  expect(sortButton()).toHaveProp('accessibilityLabel', 'Sort, by name, A to Z');
  expect(screen.queryByText('Sort by')).toBeNull();

  // Opening sort closes filters, and the other way round.
  await press('Filters');
  expect(screen.getByRole('checkbox', { name: 'Stores: Big Box' })).toBeOnTheScreen();
  await fireEvent.press(sortButton());
  expect(screen.queryByRole('checkbox', { name: 'Stores: Big Box' })).toBeNull();
  expect(sortButton()).toBeExpanded();
  expect(radio('Sort by name')).toBeChecked();
  expect(radio('A to Z')).toBeChecked();

  await fireEvent.press(radio('Z to A'));
  expect(radio('Z to A')).toBeChecked();
  expect(sortButton()).toHaveProp('accessibilityLabel', 'Sort, by name, Z to A');
  expect(listRows()).toEqual(['Peas', 'Milk', 'Ham', 'Apples']);

  await fireEvent.press(radio('Sort by department'));
  expect(radio('Sort by department')).toBeChecked();
  expect(sortButton()).toHaveProp('accessibilityLabel', 'Sort, by department, Z to A');
  expect(screen.getByText(/listed under each/)).toBeOnTheScreen();
  expect(listRows()).toEqual(['# Produce', 'Apples', '# Frozen', 'Peas', '# Deli', 'Milk', 'Ham']);

  await fireEvent.press(radio('A to Z'));
  // Deli at both stores is one group.
  expect(listRows()).toEqual(['# Deli', 'Ham', 'Milk', '# Frozen', 'Peas', '# Produce', 'Apples']);

  // Sorting works together with search and filters.
  await type('Search items', 'a');
  expect(listRows()).toEqual(['# Deli', 'Ham', '# Frozen', 'Peas', '# Produce', 'Apples']);

  await fireEvent.press(radio('Sort by name'));
  expect(listRows()).toEqual(['Apples', 'Ham', 'Peas']);

  // Closing the panel keeps the choice.
  await fireEvent.press(sortButton());
  expect(screen.queryByText('Sort by')).toBeNull();
  expect(sortButton()).toBeCollapsed();
});

test('sorting by last bought: newest first, then never-bought items A–Z', async () => {
  await renderApp({
    seed: async (db) => {
      await seed(db);
      // Milk and Peas were bought on the same trip, after Ham. Apples never.
      const bought = { ham: 1_000, milk: 5_000, peas: 5_000 };
      for (const [id, lastBoughtAt] of Object.entries(bought)) {
        await (await db.items.findOne(id).exec())?.incrementalPatch({ lastBoughtAt });
      }
    },
  });
  await openItems();
  const sortButton = () => screen.getByRole('button', { name: /^Sort, by/ });
  await fireEvent.press(sortButton());

  await fireEvent.press(radio('Sort by last bought'));
  expect(radio('Sort by last bought')).toBeChecked();
  // The order choices are about dates now.
  expect(radio('Newest first')).toBeChecked();
  expect(screen.queryByRole('radio', { name: 'A to Z' })).toBeNull();
  expect(sortButton()).toHaveProp('accessibilityLabel', 'Sort, by last bought, Newest first');
  expect(listRows()).toEqual(['Milk', 'Peas', 'Ham', '# Never bought', 'Apples']);

  await fireEvent.press(radio('Oldest first'));
  expect(sortButton()).toHaveProp('accessibilityLabel', 'Sort, by last bought, Oldest first');
  // Same-trip items stay A–Z, and never-bought items stay last.
  expect(listRows()).toEqual(['Ham', 'Milk', 'Peas', '# Never bought', 'Apples']);

  // The direction carries over: oldest first becomes Z–A.
  await fireEvent.press(radio('Sort by name'));
  expect(radio('Z to A')).toBeChecked();
  expect(listRows()).toEqual(['Peas', 'Milk', 'Ham', 'Apples']);
});

test('an item in two departments is listed under both, and both copies share check and quantity', async () => {
  const db = await renderApp({
    seed: async (db) => {
      await seed(db);
      // Deli at Corner Market, Frozen at Big Box.
      await db.items.insert({
        id: 'pizza',
        name: 'Pizza',
        locations: [
          { storeId: 'corner', departmentId: 'c-deli' },
          { storeId: 'bigbox', departmentId: 'b-frozen' },
        ],
        createdAt: 1,
      });
    },
  });
  await openItems();
  await press('Sort, by name, A to Z');
  await fireEvent.press(radio('Sort by department'));
  expect(listRows()).toEqual(['# Deli', 'Ham', 'Milk', 'Pizza', '# Frozen', 'Peas', 'Pizza', '# Produce', 'Apples']);

  const [underDeli, underFrozen] = screen.getAllByRole('checkbox', { name: 'Pizza' });

  // Checking it under Deli checks it under Frozen too.
  await fireEvent.press(underDeli);
  await screen.findAllByLabelText('Quantity for Pizza');
  for (const box of screen.getAllByRole('checkbox', { name: 'Pizza' })) expect(box).toBeChecked();

  // A quantity typed under Deli shows under Frozen; changing it under Frozen shows under Deli.
  const quantities = () => screen.getAllByLabelText('Quantity for Pizza');
  await fireEvent.changeText(quantities()[0], '2 ');
  expect(quantities().map((q) => q.props.value)).toEqual(['2 ', '2 ']);
  await fireEvent.changeText(quantities()[1], '3 boxes');
  expect(quantities().map((q) => q.props.value)).toEqual(['3 boxes', '3 boxes']);
  await eventually(async () => {
    expect((await db.listEntries.findOne('pizza').exec())?.quantity).toBe('3 boxes');
  });

  // Unchecking under Frozen unchecks both; re-checking starts blank.
  await fireEvent.press(screen.getAllByRole('checkbox', { name: 'Pizza' })[1]);
  await eventually(async () => {
    expect(screen.queryAllByLabelText('Quantity for Pizza')).toHaveLength(0);
  });
  for (const box of screen.getAllByRole('checkbox', { name: 'Pizza' })) expect(box).not.toBeChecked();
  await fireEvent.press(underFrozen);
  await screen.findAllByLabelText('Quantity for Pizza');
  expect(quantities().map((q) => q.props.value)).toEqual(['', '']);
});
