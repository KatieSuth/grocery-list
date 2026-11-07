import { cleanup, screen } from 'expo-router/testing-library';

import type { AppDatabase } from '@/db/database';
import { addDepartments, eventually, press, renderApp, type } from '@/test-utils/app';
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
  await db.stores.insert({
    id: 's1',
    name: 'Corner Market',
    location: 'Main St',
    departments: [
      { id: 'd1', name: 'Bakery' },
      { id: 'd2', name: 'deli' },
      { id: 'd3', name: 'Frozen Foods' },
      { id: 'd4', name: 'Produce' },
    ],
    createdAt: 1,
  });
  await db.stores.insert({ id: 's2', name: 'Big Box', departments: [{ id: 'd5', name: 'Deli' }], createdAt: 2 });
}

/** Department names in the editor, in list order. */
const departmentNames = () =>
  screen.getAllByRole('button', { name: /^Remove / }).map((b) => String(b.props.accessibilityLabel).slice('Remove '.length));

test('with no other stores, there is nothing to copy from', async () => {
  await renderApp();
  await press('Add a store');
  expect(screen.queryByRole('button', { name: 'Copy departments from another store' })).toBeNull();
});

test('copies another store’s departments after the current ones, skipping names already listed', async () => {
  const db = await renderApp({ seed });
  await press('Add a store');
  await type('Store name', 'Co-op');
  // Typing "Deli" reuses Corner Market's spelling, "deli".
  await addDepartments('Produce', 'Deli', 'Frozen');
  expect(departmentNames()).toEqual(['Produce', 'deli', 'Frozen']);

  // The prompt lists every saved store, with a preview of its departments.
  await press('Copy departments from another store');
  expect(screen.getByText('Copy departments from…')).toBeOnTheScreen();
  const corner = screen.getByRole('button', { name: 'Copy from Corner Market, Main St' });
  expect(corner).toHaveProp('accessibilityHint', 'Departments: Bakery, deli, Frozen Foods, Produce');
  expect(screen.getByText('Bakery → deli → Frozen Foods → Produce')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Copy from Big Box' })).toBeOnTheScreen();

  // Cancel changes nothing.
  await press('Cancel copying');
  expect(screen.queryByText('Copy departments from…')).toBeNull();
  expect(departmentNames()).toEqual(['Produce', 'deli', 'Frozen']);

  // "deli" and "Produce" are already here, so only two are added.
  await press('Copy departments from another store');
  await press('Copy from Corner Market, Main St');
  expect(screen.queryByText('Copy departments from…')).toBeNull();
  expect(departmentNames()).toEqual(['Produce', 'deli', 'Frozen', 'Bakery', 'Frozen Foods']);
  expect(screen.getByText('Copied 2 departments from Corner Market: Bakery, Frozen Foods.')).toBeOnTheScreen();

  // Copying again adds nothing, and says so.
  await press('Copy departments from another store');
  expect(screen.queryByText(/^Copied/)).toBeNull();
  await press('Copy from Corner Market, Main St');
  expect(departmentNames()).toEqual(['Produce', 'deli', 'Frozen', 'Bakery', 'Frozen Foods']);
  expect(screen.getByText('Every department at Corner Market is already in this list.')).toBeOnTheScreen();

  await press('Save');
  await eventually(async () => {
    const saved = await db.stores.findOne({ selector: { name: 'Co-op' } }).exec();
    expect(saved?.departments.map((d) => d.name)).toEqual(['Produce', 'deli', 'Frozen', 'Bakery', 'Frozen Foods']);
    // Copies are new departments, not shared with Corner Market.
    expect(saved?.departments.map((d) => d.id)).not.toContain('d1');
  });
});

test('when editing a store, it is not offered as a source', async () => {
  await renderApp({ seed });
  await press('Big Box');
  await press('Remove Deli');
  await press('Copy departments from another store');
  expect(screen.queryByRole('button', { name: 'Copy from Big Box' })).toBeNull();
  await press('Copy from Corner Market, Main St');
  // All four are new here, including "deli" now that Deli was removed.
  expect(departmentNames()).toEqual(['Bakery', 'deli', 'Frozen Foods', 'Produce']);
});

test('reports a single copied department in the singular', async () => {
  await renderApp({ seed });
  await press('Corner Market, Main St');
  await press('Remove deli');
  await press('Copy departments from another store');
  await press('Copy from Big Box');
  expect(screen.getByText('Copied 1 department from Big Box: Deli.')).toBeOnTheScreen();
});
