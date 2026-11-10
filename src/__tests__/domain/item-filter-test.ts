import {
  activeFilterCount,
  applyItemFilter,
  EMPTY_FILTER,
  getFilterOptions,
  hasSearchOrFilters,
  pruneFilter,
  toggleKey,
  type ItemFilter,
} from '@/domain/item-filter';
import type { Item, ListEntry, Store } from '@/domain/types';

const stores: Store[] = [
  {
    id: 'corner',
    name: 'Corner Market',
    departments: [
      { id: 'c-produce', name: 'Produce' },
      { id: 'c-deli', name: 'Deli' },
    ],
    createdAt: 1,
  },
  {
    id: 'bigbox',
    name: 'Big Box',
    departments: [
      { id: 'b-deli', name: 'deli ' },
      { id: 'b-frozen', name: 'Frozen' },
    ],
    createdAt: 2,
  },
];

const item = (id: string, name: string, brand: string | undefined, locations: [string, string][]): Item => ({
  id,
  name,
  ...(brand ? { brand } : {}),
  locations: locations.map(([storeId, departmentId]) => ({ storeId, departmentId })),
  createdAt: 1,
});

const items = [
  item('milk', 'Whole Milk', 'Acme', [['corner', 'c-deli']]),
  item('ham', 'Ham', 'acme', [['bigbox', 'b-deli']]),
  item('peas', 'Peas', 'Green Giant', [['bigbox', 'b-frozen']]),
  item('apples', 'Apples', undefined, [
    ['corner', 'c-produce'],
    ['bigbox', 'b-frozen'],
  ]),
  item('bread', 'Bread', undefined, []),
];

const entries: Record<string, ListEntry> = {
  milk: { itemId: 'milk', checkedAt: 1 },
  peas: { itemId: 'peas', quantity: '2', checkedAt: 2 },
};

const ids = (filter: Partial<ItemFilter>) =>
  applyItemFilter(items, stores, entries, { ...EMPTY_FILTER, ...filter }).map((i) => i.id);

describe('getFilterOptions', () => {
  test('lists every store, and each department and brand once', () => {
    expect(getFilterOptions(items, stores)).toEqual({
      stores: [
        { key: 'corner', label: 'Corner Market' },
        { key: 'bigbox', label: 'Big Box' },
      ],
      // "Deli" and "deli " are the same department name.
      departments: [
        { key: 'deli', label: 'Deli' },
        { key: 'frozen', label: 'Frozen' },
        { key: 'produce', label: 'Produce' },
      ],
      // "Acme" and "acme" are the same brand; items without a brand add nothing.
      brands: [
        { key: 'acme', label: 'Acme' },
        { key: 'green giant', label: 'Green Giant' },
      ],
    });
  });

  test('is empty when there is nothing yet', () => {
    expect(getFilterOptions([], [])).toEqual({ stores: [], departments: [], brands: [] });
  });
});

describe('applyItemFilter', () => {
  test('no search or filters shows everything', () => {
    expect(ids({})).toEqual(['milk', 'ham', 'peas', 'apples', 'bread']);
  });

  test('search matches anywhere in the name, ignoring case and spacing', () => {
    expect(ids({ query: '  MILK ' })).toEqual(['milk']);
    expect(ids({ query: 'ea' })).toEqual(['peas', 'bread']);
    expect(ids({ query: 'zzz' })).toEqual([]);
  });

  test('search does not look at brands', () => {
    expect(ids({ query: 'acme' })).toEqual([]);
  });

  test('a department matches that name in every store', () => {
    expect(ids({ departments: ['deli'] })).toEqual(['milk', 'ham']);
  });

  test('options within a group are combined with OR', () => {
    expect(ids({ departments: ['deli', 'produce'] })).toEqual(['milk', 'ham', 'apples']);
    expect(ids({ brands: ['acme', 'green giant'] })).toEqual(['milk', 'ham', 'peas']);
  });

  test('a store matches items found there; items without locations never match', () => {
    expect(ids({ storeIds: ['corner'] })).toEqual(['milk', 'apples']);
  });

  test('store and department must match on the same location', () => {
    // Apples are in Produce at Corner and Frozen at Big Box, but not Frozen at Corner.
    expect(ids({ storeIds: ['corner'], departments: ['frozen'] })).toEqual([]);
    expect(ids({ storeIds: ['bigbox'], departments: ['frozen'] })).toEqual(['peas', 'apples']);
  });

  test('groups and search are combined with AND', () => {
    expect(ids({ brands: ['acme'], storeIds: ['bigbox'] })).toEqual(['ham']);
    expect(ids({ brands: ['acme'], query: 'milk' })).toEqual(['milk']);
  });

  test('locations pointing at a missing department do not match a department filter', () => {
    const orphan = [item('x', 'X', undefined, [['corner', 'gone']])];
    expect(applyItemFilter(orphan, stores, {}, { ...EMPTY_FILTER, departments: ['deli'] })).toEqual([]);
  });

  test('checked shows only checked items, unchecked only the rest', () => {
    expect(ids({ checked: 'checked' })).toEqual(['milk', 'peas']);
    expect(ids({ checked: 'unchecked' })).toEqual(['ham', 'apples', 'bread']);
    expect(ids({ checked: 'all' })).toEqual(['milk', 'ham', 'peas', 'apples', 'bread']);
  });

  test('checked state is combined with the other filters with AND', () => {
    expect(ids({ checked: 'checked', storeIds: ['bigbox'] })).toEqual(['peas']);
    expect(ids({ checked: 'unchecked', brands: ['acme'] })).toEqual(['ham']);
  });
});

test('pruneFilter drops selections that no longer exist, keeping the search', () => {
  const options = getFilterOptions(items, stores);
  expect(
    pruneFilter(
      {
        query: 'x',
        storeIds: ['corner', 'gone'],
        departments: ['deli', 'bakery'],
        brands: ['acme', 'old brand'],
        checked: 'unchecked',
      },
      options,
    ),
  ).toEqual({ query: 'x', storeIds: ['corner'], departments: ['deli'], brands: ['acme'], checked: 'unchecked' });
});

test('activeFilterCount and hasSearchOrFilters', () => {
  expect(activeFilterCount(EMPTY_FILTER)).toBe(0);
  expect(
    activeFilterCount({ query: 'x', storeIds: ['a'], departments: ['b', 'c'], brands: ['d'], checked: 'all' }),
  ).toBe(4);
  expect(activeFilterCount({ ...EMPTY_FILTER, checked: 'checked' })).toBe(1);
  expect(activeFilterCount({ ...EMPTY_FILTER, checked: 'unchecked', brands: ['d'] })).toBe(2);
  expect(hasSearchOrFilters(EMPTY_FILTER)).toBe(false);
  expect(hasSearchOrFilters({ ...EMPTY_FILTER, query: '  ' })).toBe(false);
  expect(hasSearchOrFilters({ ...EMPTY_FILTER, query: 'a' })).toBe(true);
  expect(hasSearchOrFilters({ ...EMPTY_FILTER, brands: ['a'] })).toBe(true);
  expect(hasSearchOrFilters({ ...EMPTY_FILTER, checked: 'unchecked' })).toBe(true);
});

test('toggleKey adds and removes', () => {
  expect(toggleKey(['a'], 'b')).toEqual(['a', 'b']);
  expect(toggleKey(['a', 'b'], 'a')).toEqual(['b']);
});

test('a brand label uses its most common spelling, preferring a capital letter on a tie', () => {
  const brandItems = [
    item('a', 'A', 'acme', []),
    item('b', 'B', 'Acme', []),
    item('c', 'C', 'green GIANT', []),
    item('d', 'D', 'green GIANT', []),
    item('e', 'E', 'Green Giant', []),
  ];
  expect(getFilterOptions(brandItems, []).brands).toEqual([
    { key: 'acme', label: 'Acme' },
    { key: 'green giant', label: 'green GIANT' },
  ]);
});

test('blank names never become options', () => {
  const odd: Store[] = [{ id: 's', name: 'S', departments: [{ id: 'd', name: '   ' }], createdAt: 1 }];
  expect(getFilterOptions([item('a', 'A', '  ', [])], odd)).toEqual({
    stores: [{ key: 's', label: 'S' }],
    departments: [],
    brands: [],
  });
});
