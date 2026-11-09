import {
  describeImportErrors,
  describeImportPlan,
  describeImportResult,
  isEmptyImport,
  MAX_DEPARTMENTS_PER_STORE,
  MAX_FIELD_LENGTH,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  MAX_STORES,
  parseImportCsv,
  planImport,
  prepareImportText,
  quote,
  type ImportRow,
} from '@/domain/csv-import';
import type { Item, Store } from '@/domain/types';

/** The rows, or the error messages, of a CSV. */
function rowsOf(text: string) {
  const result = parseImportCsv(text);
  if (!result.ok) throw new Error(`Expected rows, got: ${JSON.stringify(result.errors)}`);
  return result.rows;
}
function errorsOf(text: string) {
  const result = parseImportCsv(text);
  if (result.ok) throw new Error('Expected errors');
  return result.errors;
}

describe('reading the file', () => {
  test('rows are Store, Item name, Department, Brand; a header row is skipped', () => {
    expect(rowsOf('Store,Item Name,Department,Brand\nKroger,Milk,Dairy,Organic Valley\nKroger,Bread,Bakery,')).toEqual([
      { row: 2, store: 'Kroger', name: 'Milk', department: 'Dairy', brand: 'Organic Valley' },
      { row: 3, store: 'Kroger', name: 'Bread', department: 'Bakery', brand: '' },
    ]);
  });

  test('without a header, the first row is data', () => {
    expect(rowsOf('Kroger,Milk,Dairy')).toEqual([{ row: 1, store: 'Kroger', name: 'Milk', department: 'Dairy', brand: '' }]);
  });

  test('header names are matched loosely, and the brand column is optional', () => {
    expect(rowsOf('  STORE , item , Department\nKroger,Milk,Dairy')).toHaveLength(1);
    expect(rowsOf('store,item name,department,BRAND,\nKroger,Milk,Dairy')).toHaveLength(1);
    // Only the first row can be a header.
    expect(errorsOf('Kroger,Milk,Dairy\nStore,Item,Department,Brand,Extra')[0]).toEqual({
      row: 2,
      message: 'There are more than 4 columns. Use: Store, Item name, Department, Brand.',
    });
  });

  test('quoted values can hold commas, quotes and line breaks; spacing is tidied', () => {
    expect(rowsOf('"Trader Joe\'s, Main St","Milk ""2%""","Dairy\nand eggs",  Acme   Farms  ')).toEqual([
      { row: 1, store: "Trader Joe's, Main St", name: 'Milk "2%"', department: 'Dairy and eggs', brand: 'Acme Farms' },
    ]);
  });

  test('Windows line endings, a byte order mark, blank lines and trailing empty cells are fine', () => {
    expect(rowsOf('﻿Store,Item name,Department,Brand\r\n\r\nKroger,Milk,Dairy,,,\r\n , , ,\r\nKroger,Eggs,Dairy\r\n')).toEqual([
      { row: 3, store: 'Kroger', name: 'Milk', department: 'Dairy', brand: '' },
      { row: 5, store: 'Kroger', name: 'Eggs', department: 'Dairy', brand: '' },
    ]);
  });

  test('values stay text: nothing is converted to numbers or dates', () => {
    expect(rowsOf('7-Eleven,1e3,2024-01-01,true')[0]).toEqual({
      row: 1,
      store: '7-Eleven',
      name: '1e3',
      department: '2024-01-01',
      brand: 'true',
    });
  });

  test('names that look like code or object keys are just names', () => {
    expect(rowsOf('__proto__,constructor,<script>alert(1)</script>,=HYPERLINK("x")')[0]).toEqual({
      row: 1,
      store: '__proto__',
      name: 'constructor',
      department: '<script>alert(1)</script>',
      brand: '=HYPERLINK("x")',
    });
  });

  test('every required value must be present', () => {
    expect(errorsOf('Kroger,Milk,Dairy\n,Milk,Dairy\nKroger, ,Dairy\nKroger,Milk,\nKroger')).toEqual([
      { row: 2, message: 'Store is empty.' },
      { row: 3, message: 'Item name is empty.' },
      { row: 4, message: 'Department is empty.' },
      { row: 5, message: 'Item name is empty.' },
      { row: 5, message: 'Department is empty.' },
    ]);
  });

  test('values can’t be too long', () => {
    const long = 'x'.repeat(MAX_FIELD_LENGTH + 1);
    expect(rowsOf(`${'x'.repeat(MAX_FIELD_LENGTH)},Milk,Dairy`)).toHaveLength(1);
    expect(errorsOf(`Kroger,Milk,Dairy,${long}`)).toEqual([
      { row: 1, message: `Brand is longer than ${MAX_FIELD_LENGTH} characters.` },
    ]);
  });

  test.each([
    ['a NUL', 'Mi\u0000lk'],
    ['an escape', 'Mi\u001Blk'],
    ['a C1 control', 'Mi\u0085lk'],
    ['a right-to-left override', 'Mi‮lk'],
    ['a bidi isolate', 'Mi⁦lk'],
    ['a zero-width space', 'Mi​lk'],
    ['a zero-width no-break space', 'Mi﻿lk'],
  ])('hidden or control characters are refused: %s', (_label, name) => {
    expect(errorsOf(`Kroger,${name},Dairy`)).toEqual([
      { row: 1, message: 'Item name contains hidden or control characters, which aren’t allowed.' },
    ]);
  });

  test('accents, emoji and other languages are fine', () => {
    expect(rowsOf('Épicerie,Café ☕,日本食品,Ünïcödé')[0].name).toBe('Café ☕');
  });

  test('unbalanced quotes are reported, not guessed at', () => {
    expect(errorsOf('Kroger,"Milk,Dairy')).toContainEqual({ row: 1, message: 'A quote (") is opened but never closed.' });
    expect(errorsOf('Kroger,Milk,Dairy\nKroger,"Mi"lk",Dairy')).toEqual([
      { row: 2, message: 'A quote (") is in the wrong place. Put quotes around the whole value, and double any quotes inside it ("").' },
    ]);
    // A quote inside an unquoted value is just a character.
    expect(rowsOf('Kroger,Mi"lk,Dairy')[0].name).toBe('Mi"lk');
  });

  test('a file with nothing to import says so', () => {
    expect(errorsOf('')).toEqual([{ message: 'There are no rows to import.' }]);
    expect(errorsOf('Store,Item name,Department,Brand\n\n')).toEqual([{ message: 'There are no rows to import.' }]);
  });

  test('a file can have at most the row limit', () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => `Kroger,Item ${i},Dairy`).join('\n');
    expect(rowsOf(`Store,Item,Department\n${rows(MAX_IMPORT_ROWS)}`)).toHaveLength(MAX_IMPORT_ROWS);
    expect(errorsOf(rows(MAX_IMPORT_ROWS + 1))).toEqual([
      { message: 'The file has more than 2,000 rows. Split it into smaller files.' },
    ]);
  });

  test('text that is too big, or isn’t really text, is refused before parsing', () => {
    expect(prepareImportText('x'.repeat(MAX_IMPORT_BYTES + 1))).toEqual({
      ok: false,
      error: 'The file is too big. Import files of up to 1 MB.',
    });
    expect(errorsOf('PNG��')).toEqual([
      { message: 'This doesn’t look like a CSV file. Save it as “CSV UTF-8” and try again.' },
    ]);
    expect(prepareImportText('﻿Kroger')).toEqual({ ok: true, text: 'Kroger' });
  });
});

const kroger: Store = {
  id: 's1',
  name: 'Kroger',
  departments: [
    { id: 'd1', name: 'Dairy' },
    { id: 'd2', name: 'Produce' },
  ],
  createdAt: 1,
};
const wholeFoods: Store = { id: 's2', name: 'Whole Foods', departments: [{ id: 'd3', name: 'Deli' }], createdAt: 2 };
const milk: Item = {
  id: 'i1',
  name: 'Milk',
  brand: 'Organic Valley',
  locations: [{ storeId: 's1', departmentId: 'd1' }],
  createdAt: 1,
};

let rowNumber = 0;
const row = (store: string, name: string, department: string, brand = ''): ImportRow => ({
  row: ++rowNumber,
  store,
  name,
  department,
  brand,
});
beforeEach(() => {
  rowNumber = 0;
});

function planOf(rows: ImportRow[], stores: Store[] = [kroger, wholeFoods], items: Item[] = [milk]) {
  const result = planImport(rows, stores, items, 1000);
  if (!result.ok) throw new Error(`Expected a plan, got: ${JSON.stringify(result.errors)}`);
  return result.plan;
}
function planErrorsOf(rows: ImportRow[], stores: Store[] = [kroger, wholeFoods], items: Item[] = [milk]) {
  const result = planImport(rows, stores, items, 1000);
  if (result.ok) throw new Error('Expected errors');
  return result.errors;
}

describe('working out what to import', () => {
  test('a new store is created with its departments in the order they appear', () => {
    const plan = planOf([row('Aldi', 'Apples', 'Produce'), row('Aldi', 'Bread', 'Bakery'), row('aldi ', 'Pears', 'produce')]);
    expect(plan.newStores).toEqual([
      {
        id: expect.any(String),
        name: 'Aldi',
        departments: [
          { id: expect.any(String), name: 'Produce' },
          { id: expect.any(String), name: 'Bakery' },
        ],
        createdAt: 1000,
      },
    ]);
    const [aldi] = plan.newStores;
    expect(plan.newItems.map((i) => [i.name, i.locations])).toEqual([
      ['Apples', [{ storeId: aldi.id, departmentId: aldi.departments[0].id }]],
      ['Bread', [{ storeId: aldi.id, departmentId: aldi.departments[1].id }]],
      ['Pears', [{ storeId: aldi.id, departmentId: aldi.departments[0].id }]],
    ]);
    expect(plan.departmentAdds.size).toBe(0);
    expect(plan.counts).toEqual({ newStores: 1, newDepartments: 2, newItems: 3, updatedItems: 0, skipped: 0 });
  });

  test('ids are always made by the app, never taken from the file', () => {
    const plan = planOf([row('s1', 'i1', 'd1')]);
    expect(plan.newStores[0].id).not.toBe('s1');
    expect(plan.newStores[0].departments[0].id).not.toBe('d1');
    expect(plan.newItems[0].id).not.toBe('i1');
  });

  test('existing stores and departments are matched ignoring case and spacing, keeping their spelling', () => {
    const plan = planOf([row('  KROGER ', 'Butter', 'dairy', 'Kerrygold')]);
    expect(plan.newStores).toEqual([]);
    expect(plan.departmentAdds.size).toBe(0);
    expect(plan.newItems).toEqual([
      {
        id: expect.any(String),
        name: 'Butter',
        brand: 'Kerrygold',
        locations: [{ storeId: 's1', departmentId: 'd1' }],
        createdAt: 1000,
      },
    ]);
  });

  test('a missing department is added to the end of an existing store', () => {
    const plan = planOf([row('Kroger', 'Bread', 'Bakery'), row('Kroger', 'Bagels', 'BAKERY')]);
    expect(plan.departmentAdds).toEqual(new Map([['s1', [{ id: expect.any(String), name: 'Bakery' }]]]));
    const bakeryId = plan.departmentAdds.get('s1')![0].id;
    expect(plan.newItems.map((i) => i.locations)).toEqual([
      [{ storeId: 's1', departmentId: bakeryId }],
      [{ storeId: 's1', departmentId: bakeryId }],
    ]);
    expect(plan.counts.newDepartments).toBe(1);
  });

  test('an item already in that department at that store is skipped', () => {
    const plan = planOf([row('kroger', 'MILK', 'Dairy', 'organic valley')]);
    expect(plan.newItems).toEqual([]);
    expect(plan.locationAdds.size).toBe(0);
    expect(plan.counts).toEqual({ newStores: 0, newDepartments: 0, newItems: 0, updatedItems: 0, skipped: 1 });
    expect(isEmptyImport(plan.counts)).toBe(true);
  });

  test('the same name with a different brand (or none) is a different item', () => {
    const plan = planOf([row('Kroger', 'Milk', 'Dairy'), row('Kroger', 'Milk', 'Dairy', 'Horizon')]);
    expect(plan.newItems.map((i) => [i.name, i.brand])).toEqual([
      ['Milk', undefined],
      ['Milk', 'Horizon'],
    ]);
  });

  test('an existing item is added to another store', () => {
    const plan = planOf([row('Whole Foods', 'Milk', 'Deli', 'Organic Valley'), row('Aldi', 'Milk', 'Dairy', 'Organic Valley')]);
    const aldi = plan.newStores[0];
    expect(plan.locationAdds).toEqual(
      new Map([
        [
          'i1',
          [
            { storeId: 's2', departmentId: 'd3' },
            { storeId: aldi.id, departmentId: aldi.departments[0].id },
          ],
        ],
      ])
    );
    expect(plan.newItems).toEqual([]);
    expect(plan.counts.updatedItems).toBe(1);
  });

  test('a new item listed at two stores is created once, at both', () => {
    const plan = planOf([row('Kroger', 'Eggs', 'Dairy'), row('Whole Foods', 'eggs', 'Deli'), row('Kroger', 'Eggs', 'Dairy')]);
    expect(plan.newItems).toHaveLength(1);
    expect(plan.newItems[0].locations).toEqual([
      { storeId: 's1', departmentId: 'd1' },
      { storeId: 's2', departmentId: 'd3' },
    ]);
    expect(plan.locationAdds.size).toBe(0);
    expect(plan.counts.skipped).toBe(1);
  });

  test('an item already in a different department at that store blocks the import', () => {
    expect(planErrorsOf([row('Kroger', 'Bread', 'Bakery'), row('Kroger', 'Milk', 'Produce', 'Organic Valley')])).toEqual([
      {
        row: 2,
        message:
          '“Milk” is already in “Dairy” at “Kroger”, not “Produce”. An item can be in only one department per store.',
      },
    ]);
  });

  test('an item in two departments at one store within the file blocks the import', () => {
    expect(planErrorsOf([row('Kroger', 'Eggs', 'Dairy'), row('Kroger', 'Eggs', 'Produce')])).toEqual([
      {
        row: 2,
        message:
          '“Eggs” is in “Dairy” at “Kroger” on row 1, and in “Produce” here. An item can be in only one department per store.',
      },
    ]);
    rowNumber = 0;
    expect(
      planErrorsOf([row('Whole Foods', 'Milk', 'Deli', 'Organic Valley'), row('Whole Foods', 'Milk', 'Bakery', 'Organic Valley')])
    ).toEqual([
      {
        row: 2,
        message:
          '“Milk” is in “Deli” at “Whole Foods” on row 1, and in “Bakery” here. An item can be in only one department per store.',
      },
    ]);
  });

  test('a location pointing at a missing department is still explained', () => {
    const stray: Item = { ...milk, locations: [{ storeId: 's1', departmentId: 'gone' }] };
    expect(planErrorsOf([row('Kroger', 'Milk', 'Dairy', 'Organic Valley')], [kroger], [stray])[0].message).toBe(
      '“Milk” is already in “another department” at “Kroger”, not “Dairy”. An item can be in only one department per store.'
    );
  });

  test('duplicate stores or items already in the app match the first one', () => {
    const twin: Store = { ...kroger, id: 's9', createdAt: 9 };
    const milkTwin: Item = { ...milk, id: 'i9', locations: [] };
    const plan = planOf([row('Kroger', 'Milk', 'Dairy', 'Organic Valley')], [kroger, twin], [milk, milkTwin]);
    expect(plan.counts.skipped).toBe(1);
  });

  test('the store and department limits are enforced', () => {
    const many = Array.from({ length: MAX_STORES }, (_, i) => row(`Store ${i}`, 'Milk', 'Dairy'));
    expect(planErrorsOf(many)).toEqual([{ message: `This would make more than ${MAX_STORES} stores.` }]);

    const departments = Array.from({ length: MAX_DEPARTMENTS_PER_STORE - 1 }, (_, i) => row('Kroger', `Item ${i}`, `Aisle ${i}`));
    expect(planErrorsOf(departments)).toEqual([{ message: `“Kroger” would have more than ${MAX_DEPARTMENTS_PER_STORE} departments.` }]);
    expect(planOf(departments.slice(1)).counts.newDepartments).toBe(MAX_DEPARTMENTS_PER_STORE - 2);
  });

  test('names like "__proto__" don’t touch object internals', () => {
    const plan = planOf([row('__proto__', 'constructor', 'toString', 'hasOwnProperty')], [], []);
    expect(plan.newStores[0].name).toBe('__proto__');
    expect(plan.newItems[0]).toMatchObject({ name: 'constructor', brand: 'hasOwnProperty' });
    expect(({} as Record<string, unknown>).constructor).toBe(Object);
  });

  test('the stores and items passed in are not changed', () => {
    const stores = [structuredClone(kroger)];
    const items = [structuredClone(milk)];
    planOf([row('Kroger', 'Milk', 'Dairy'), row('Kroger', 'Bread', 'Bakery'), row('Whole Foods', 'Milk', 'Deli', 'Organic Valley')], stores, items);
    expect(stores).toEqual([kroger]);
    expect(items).toEqual([milk]);
  });
});

describe('messages', () => {
  test('long values quoted back are shortened', () => {
    expect(quote('Kroger')).toBe('“Kroger”');
    expect(quote('x'.repeat(100))).toBe(`“${'x'.repeat(29)}…”`);
  });

  test('the question before importing says what will change', () => {
    expect(describeImportPlan({ newStores: 1, newDepartments: 2, newItems: 3, updatedItems: 1, skipped: 4 })).toBe(
      'This adds 3 new items, 1 existing item at another store, 1 new store and 2 new departments. 4 rows are already in your list and will be skipped.'
    );
    expect(describeImportPlan({ newStores: 0, newDepartments: 0, newItems: 1, updatedItems: 0, skipped: 1 })).toBe(
      'This adds 1 new item. 1 row is already in your list and will be skipped.'
    );
    expect(describeImportPlan({ newStores: 0, newDepartments: 0, newItems: 1500, updatedItems: 2, skipped: 0 })).toBe(
      'This adds 1,500 new items and 2 existing items at another store.'
    );
  });

  test('the message afterwards says what changed', () => {
    expect(describeImportResult({ newStores: 2, newDepartments: 1, newItems: 0, updatedItems: 0, skipped: 3 })).toBe(
      'Added 2 new stores and 1 new department.'
    );
  });

  test('errors list the first few problems, then how many more', () => {
    const errors = [{ message: 'The file is odd.' }, ...Array.from({ length: 6 }, (_, i) => ({ row: i + 2, message: 'Store is empty.' }))];
    expect(describeImportErrors(errors)).toBe(
      [
        'The file is odd.',
        'Row 2: Store is empty.',
        'Row 3: Store is empty.',
        'Row 4: Store is empty.',
        'Row 5: Store is empty.',
        '…and 2 more problems.',
        '',
        'Nothing was imported.',
      ].join('\n')
    );
    expect(describeImportErrors([{ row: 1, message: 'Store is empty.' }])).toBe('Row 1: Store is empty.\n\nNothing was imported.');
  });
});
