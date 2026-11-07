import { EMPTY_FILTER } from '@/domain/item-filter';
import { directionLabels, directionSpoken, NEVER_BOUGHT_TITLE, NO_DEPARTMENT_TITLE, sortItems } from '@/domain/item-sort';
import type { Item, Store } from '@/domain/types';

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
      { id: 'b-none', name: 'None' },
    ],
    createdAt: 2,
  },
];

const item = (id: string, name: string, locations: [string, string][]): Item => ({
  id,
  name,
  locations: locations.map(([storeId, departmentId]) => ({ storeId, departmentId })),
  createdAt: 1,
});

const items = [
  item('peas', 'peas', [['bigbox', 'b-frozen']]),
  item('milk', 'Milk', [['corner', 'c-deli']]),
  // Deli at both stores: listed once under Deli.
  item('ham', 'Ham', [
    ['bigbox', 'b-deli'],
    ['corner', 'c-deli'],
  ]),
  // Different departments at each store: listed under both.
  item('salad', 'Salad', [
    ['bigbox', 'b-frozen'],
    ['corner', 'c-produce'],
  ]),
  item('ghost', 'Ghost', [['gone', 'x']]),
  item('odd', 'Odd', [['bigbox', 'b-none']]),
];

const summary = (groups: ReturnType<typeof sortItems>) =>
  groups.map((g) => [g.key, g.title, g.items.map((i) => i.name)]);

test('by name: one ungrouped run, A–Z ignoring case, without mutating the input', () => {
  const before = items.map((i) => i.name);
  expect(summary(sortItems(items, stores, 'name', 'asc', EMPTY_FILTER))).toEqual([
    ['all', null, ['Ghost', 'Ham', 'Milk', 'Odd', 'peas', 'Salad']],
  ]);
  expect(items.map((i) => i.name)).toEqual(before);
});

test('by name, Z–A', () => {
  expect(summary(sortItems(items, stores, 'name', 'desc', EMPTY_FILTER))).toEqual([
    ['all', null, ['Salad', 'peas', 'Odd', 'Milk', 'Ham', 'Ghost']],
  ]);
});

test('by department: one group per name across stores; an item appears under each of its departments', () => {
  expect(summary(sortItems(items, stores, 'department', 'asc', EMPTY_FILTER))).toEqual([
    ['dept:deli', 'Deli', ['Ham', 'Milk']],
    ['dept:frozen', 'Frozen', ['peas', 'Salad']],
    ['dept:none', 'None', ['Odd']],
    ['dept:produce', 'Produce', ['Salad']],
    ['none', NO_DEPARTMENT_TITLE, ['Ghost']],
  ]);
});

test('by department, Z–A: groups and items reversed; No department stays last', () => {
  expect(summary(sortItems(items, stores, 'department', 'desc', EMPTY_FILTER))).toEqual([
    ['dept:produce', 'Produce', ['Salad']],
    ['dept:none', 'None', ['Odd']],
    ['dept:frozen', 'Frozen', ['Salad', 'peas']],
    ['dept:deli', 'Deli', ['Milk', 'Ham']],
    ['none', NO_DEPARTMENT_TITLE, ['Ghost']],
  ]);
});

test('by department: the No department group is left out when empty', () => {
  const groups = sortItems(items.slice(0, 3), stores, 'department', 'asc', EMPTY_FILTER);
  expect(groups.map((g) => g.title)).toEqual(['Deli', 'Frozen']);
});

test('by department: a store filter only uses departments at the selected stores', () => {
  const groups = sortItems([items[3]], stores, 'department', 'asc', { ...EMPTY_FILTER, storeIds: ['corner'] });
  expect(summary(groups)).toEqual([['dept:produce', 'Produce', ['Salad']]]);
});

test('by department: a department filter only uses the picked departments', () => {
  const groups = sortItems([items[3]], stores, 'department', 'asc', { ...EMPTY_FILTER, departments: ['frozen'] });
  expect(summary(groups)).toEqual([['dept:frozen', 'Frozen', ['Salad']]]);
});

describe('by last bought', () => {
  const bought = (name: string, lastBoughtAt?: number): Item => ({
    ...item(name.toLowerCase(), name, []),
    ...(lastBoughtAt === undefined ? {} : { lastBoughtAt }),
  });
  const list = [bought('Zucchini'), bought('Ham', 100), bought('bread', 300), bought('Apples', 300), bought('Eggs')];

  test('newest first; items from the same trip A–Z; never bought last, A–Z', () => {
    const before = list.map((i) => i.name);
    expect(summary(sortItems(list, stores, 'lastBought', 'asc', EMPTY_FILTER))).toEqual([
      ['bought', null, ['Apples', 'bread', 'Ham']],
      ['never', NEVER_BOUGHT_TITLE, ['Eggs', 'Zucchini']],
    ]);
    expect(list.map((i) => i.name)).toEqual(before);
  });

  test('oldest first only reverses the dates', () => {
    expect(summary(sortItems(list, stores, 'lastBought', 'desc', EMPTY_FILTER))).toEqual([
      ['bought', null, ['Ham', 'Apples', 'bread']],
      ['never', NEVER_BOUGHT_TITLE, ['Eggs', 'Zucchini']],
    ]);
  });

  test('empty groups are left out', () => {
    expect(summary(sortItems(list.slice(1, 3), stores, 'lastBought', 'asc', EMPTY_FILTER))).toEqual([
      ['bought', null, ['bread', 'Ham']],
    ]);
    expect(summary(sortItems([list[0]], stores, 'lastBought', 'asc', EMPTY_FILTER))).toEqual([
      ['never', NEVER_BOUGHT_TITLE, ['Zucchini']],
    ]);
    expect(sortItems([], stores, 'lastBought', 'asc', EMPTY_FILTER)).toEqual([]);
  });
});

test('direction names depend on the sort', () => {
  expect(directionLabels('name')).toEqual({ asc: 'A–Z', desc: 'Z–A' });
  expect(directionLabels('department')).toEqual({ asc: 'A–Z', desc: 'Z–A' });
  expect(directionLabels('lastBought')).toEqual({ asc: 'Newest first', desc: 'Oldest first' });
  expect(directionSpoken('name')).toEqual({ asc: 'A to Z', desc: 'Z to A' });
  expect(directionSpoken('lastBought')).toEqual({ asc: 'Newest first', desc: 'Oldest first' });
});
