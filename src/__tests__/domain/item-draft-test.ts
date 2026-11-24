import {
  chooseDepartment,
  draftToLocations,
  emptyItemDraft,
  findDuplicateItem,
  isItemDraftBlank,
  itemDraftChanged,
  itemToDraft,
  pruneLocations,
  toggleStore,
  validateItemDraft,
} from '@/domain/item-draft';
import type { Store } from '@/domain/types';

const stores: Store[] = [
  { id: 's1', name: 'Corner', departments: [{ id: 'd1', name: 'Produce' }, { id: 'd2', name: 'Deli' }], createdAt: 1 },
  { id: 's2', name: 'Big Box', departments: [{ id: 'd3', name: 'Frozen' }], createdAt: 2 },
];

test('toggleStore selects and deselects', () => {
  const selected = toggleStore(emptyItemDraft(), 's1');
  expect(selected.selections).toEqual({ s1: null });
  expect(toggleStore(selected, 's1').selections).toEqual({});
});

test('chooseDepartment sets the department for a store', () => {
  const draft = chooseDepartment(toggleStore(emptyItemDraft(), 's1'), 's1', 'd2');
  expect(draft.selections).toEqual({ s1: 'd2' });
});

test('itemToDraft round-trips through draftToLocations', () => {
  const item = {
    id: 'i',
    name: 'Milk',
    locations: [
      { storeId: 's2', departmentId: 'd3' },
      { storeId: 's1', departmentId: 'd2' },
    ],
    createdAt: 1,
  };
  const draft = itemToDraft(item);
  expect(draft).toEqual({ name: 'Milk', brand: '', selections: { s2: 'd3', s1: 'd2' }, tags: [] });
  expect(itemToDraft({ ...item, brand: 'Acme' }).brand).toBe('Acme');
  expect(itemToDraft({ ...item, tags: ['Work'] }).tags).toEqual(['Work']);
  // Output follows the user's store order, not selection order.
  expect(draftToLocations(draft, stores)).toEqual([
    { storeId: 's1', departmentId: 'd2' },
    { storeId: 's2', departmentId: 'd3' },
  ]);
});

test('draftToLocations skips stores without a valid department or that no longer exist', () => {
  const draft = { name: 'x', brand: '', selections: { s1: null, s2: 'nope', gone: 'd1' }, tags: [] };
  expect(draftToLocations(draft, stores)).toEqual([]);
});

describe('validateItemDraft', () => {
  test('requires a name and a store', () => {
    expect(validateItemDraft(emptyItemDraft(), stores)).toEqual({
      name: 'Item name is required.',
      stores: 'Choose at least one store.',
    });
  });

  test('requires a department for each selected store', () => {
    const draft = { name: 'Milk', brand: '', selections: { s1: 'd1', s2: null }, tags: [] };
    expect(validateItemDraft(draft, stores)).toEqual({
      departments: { s2: 'Choose a department in Big Box.' },
    });
  });

  test('ignores selections for deleted stores', () => {
    const draft = { name: 'Milk', brand: '', selections: { gone: 'd1' }, tags: [] };
    expect(validateItemDraft(draft, stores)).toEqual({ stores: 'Choose at least one store.' });
  });

  test('passes a complete draft', () => {
    expect(validateItemDraft({ name: 'Milk', brand: '', selections: { s1: 'd1' }, tags: [] }, stores)).toEqual({});
  });
});

test('isItemDraftBlank', () => {
  expect(isItemDraftBlank({ name: ' ', brand: '', selections: {}, tags: [] })).toBe(true);
  expect(isItemDraftBlank({ name: 'a', brand: '', selections: {}, tags: [] })).toBe(false);
  expect(isItemDraftBlank({ name: '', brand: 'b', selections: {}, tags: [] })).toBe(false);
  expect(isItemDraftBlank({ name: '', brand: '', selections: { s1: null }, tags: [] })).toBe(false);
  expect(isItemDraftBlank({ name: '', brand: '', selections: {}, tags: ['Work'] })).toBe(false);
});

test('pruneLocations drops missing stores and departments', () => {
  expect(
    pruneLocations(
      [
        { storeId: 's1', departmentId: 'd1' },
        { storeId: 's1', departmentId: 'gone' },
        { storeId: 'gone', departmentId: 'd3' },
      ],
      stores,
    ),
  ).toEqual([{ storeId: 's1', departmentId: 'd1' }]);
});

test('an item draft is changed by any edit to its name, brand, stores or departments', () => {
  const initial = { name: 'Milk', brand: '', selections: { s1: 'd1', s2: null }, tags: [] };
  expect(itemDraftChanged({ ...initial, selections: { s2: null, s1: 'd1' } }, initial)).toBe(false);
  expect(itemDraftChanged({ ...initial, name: 'Oat milk' }, initial)).toBe(true);
  expect(itemDraftChanged({ ...initial, brand: 'Acme' }, initial)).toBe(true);
  expect(itemDraftChanged({ ...initial, selections: { s1: 'd2', s2: null } }, initial)).toBe(true);
  expect(itemDraftChanged({ ...initial, selections: { s1: 'd1' } }, initial)).toBe(true);
  // Same number of stores, but a different one.
  expect(itemDraftChanged({ ...initial, selections: { s1: 'd1', s3: null } }, initial)).toBe(true);
  const tagged = { ...initial, tags: ['Work', 'Patient'] };
  expect(itemDraftChanged({ ...tagged, tags: ['Work', 'Patient'] }, tagged)).toBe(false);
  expect(itemDraftChanged({ ...tagged, tags: ['Work'] }, tagged)).toBe(true);
  // Removed and added back: now in a different order.
  expect(itemDraftChanged({ ...tagged, tags: ['Patient', 'Work'] }, tagged)).toBe(true);
});

test('item names and brands follow the shared name rules', () => {
  const stores: Store[] = [{ id: 's1', name: 'Shop', departments: [{ id: 'd1', name: 'Deli' }], createdAt: 1 }];
  const draft = { name: 'Milk\u202E', brand: 'b'.repeat(101), selections: { s1: 'd1' }, tags: [] };
  expect(validateItemDraft(draft, stores)).toEqual({
    name: 'Item name contains hidden or control characters, which aren’t allowed.',
    brand: 'Brand is longer than 100 characters.',
  });
});

test('findDuplicateItem finds another item with the same name and brand', () => {
  const items = [
    { id: 'i1', name: 'Milk', brand: 'Acme', locations: [], createdAt: 1 },
    { id: 'i2', name: 'Bread', locations: [], createdAt: 2 },
  ];
  const draft = (name: string, brand = '') => ({ name, brand, selections: {}, tags: [] });
  expect(findDuplicateItem(draft(' milk ', 'ACME'), items)?.id).toBe('i1');
  expect(findDuplicateItem(draft('Bread'), items)?.id).toBe('i2');
  // A different brand (or none) is a different item; an item isn't a duplicate of itself.
  expect(findDuplicateItem(draft('Milk'), items)).toBeUndefined();
  expect(findDuplicateItem(draft('Bread', 'Acme'), items)).toBeUndefined();
  expect(findDuplicateItem(draft('Milk', 'Acme'), items, 'i1')).toBeUndefined();
});
