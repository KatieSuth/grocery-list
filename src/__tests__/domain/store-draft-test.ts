import {
  copiedLocations,
  copyStoreDraft,
  countItemsAtStore,
  emptyStoreDraft,
  hasErrors,
  removedDepartmentsInUse,
  storeDraftChanged,
  storeToDraft,
  validateStoreDraft,
} from '@/domain/store-draft';
import type { Item, Store } from '@/domain/types';

test('a new draft is empty, with no departments to start', () => {
  expect(emptyStoreDraft()).toEqual({ name: '', location: '', departments: [] });
});

test('storeToDraft copies a store without sharing department objects', () => {
  const store = { id: 's', name: 'Shop', departments: [{ id: 'd', name: 'Deli' }], createdAt: 1 };
  const draft = storeToDraft(store);
  expect(draft).toEqual({ name: 'Shop', location: '', departments: [{ id: 'd', name: 'Deli' }] });
  expect(draft.departments[0]).not.toBe(store.departments[0]);
  expect(storeToDraft({ ...store, location: 'Main' }).location).toBe('Main');
});

test('validation requires a name and at least one department', () => {
  expect(validateStoreDraft({ name: ' ', location: '', departments: [] }, [])).toEqual({
    name: 'Store name is required.',
    departments: expect.stringContaining('at least one department'),
  });
  const ok = validateStoreDraft({ name: 'Shop', location: '', departments: [{ id: 'd', name: 'Deli' }] }, []);
  expect(ok).toEqual({});
  expect(hasErrors(ok)).toBe(false);
  expect(hasErrors({ name: 'x' })).toBe(true);
});

const shop: Store = {
  id: 's',
  name: 'Shop',
  departments: [
    { id: 'p', name: 'Produce' },
    { id: 'd', name: 'Deli' },
    { id: 'b', name: 'Bakery' },
  ],
  createdAt: 1,
};
const item = (id: string, departmentId: string, storeId = 's'): Item => ({
  id,
  name: id,
  locations: [{ storeId, departmentId }],
  createdAt: 1,
});

test('a store draft is changed by any edit to its name, location or departments', () => {
  const initial = storeToDraft(shop);
  expect(storeDraftChanged(storeToDraft(shop), initial)).toBe(false);
  expect(storeDraftChanged({ ...initial, name: 'Shop ' }, initial)).toBe(true);
  expect(storeDraftChanged({ ...initial, location: 'Main St' }, initial)).toBe(true);
  expect(storeDraftChanged({ ...initial, departments: initial.departments.slice(1) }, initial)).toBe(true);
  // Reordered, or a department removed and added back under a new id.
  expect(storeDraftChanged({ ...initial, departments: [...initial.departments].reverse() }, initial)).toBe(true);
  const [first, ...rest] = initial.departments;
  expect(storeDraftChanged({ ...initial, departments: [{ ...first, id: 'new' }, ...rest] }, initial)).toBe(true);
  expect(storeDraftChanged({ ...initial, departments: [{ ...first, name: 'Fruit' }, ...rest] }, initial)).toBe(true);
});

test('removedDepartmentsInUse names removed departments that items are in, in store order', () => {
  const items = [item('apples', 'p'), item('ham', 'd'), item('salami', 'd'), item('elsewhere', 'd', 'other')];
  const draft = { ...storeToDraft(shop), departments: [{ id: 'new', name: 'Deli' }] };
  // Bakery was removed too, but nothing is in it.
  expect(removedDepartmentsInUse(shop, draft, items)).toEqual({ names: ['Produce', 'Deli'], itemCount: 3 });
  expect(removedDepartmentsInUse(shop, storeToDraft(shop), items)).toEqual({ names: [], itemCount: 0 });
});

test('countItemsAtStore counts items listed under the store', () => {
  expect(countItemsAtStore('s', [item('a', 'p'), item('b', 'd'), item('c', 'x', 'other')])).toBe(2);
  expect(countItemsAtStore('none', [item('a', 'p')])).toBe(0);
});

test('store names and locations follow the shared name rules', () => {
  const departments = [{ id: 'd', name: 'Deli' }];
  expect(validateStoreDraft({ name: 'x'.repeat(101), location: 'Main\u200BSt', departments }, [])).toEqual({
    name: 'Store name is longer than 100 characters.',
    location: 'Location contains hidden or control characters, which aren’t allowed.',
  });
});

test('a store can share a name with another only if their locations differ', () => {
  const departments = [{ id: 'd', name: 'Deli' }];
  const main: Store = { id: 's1', name: 'Kroger', location: 'Main St', departments, createdAt: 1 };
  const plain: Store = { id: 's2', name: 'Aldi', departments, createdAt: 2 };

  expect(validateStoreDraft({ name: ' kroger ', location: 'MAIN  st', departments }, [main])).toEqual({
    location: 'You already have Kroger at Main St. Use a different location to tell them apart.',
  });
  expect(validateStoreDraft({ name: 'ALDI', location: ' ', departments }, [plain])).toEqual({
    location: 'You already have a store called Aldi. Add a location to tell them apart.',
  });
  // A different location, or none where the other has one, is fine.
  expect(validateStoreDraft({ name: 'Kroger', location: 'Elm St', departments }, [main])).toEqual({});
  expect(validateStoreDraft({ name: 'Kroger', location: '', departments }, [main])).toEqual({});
  // A blank name isn't also reported as a duplicate.
  expect(validateStoreDraft({ name: '', location: '', departments }, [{ ...plain, name: '' }])).toEqual({
    name: 'Store name is required.',
  });
});

describe('copying a store', () => {
  const source: Store = {
    id: 'src',
    name: 'Kroger',
    location: 'Main St',
    departments: [
      { id: 'prod', name: 'Produce' },
      { id: 'deli', name: 'Deli' },
      { id: 'froz', name: 'Frozen  Foods' },
      { id: 'bake', name: 'Bakery' },
    ],
    createdAt: 1,
  };
  const at = (id: string, ...locations: [string, string][]): Item => ({
    id,
    name: id,
    locations: locations.map(([storeId, departmentId]) => ({ storeId, departmentId })),
    createdAt: 1,
  });
  const items = [
    at('apples', ['src', 'prod'], ['other', 'x']),
    at('ham', ['src', 'deli']),
    at('peas', ['src', 'froz']),
    at('bread', ['src', 'bake']),
    at('soap', ['other', 'y']),
  ];

  test('starts with no name or location, and the departments in order under new ids', () => {
    const { draft, departmentSources } = copyStoreDraft(source);
    expect(draft.name).toBe('');
    expect(draft.location).toBe('');
    expect(draft.departments.map((d) => d.name)).toEqual(['Produce', 'Deli', 'Frozen  Foods', 'Bakery']);
    const ids = draft.departments.map((d) => d.id);
    expect(ids.some((id) => source.departments.some((d) => d.id === id))).toBe(false);
    expect(new Set(ids).size).toBe(4);
    expect(ids.map((id) => departmentSources[id])).toEqual(['prod', 'deli', 'froz', 'bake']);
  });

  test("items go in the copy of their department, even renamed or moved; others aren't copied", () => {
    const { draft, departmentSources } = copyStoreDraft(source);
    const [prod, deli, froz, bake] = draft.departments;
    const edited = { ...draft, departments: [{ ...deli, name: 'Deli counter' }, prod, froz, bake] };
    const locations = copiedLocations(items, source, 'new', edited, departmentSources);
    expect(Object.fromEntries(locations)).toEqual({
      apples: { storeId: 'new', departmentId: prod.id },
      ham: { storeId: 'new', departmentId: deli.id },
      peas: { storeId: 'new', departmentId: froz.id },
      bread: { storeId: 'new', departmentId: bake.id },
    });
  });

  test("a removed department's items are left out, unless it's added back with the same name", () => {
    const { draft, departmentSources } = copyStoreDraft(source);
    const [prod, , , bake] = draft.departments;
    // Deli and Frozen Foods removed; Frozen Foods added back, spelled a little differently.
    const readded = { id: 'readded', name: ' frozen foods ' };
    const edited = { ...draft, departments: [prod, bake, readded] };
    expect(Object.fromEntries(copiedLocations(items, source, 'new', edited, departmentSources))).toEqual({
      apples: { storeId: 'new', departmentId: prod.id },
      peas: { storeId: 'new', departmentId: 'readded' },
      bread: { storeId: 'new', departmentId: bake.id },
    });
  });

  test("a department renamed to another's name keeps its own items, not the other's", () => {
    const { draft, departmentSources } = copyStoreDraft(source);
    const [, deli] = draft.departments;
    // Produce removed; Deli renamed "Produce". Produce's items have nowhere to go.
    const edited = { ...draft, departments: [{ ...deli, name: 'Produce' }] };
    expect(Object.fromEntries(copiedLocations(items, source, 'new', edited, departmentSources))).toEqual({
      ham: { storeId: 'new', departmentId: deli.id },
    });
  });

  test('a different name gets no items', () => {
    const { draft, departmentSources } = copyStoreDraft(source);
    const edited = { ...draft, departments: [{ id: 'n', name: 'Delicatessen' }] };
    expect(copiedLocations(items, source, 'new', edited, departmentSources).size).toBe(0);
  });
});
