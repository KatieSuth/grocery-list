import { describeLocations } from '@/domain/describe';
import type { Store } from '@/domain/types';

const stores: Store[] = [
  { id: 's1', name: 'Corner', departments: [{ id: 'd1', name: 'Produce' }], createdAt: 1 },
  { id: 's2', name: 'Big Box', departments: [{ id: 'd3', name: 'Frozen' }], createdAt: 2 },
];

test('lists store and department pairs in store order', () => {
  const item = {
    id: 'i',
    name: 'Peas',
    locations: [
      { storeId: 's2', departmentId: 'd3' },
      { storeId: 's1', departmentId: 'd1' },
    ],
    createdAt: 1,
  };
  expect(describeLocations(item, stores)).toBe('Corner · Produce, Big Box · Frozen');
});

test('skips locations with unknown departments', () => {
  const item = { id: 'i', name: 'Peas', locations: [{ storeId: 's1', departmentId: 'x' }], createdAt: 1 };
  expect(describeLocations(item, stores)).toBe('');
});
