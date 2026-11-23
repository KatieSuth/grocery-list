import { compareStores } from '@/domain/store-sort';
import type { Store } from '@/domain/types';

const store = (id: string, name: string, location?: string, createdAt = 1): Store => ({
  id,
  name,
  ...(location !== undefined ? { location } : {}),
  departments: [],
  createdAt,
});

test('stores are ordered A–Z by name, ignoring case and accents', () => {
  const stores = [store('t', 'Trader Joe’s'), store('a', 'aldi'), store('e', 'Épicerie'), store('c', 'Costco')];
  expect([...stores].sort(compareStores).map((s) => s.id)).toEqual(['a', 'c', 'e', 't']);
});

test('stores with the same name are ordered by location, with no location first', () => {
  const stores = [store('main', 'Kroger', 'Main St'), store('elm', 'kroger', 'elm st'), store('none', 'Kroger')];
  expect([...stores].sort(compareStores).map((s) => s.id)).toEqual(['none', 'elm', 'main']);
});

test('stores that still tie keep the order they were added in', () => {
  const stores = [store('second', 'Aldi', undefined, 2), store('first', 'ALDI', undefined, 1)];
  expect([...stores].sort(compareStores).map((s) => s.id)).toEqual(['first', 'second']);
});
