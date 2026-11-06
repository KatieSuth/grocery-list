import type { Item, Store } from './types';

/** "Corner Market · Produce, Big Box · Deli" — where an item lives, in store order. */
export function describeLocations(item: Item, stores: Store[]): string {
  return stores
    .flatMap((store) => {
      const loc = item.locations.find((l) => l.storeId === store.id);
      const dept = loc && store.departments.find((d) => d.id === loc.departmentId);
      return dept ? [`${store.name} · ${dept.name}`] : [];
    })
    .join(', ');
}
