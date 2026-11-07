import { nameKey } from '@/utils/text';

import { getFilterOptions, type ItemFilter } from './item-filter';
import type { Item, Store } from './types';

/** What the master list is ordered by. */
export type ItemSort = 'name' | 'department' | 'lastBought';

export const ITEM_SORTS: readonly ItemSort[] = ['name', 'department', 'lastBought'];

/**
 * The sort's usual order ('asc') or its reverse ('desc'). For names that's A–Z or Z–A; for last
 * bought it's newest first or oldest first.
 */
export type SortDirection = 'asc' | 'desc';

export const DEFAULT_SORT: ItemSort = 'name';
export const DEFAULT_DIRECTION: SortDirection = 'asc';

export const SORT_LABELS: Record<ItemSort, string> = {
  name: 'Name',
  department: 'Department',
  lastBought: 'Last bought',
};

const ALPHABETICAL: Record<SortDirection, string> = { asc: 'A–Z', desc: 'Z–A' };
const BY_DATE: Record<SortDirection, string> = { asc: 'Newest first', desc: 'Oldest first' };

/** What each direction is called for a sort. */
export const directionLabels = (sort: ItemSort): Record<SortDirection, string> =>
  sort === 'lastBought' ? BY_DATE : ALPHABETICAL;

/** Spoken forms; screen readers stumble over "A–Z". */
export const directionSpoken = (sort: ItemSort): Record<SortDirection, string> =>
  sort === 'lastBought' ? BY_DATE : { asc: 'A to Z', desc: 'Z to A' };

/** A run of items in the master list, under an optional heading. */
export type ItemGroup = {
  key: string;
  /** Heading shown above the group; null when the list isn't grouped. */
  title: string | null;
  items: Item[];
};

export const NO_DEPARTMENT_TITLE = 'No department';
export const NEVER_BOUGHT_TITLE = 'Never bought';

const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/**
 * The department name keys an item is listed under: one per distinct department name among its
 * locations that pass the store and department filters (if any).
 */
function departmentKeys(item: Item, stores: Store[], filter: ItemFilter): string[] {
  const keys = new Set<string>();
  for (const store of stores) {
    if (filter.storeIds.length > 0 && !filter.storeIds.includes(store.id)) continue;
    const loc = item.locations.find((l) => l.storeId === store.id);
    const dept = loc && store.departments.find((d) => d.id === loc.departmentId);
    if (!dept) continue;
    const key = nameKey(dept.name);
    if (filter.departments.length > 0 && !filter.departments.includes(key)) continue;
    keys.add(key);
  }
  return [...keys];
}

/**
 * Orders (already filtered) items for display.
 * - name: one ungrouped run of items by name.
 * - department: one group per department name (ignoring case and spacing, across stores), with
 *   items by name inside. An item in several departments appears in each of them. Items with no
 *   department go last, under "No department", whichever the direction.
 * - lastBought: items by the date they were last bought, newest first, with items bought at the
 *   same time (on one trip) A–Z. Items never bought go last, A–Z, under "Never bought", whichever
 *   the direction.
 * `direction` reverses both the groups and the items within them (for lastBought, only the dates).
 */
export function sortItems(
  items: Item[],
  stores: Store[],
  sort: ItemSort,
  direction: SortDirection,
  filter: ItemFilter,
): ItemGroup[] {
  const sign = direction === 'asc' ? 1 : -1;
  const byName = (a: Item, b: Item) => sign * compareText(a.name, b.name);
  if (sort === 'name') return [{ key: 'all', title: null, items: [...items].sort(byName) }];
  if (sort === 'lastBought') return sortByLastBought(items, sign);

  // Every key comes from a store's department, so it always has a label.
  const labels = new Map(getFilterOptions([], stores).departments.map((o) => [o.key, o.label]));
  const groups = new Map<string, ItemGroup>();
  const none: ItemGroup = { key: 'none', title: NO_DEPARTMENT_TITLE, items: [] };
  for (const item of items) {
    const keys = departmentKeys(item, stores, filter);
    if (keys.length === 0) none.items.push(item);
    for (const key of keys) {
      const group = groups.get(key) ?? { key: `dept:${key}`, title: labels.get(key) as string, items: [] };
      group.items.push(item);
      groups.set(key, group);
    }
  }

  const sorted = [...groups.values()].sort((a, b) => sign * compareText(a.title as string, b.title as string));
  if (none.items.length > 0) sorted.push(none);
  for (const group of sorted) group.items.sort(byName);
  return sorted;
}

function sortByLastBought(items: Item[], sign: number): ItemGroup[] {
  const bought: Item[] = [];
  const never: Item[] = [];
  for (const item of items) (item.lastBoughtAt === undefined ? never : bought).push(item);
  const nameAZ = (a: Item, b: Item) => compareText(a.name, b.name);
  bought.sort(
    (a, b) => sign * ((b.lastBoughtAt as number) - (a.lastBoughtAt as number)) || nameAZ(a, b),
  );
  never.sort(nameAZ);
  const groups: ItemGroup[] = [];
  if (bought.length > 0) groups.push({ key: 'bought', title: null, items: bought });
  if (never.length > 0) groups.push({ key: 'never', title: NEVER_BOUGHT_TITLE, items: never });
  return groups;
}
