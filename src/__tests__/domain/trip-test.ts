import { buildTripList } from '@/domain/trip';
import type { Item, ListEntry, Store } from '@/domain/types';

const store: Store = {
  id: 's1',
  name: 'Corner Market',
  departments: [
    { id: 'produce', name: 'Produce' },
    { id: 'bakery', name: 'Bakery' },
    { id: 'deli', name: 'Deli' },
  ],
  createdAt: 1,
};

const item = (id: string, name: string, storeId: string, departmentId: string): Item => ({
  id,
  name,
  locations: [{ storeId, departmentId }],
  createdAt: 1,
});

const items = [
  item('soup', 'soup', 's1', 'deli'),
  item('ham', 'Ham', 's1', 'deli'),
  item('apples', 'Apples', 's1', 'produce'),
  item('bread', 'Bread', 's1', 'bakery'),
  item('peas', 'Peas', 's2', 'frozen'),
  item('ghost', 'Ghost', 's1', 'deleted-department'),
];

const entry = (itemId: string, inCart = false): ListEntry => ({
  itemId,
  checkedAt: 1,
  ...(inCart ? { inCartAt: 2 } : {}),
});

const entries = Object.fromEntries(
  [entry('soup'), entry('ham', true), entry('apples'), entry('peas'), entry('ghost')].map((e) => [e.itemId, e]),
);

const summary = (list: ReturnType<typeof buildTripList>) =>
  list.sections.map((s) => [s.department.name, s.rows.map((r) => `${r.item.name}${r.inCart ? ' ✓' : ''}`)]);

test('lists checked items sold here, by department in walking order, items A–Z', () => {
  const list = buildTripList(store, items, entries, false);
  // Bread isn't checked, so Bakery is left out.
  expect(summary(list)).toEqual([
    ['Produce', ['Apples']],
    ['Deli', ['Ham ✓', 'soup']],
  ]);
  // Peas are at another store; Ghost's department no longer exists here.
  expect(list.elsewhereCount).toBe(2);
  expect(list.inCartCount).toBe(1);
  expect(list.remainingCount).toBe(2);
  expect(list.sections[1].rows[0].entry).toBe(entries.ham);
});

test('reversed: departments in the opposite order, items still A–Z', () => {
  expect(summary(buildTripList(store, items, entries, true))).toEqual([
    ['Deli', ['Ham ✓', 'soup']],
    ['Produce', ['Apples']],
  ]);
  expect(store.departments.map((d) => d.id)).toEqual(['produce', 'bakery', 'deli']);
});

test('nothing checked: no sections', () => {
  expect(buildTripList(store, items, {}, false)).toEqual({
    sections: [],
    elsewhereCount: 0,
    inCartCount: 0,
    remainingCount: 0,
  });
});
