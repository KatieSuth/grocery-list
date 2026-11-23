import type { Item, Store } from './types';

/** "Big Box · Deli, Corner Market · Produce" — where an item lives, in store order (A–Z). */
export function describeLocations(item: Item, stores: Store[]): string {
  return stores
    .flatMap((store) => {
      const loc = item.locations.find((l) => l.storeId === store.id);
      const dept = loc && store.departments.find((d) => d.id === loc.departmentId);
      return dept ? [`${store.name} · ${dept.name}`] : [];
    })
    .join(', ');
}

/**
 * The same for screen readers, which stumble over "·": "Deli at Corner Market, Frozen at Big Box",
 * or "No store selected".
 */
export function describeLocationsSpoken(item: Item, stores: Store[]): string {
  const places = stores.flatMap((store) => {
    const loc = item.locations.find((l) => l.storeId === store.id);
    const dept = loc && store.departments.find((d) => d.id === loc.departmentId);
    return dept ? [`${dept.name} at ${store.name}`] : [];
  });
  return places.length > 0 ? places.join(', ') : 'No store selected';
}

/** A store's name with its location, if it has one: "Kroger, Main St". */
export function storeLabel(store: Pick<Store, 'name' | 'location'>): string {
  return store.location ? `${store.name}, ${store.location}` : store.name;
}
