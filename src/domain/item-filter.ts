import { nameKey, normalizeText } from '@/utils/text';

import type { Item, Store } from './types';

/** Search and filter state for the master list. */
export type ItemFilter = {
  /** Matched against item names. */
  query: string;
  /** Selected store ids. */
  storeIds: string[];
  /** Selected department name keys (see nameKey); one key covers that name in every store. */
  departments: string[];
  /** Selected brand keys (see nameKey). */
  brands: string[];
};

export const EMPTY_FILTER: ItemFilter = { query: '', storeIds: [], departments: [], brands: [] };

export type FilterOption = { key: string; label: string };

export type FilterOptions = {
  stores: FilterOption[];
  departments: FilterOption[];
  brands: FilterOption[];
};

const startsUppercase = (s: string) => s[0] !== s[0].toLocaleLowerCase();

/**
 * One option per distinct value (ignoring case and spacing), sorted by label. The label is the
 * most common spelling; on a tie, one starting with a capital letter ("Acme" over "acme").
 */
function distinct(labels: string[]): FilterOption[] {
  const spellings = new Map<string, Map<string, number>>();
  for (const raw of labels) {
    const label = normalizeText(raw);
    if (!label) continue;
    const counts = spellings.get(nameKey(label)) ?? new Map<string, number>();
    counts.set(label, (counts.get(label) ?? 0) + 1);
    spellings.set(nameKey(label), counts);
  }
  return [...spellings.entries()]
    .map(([key, counts]) => {
      const [label] = [...counts.entries()].sort(
        ([a, countA], [b, countB]) => countB - countA || Number(startsUppercase(b)) - Number(startsUppercase(a)),
      )[0];
      return { key, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * What the user can filter by: every store (in store order), every department name across all
 * stores, and every brand across all items. Departments and brands appear once each, however
 * many stores or items share them (ignoring case and spacing).
 */
export function getFilterOptions(items: Item[], stores: Store[]): FilterOptions {
  return {
    stores: stores.map((s) => ({ key: s.id, label: s.name })),
    departments: distinct(stores.flatMap((s) => s.departments.map((d) => d.name))),
    brands: distinct(items.flatMap((i) => (i.brand ? [i.brand] : []))),
  };
}

/** Drops selections whose store, department or brand no longer exists. */
export function pruneFilter(filter: ItemFilter, options: FilterOptions): ItemFilter {
  const keep = (selected: string[], available: FilterOption[]) =>
    selected.filter((key) => available.some((o) => o.key === key));
  return {
    query: filter.query,
    storeIds: keep(filter.storeIds, options.stores),
    departments: keep(filter.departments, options.departments),
    brands: keep(filter.brands, options.brands),
  };
}

/** Number of selected filter options (not counting the search text). */
export function activeFilterCount(filter: ItemFilter): number {
  return filter.storeIds.length + filter.departments.length + filter.brands.length;
}

export function hasSearchOrFilters(filter: ItemFilter): boolean {
  return !!normalizeText(filter.query) || activeFilterCount(filter) > 0;
}

/** Adds `key` to the list, or removes it if present. */
export function toggleKey(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

/**
 * Items matching the search and filters.
 * - Search: the item name contains the query (ignoring case and spacing).
 * - Within a filter group, any selected option matches (Deli OR Bakery).
 * - Across groups, all must match (brand AND location).
 * - Store and department are checked on the same location: "Corner Market" + "Deli" means the
 *   item is in the Deli at Corner Market.
 */
export function applyItemFilter(items: Item[], stores: Store[], filter: ItemFilter): Item[] {
  const query = nameKey(filter.query);
  const storeIds = new Set(filter.storeIds);
  const departments = new Set(filter.departments);
  const brands = new Set(filter.brands);

  const departmentKey = (storeId: string, departmentId: string) => {
    const dept = stores.find((s) => s.id === storeId)?.departments.find((d) => d.id === departmentId);
    return dept ? nameKey(dept.name) : undefined;
  };

  return items.filter((item) => {
    if (query && !nameKey(item.name).includes(query)) return false;
    if (brands.size > 0 && !(item.brand && brands.has(nameKey(item.brand)))) return false;
    if (storeIds.size === 0 && departments.size === 0) return true;
    return item.locations.some(
      (loc) =>
        (storeIds.size === 0 || storeIds.has(loc.storeId)) &&
        (departments.size === 0 || departments.has(departmentKey(loc.storeId, loc.departmentId) ?? '')),
    );
  });
}
