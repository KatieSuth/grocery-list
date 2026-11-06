import {
  chooseDepartment,
  draftToLocations,
  emptyItemDraft,
  isItemDraftBlank,
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
  expect(draft).toEqual({ name: 'Milk', brand: '', selections: { s2: 'd3', s1: 'd2' } });
  expect(itemToDraft({ ...item, brand: 'Acme' }).brand).toBe('Acme');
  // Output follows the user's store order, not selection order.
  expect(draftToLocations(draft, stores)).toEqual([
    { storeId: 's1', departmentId: 'd2' },
    { storeId: 's2', departmentId: 'd3' },
  ]);
});

test('draftToLocations skips stores without a valid department or that no longer exist', () => {
  const draft = { name: 'x', brand: '', selections: { s1: null, s2: 'nope', gone: 'd1' } };
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
    const draft = { name: 'Milk', brand: '', selections: { s1: 'd1', s2: null } };
    expect(validateItemDraft(draft, stores)).toEqual({
      departments: { s2: 'Choose a department in Big Box.' },
    });
  });

  test('ignores selections for deleted stores', () => {
    const draft = { name: 'Milk', brand: '', selections: { gone: 'd1' } };
    expect(validateItemDraft(draft, stores)).toEqual({ stores: 'Choose at least one store.' });
  });

  test('passes a complete draft', () => {
    expect(validateItemDraft({ name: 'Milk', brand: '', selections: { s1: 'd1' } }, stores)).toEqual({});
  });
});

test('isItemDraftBlank', () => {
  expect(isItemDraftBlank({ name: ' ', brand: '', selections: {} })).toBe(true);
  expect(isItemDraftBlank({ name: 'a', brand: '', selections: {} })).toBe(false);
  expect(isItemDraftBlank({ name: '', brand: 'b', selections: {} })).toBe(false);
  expect(isItemDraftBlank({ name: '', brand: '', selections: { s1: null } })).toBe(false);
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
