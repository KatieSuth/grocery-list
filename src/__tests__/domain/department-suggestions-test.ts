import { MAX_DEPARTMENT_SUGGESTIONS, suggestDepartments } from '@/domain/departments';
import type { Department, Store } from '@/domain/types';

let n = 0;
const store = (name: string, departments: string[]): Store => ({
  id: name,
  name,
  departments: departments.map((d) => ({ id: `d${n++}`, name: d })),
  createdAt: n++,
});
const dept = (name: string): Department => ({ id: name, name });

const stores = [
  store('Corner Market', ['Produce', 'Bakery', 'Frozen Foods']),
  store('Big Box', ['produce', 'Bulk Bins', 'Frozen']),
  store('Co-op', ['Bulk Bins', 'Kombucha Bar']),
];
const names = (query: string, current: Department[] = []) =>
  suggestDepartments(query, stores, current).map((s) => s.name);

test('nothing is suggested until the user types', () => {
  expect(names('')).toEqual([]);
  expect(names('   ')).toEqual([]);
});

test('matches anywhere in the name, ignoring case and spacing', () => {
  expect(names('BAR')).toEqual(['Kombucha Bar']);
  expect(names('  bulk   ')).toEqual(['Bulk Bins']);
  expect(names('zzz')).toEqual([]);
});

test('merges the same department across stores, keeping the first spelling and listing its stores', () => {
  expect(suggestDepartments('prod', stores, [])).toEqual([
    { name: 'Produce', storeNames: ['Corner Market', 'Big Box'] },
  ]);
});

test('names starting with the query rank first, then more stores, then alphabetical', () => {
  // "Frozen" and "Frozen Foods" start with "fro"; both are used once, so alphabetical.
  expect(names('fro')).toEqual(['Frozen', 'Frozen Foods']);
  // "Bulk Bins" (2 stores) beats "Bakery" (1 store); "Kombucha Bar" only contains "b".
  expect(names('b')).toEqual(['Bulk Bins', 'Bakery', 'Kombucha Bar']);
});

test('skips departments already in the list being edited', () => {
  expect(names('b', [dept('bulk bins')])).toEqual(['Bakery', 'Kombucha Bar']);
});

test('a store listing a name twice is only counted once', () => {
  const dupes = [store('Odd', ['Deli', 'deli'])];
  expect(suggestDepartments('deli', dupes, [])).toEqual([{ name: 'Deli', storeNames: ['Odd'] }]);
});

test(`at most ${MAX_DEPARTMENT_SUGGESTIONS} suggestions`, () => {
  const many = [store('Huge', ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'])];
  expect(suggestDepartments('a', many, [])).toHaveLength(MAX_DEPARTMENT_SUGGESTIONS);
});

test('an identical name in several stores is offered once, listing every store', () => {
  const same = [store('A', ['Bakery']), store('B', ['Bakery']), store('C', ['Bakery'])];
  expect(suggestDepartments('bak', same, [])).toEqual([{ name: 'Bakery', storeNames: ['A', 'B', 'C'] }]);
});
