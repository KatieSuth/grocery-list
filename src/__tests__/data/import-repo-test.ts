import { applyImportPlan, loadImportContext } from '@/data/import-repo';
import type { AppDatabase } from '@/db/database';
import { parseImportCsv, planImport, type ImportPlan } from '@/domain/csv-import';
import { closeTestDatabases, createTestDatabase } from '@/test-utils/db';

afterEach(closeTestDatabases);

async function seed(db: AppDatabase) {
  await db.stores.insert({ id: 's2', name: 'Whole Foods', departments: [{ id: 'd3', name: 'Deli' }], createdAt: 2 });
  await db.stores.insert({ id: 's1', name: 'Kroger', departments: [{ id: 'd1', name: 'Dairy' }], createdAt: 1 });
  await db.items.insert({ id: 'i1', name: 'Milk', locations: [{ storeId: 's1', departmentId: 'd1' }], createdAt: 1 });
}

/** Plans `csv` against what's in the database. */
async function planFor(db: AppDatabase, csv: string): Promise<ImportPlan> {
  const parsed = parseImportCsv(csv);
  if (!parsed.ok) throw new Error('bad csv');
  const { stores, items } = await loadImportContext(db);
  const planned = planImport(parsed.rows, stores, items);
  if (!planned.ok) throw new Error(JSON.stringify(planned.errors));
  return planned.plan;
}

const json = async (db: AppDatabase) => ({
  stores: (await db.stores.find({ sort: [{ createdAt: 'asc' }] }).exec()).map((d) => d.toJSON()),
  items: (await db.items.find({ sort: [{ createdAt: 'asc' }] }).exec()).map((d) => d.toJSON()),
});

test('the import context lists stores in the user’s order', async () => {
  const db = await createTestDatabase();
  await seed(db);
  const { stores, items } = await loadImportContext(db);
  expect(stores.map((s) => s.name)).toEqual(['Kroger', 'Whole Foods']);
  expect(items.map((i) => i.name)).toEqual(['Milk']);
});

test('applying a plan adds stores, departments and items, and adds existing items to stores', async () => {
  const db = await createTestDatabase();
  await seed(db);
  const plan = await planFor(
    db,
    ['Store,Item name,Department,Brand', 'Kroger,Milk,Dairy', 'Kroger,Bread,Bakery,Acme', 'Whole Foods,Milk,Deli', 'Aldi,Apples,Produce'].join(
      '\n'
    )
  );
  await applyImportPlan(db, plan);

  const { stores, items } = await json(db);
  expect(stores).toEqual([
    {
      id: 's1',
      name: 'Kroger',
      // The existing department keeps its id; the new one goes at the end.
      departments: [
        { id: 'd1', name: 'Dairy' },
        { id: expect.any(String), name: 'Bakery' },
      ],
      createdAt: 1,
    },
    { id: 's2', name: 'Whole Foods', departments: [{ id: 'd3', name: 'Deli' }], createdAt: 2 },
    { id: expect.any(String), name: 'Aldi', departments: [{ id: expect.any(String), name: 'Produce' }], createdAt: expect.any(Number) },
  ]);
  const [kroger, , aldi] = stores;
  expect(items).toEqual([
    {
      id: 'i1',
      name: 'Milk',
      locations: [
        { storeId: 's1', departmentId: 'd1' },
        { storeId: 's2', departmentId: 'd3' },
      ],
      createdAt: 1,
    },
    {
      id: expect.any(String),
      name: 'Bread',
      brand: 'Acme',
      locations: [{ storeId: 's1', departmentId: kroger.departments[1].id }],
      createdAt: expect.any(Number),
    },
    {
      id: expect.any(String),
      name: 'Apples',
      locations: [{ storeId: aldi.id, departmentId: aldi.departments[0].id }],
      createdAt: expect.any(Number),
    },
  ]);
});

test('importing the same file twice changes nothing the second time', async () => {
  const db = await createTestDatabase();
  await seed(db);
  const csv = 'Kroger,Bread,Bakery\nAldi,Apples,Produce\nWhole Foods,Milk,Deli';
  await applyImportPlan(db, await planFor(db, csv));
  const before = await json(db);

  const again = await planFor(db, csv);
  expect(again.counts).toEqual({ newStores: 0, newDepartments: 0, newItems: 0, updatedItems: 0, skipped: 3 });
  await applyImportPlan(db, again);
  expect(await json(db)).toEqual(before);
});

test('changes made after planning aren’t overwritten or duplicated', async () => {
  const db = await createTestDatabase();
  await seed(db);
  const plan = await planFor(db, 'Kroger,Bread,Bakery\nWhole Foods,Milk,Deli');
  // Meanwhile: Kroger gets another department, and Milk is put in Whole Foods' Deli already.
  await db.stores.findOne('s1').patch({ departments: [{ id: 'd1', name: 'Dairy' }, { id: 'd9', name: 'Frozen' }] });
  await db.items.findOne('i1').patch({
    locations: [
      { storeId: 's1', departmentId: 'd1' },
      { storeId: 's2', departmentId: 'd3' },
    ],
  });
  await applyImportPlan(db, plan);
  // Applying the same additions again (e.g. a retried import) doesn't repeat them.
  await applyImportPlan(db, { ...plan, newStores: [], newItems: [] });

  const { stores, items } = await json(db);
  expect(stores[0].departments.map((d) => d.name)).toEqual(['Dairy', 'Frozen', 'Bakery']);
  expect(items[0].locations).toEqual([
    { storeId: 's1', departmentId: 'd1' },
    { storeId: 's2', departmentId: 'd3' },
  ]);
});

test('a store or item deleted after planning stops the import with an error', async () => {
  const db = await createTestDatabase();
  await seed(db);
  const storePlan = await planFor(db, 'Kroger,Bread,Bakery');
  await db.stores.findOne('s1').remove();
  await expect(applyImportPlan(db, storePlan)).rejects.toThrow('A store changed during the import');

  const itemPlan = await planFor(db, 'Whole Foods,Milk,Deli');
  await db.items.findOne('i1').remove();
  await expect(applyImportPlan(db, itemPlan)).rejects.toThrow('An item changed during the import');
});

test('a failed bulk write is reported', async () => {
  const db = await createTestDatabase();
  await seed(db);
  const plan = await planFor(db, 'Aldi,Apples,Produce');
  // The same ids again: the database refuses duplicates.
  await applyImportPlan(db, plan);
  await expect(applyImportPlan(db, plan)).rejects.toThrow('Could not save 1 stores');
  await expect(applyImportPlan(db, { ...plan, newStores: [] })).rejects.toThrow('Could not save 1 items');
});
