import type { Department, Item, ListEntry, Store } from './types';

export type TripRow = {
  item: Item;
  entry: ListEntry;
  /** Checked off on this trip. */
  inCart: boolean;
};

export type TripSection = {
  department: Department;
  /** Items A–Z. */
  rows: TripRow[];
};

export type TripList = {
  /** Departments that have something to get, in walking order (or reversed). */
  sections: TripSection[];
  /** Checked items on the master list that aren't sold at this store. */
  elsewhereCount: number;
  /** Items checked off (in the cart) here. */
  inCartCount: number;
  /** Items still to get here. */
  remainingCount: number;
};

/**
 * What to get at `store`: every checked item that has a department there, grouped by that
 * department in the store's walking order (reversed if `reversed`), items A–Z within each.
 */
export function buildTripList(
  store: Store,
  items: Item[],
  entries: Record<string, ListEntry>,
  reversed: boolean,
): TripList {
  const byDepartment = new Map<string, TripRow[]>();
  let elsewhereCount = 0;
  for (const item of items) {
    const entry = entries[item.id];
    if (!entry) continue;
    const loc = item.locations.find((l) => l.storeId === store.id);
    const department = loc && store.departments.find((d) => d.id === loc.departmentId);
    if (!department) {
      elsewhereCount++;
      continue;
    }
    const rows = byDepartment.get(department.id) ?? [];
    rows.push({ item, entry, inCart: entry.inCartAt !== undefined });
    byDepartment.set(department.id, rows);
  }

  const departments = reversed ? [...store.departments].reverse() : store.departments;
  const sections = departments.flatMap((department) => {
    const rows = byDepartment.get(department.id);
    if (!rows) return [];
    rows.sort((a, b) => a.item.name.localeCompare(b.item.name, undefined, { sensitivity: 'base' }));
    return [{ department, rows }];
  });
  const all = sections.flatMap((s) => s.rows);
  const inCartCount = all.filter((r) => r.inCart).length;
  return { sections, elsewhereCount, inCartCount, remainingCount: all.length - inCartCount };
}
