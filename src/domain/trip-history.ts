import { nameKey, normalizeText } from '@/utils/text';
import { storeLabel } from './describe';
import { describeTags } from './tags';

import { distinct, type FilterOption } from './item-filter';
import type { SortDirection } from './item-sort';
import type { TripItem, TripRecord } from './types';

/** The quick choices for which trips to show, by when they were finished. */
export type RangePreset = '30d' | '90d' | '6m' | '1y';

export const RANGE_PRESETS: readonly RangePreset[] = ['30d', '90d', '6m', '1y'];

export const DEFAULT_PRESET: RangePreset = '90d';

export const PRESET_LABELS: Record<RangePreset, string> = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '6m': 'Last 6 months',
  '1y': 'Last year',
};

/**
 * Which days to show trips from: a preset counting back from today, or a custom range of days.
 * Custom days are local midnights (see startOfDay), both included.
 */
export type TripDateRange = { preset: RangePreset } | { preset: 'custom'; from: number; to: number };

/** Search and filter state for the trip log. */
export type TripFilter = {
  /** Matched against the names and brands of the items bought. */
  query: string;
  range: TripDateRange;
  /** Selected store ids. */
  storeIds: string[];
  /** Selected tag keys (see nameKey), matched against the tags items had when bought. */
  tags: string[];
};

export const DEFAULT_RANGE: TripDateRange = { preset: DEFAULT_PRESET };

export const EMPTY_TRIP_FILTER: TripFilter = { query: '', range: DEFAULT_RANGE, storeIds: [], tags: [] };

/** Local midnight at the start of the day `time` falls on. */
export function startOfDay(time: number): number {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** The same local day `days` later (or earlier, if negative), whatever daylight saving does. */
function addDays(day: number, days: number): number {
  const date = new Date(day);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}

/** The same day of the month `months` earlier, or that month's last day if it's shorter (Aug 31 → Feb 28). */
function monthsBefore(day: number, months: number): number {
  const date = new Date(day);
  const target = new Date(date.getFullYear(), date.getMonth() - months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay)).getTime();
}

/**
 * The first and last day shown (local midnights, both included). Presets end today. A custom
 * range never ends after today, and never starts after it ends.
 */
export function rangeDays(range: TripDateRange, now: number): { from: number; to: number } {
  const today = startOfDay(now);
  switch (range.preset) {
    case '30d':
      return { from: addDays(today, -30), to: today };
    case '90d':
      return { from: addDays(today, -90), to: today };
    case '6m':
      return { from: monthsBefore(today, 6), to: today };
    case '1y':
      return { from: monthsBefore(today, 12), to: today };
    case 'custom': {
      const to = Math.min(startOfDay(range.to), today);
      return { from: Math.min(startOfDay(range.from), to), to };
    }
  }
}

/** Whether `time` falls on one of the range's days. */
function inRange(time: number, range: TripDateRange, now: number): boolean {
  const { from, to } = rangeDays(range, now);
  return time >= from && time < addDays(to, 1);
}


const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/**
 * One option per store that has a trip in the log, including stores deleted since, labeled
 * "Corner Market, Main St" from its most recent trip (just "Corner Market" if no location was
 * saved with it: the store's location now is never used). Ordered like stores everywhere: by name,
 * then location (none first).
 */
export function getTripStoreOptions(trips: TripRecord[]): FilterOption[] {
  const byStore = new Map<string, { name: string; location?: string }>();
  // Trips are newest first, so the first one seen for a store is the latest.
  for (const trip of trips) {
    if (!byStore.has(trip.storeId)) {
      byStore.set(trip.storeId, { name: trip.storeName, location: trip.storeLocation });
    }
  }
  return [...byStore.entries()]
    .sort(([, a], [, b]) => compareText(a.name, b.name) || compareText(a.location ?? '', b.location ?? ''))
    .map(([key, { name, location }]) => ({ key, label: storeLabel({ name, location }) }));
}

/** Drops selected stores that no longer have trips in the log. */
/**
 * One option per tag on an item in the log, as it was when bought (ignoring case and spacing).
 * Trips logged before tags existed add none.
 */
export function getTripTagOptions(trips: TripRecord[]): FilterOption[] {
  return distinct(trips.flatMap((trip) => trip.items.flatMap((item) => item.tags ?? [])));
}

/** Drops selected stores and tags that no longer have trips. */
export function pruneTripFilter(filter: TripFilter, storeOptions: FilterOption[], tagOptions: FilterOption[]): TripFilter {
  const keep = (selected: string[], available: FilterOption[]) =>
    selected.filter((key) => available.some((o) => o.key === key));
  return { ...filter, storeIds: keep(filter.storeIds, storeOptions), tags: keep(filter.tags, tagOptions) };
}

/** Number of filters that differ from the defaults (not counting the search): each store and tag, and the dates. */
export function activeTripFilterCount(filter: TripFilter): number {
  return filter.storeIds.length + filter.tags.length + (isDefaultRange(filter.range) ? 0 : 1);
}

export function isDefaultRange(range: TripDateRange): boolean {
  return range.preset === DEFAULT_PRESET;
}

/** Whether a trip bought something whose name or brand contains the search (ignoring case and spacing). */
function boughtMatching(trip: TripRecord, query: string): boolean {
  return trip.items.some(
    (item) => nameKey(item.name).includes(query) || (item.brand !== undefined && nameKey(item.brand).includes(query)),
  );
}

/**
 * Trips finished within the date range, at any of the selected stores (or any store, if none is
 * selected), that bought an item whose name or brand contains the search, and (if tags are
 * selected) an item that had any of them when it was bought. Order is kept.
 */
export function applyTripFilter(trips: TripRecord[], filter: TripFilter, now: number): TripRecord[] {
  const query = nameKey(filter.query);
  const storeIds = new Set(filter.storeIds);
  const tags = new Set(filter.tags);
  return trips.filter(
    (trip) =>
      inRange(trip.finishedAt, filter.range, now) &&
      (storeIds.size === 0 || storeIds.has(trip.storeId)) &&
      (!query || boughtMatching(trip, query)) &&
      (tags.size === 0 || trip.items.some((item) => (item.tags ?? []).some((tag) => tags.has(nameKey(tag))))),
  );
}

/** "Sun, Nov 23, 2026, 4:12 PM": shown on trip rows and the trip's page. */
export function formatTripDate(time: number, locale?: string): string {
  return new Date(time).toLocaleString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "Sunday, November 23, 2026 at 4:12 PM": the same for screen readers, with nothing abbreviated. */
export function formatTripDateSpoken(time: number, locale?: string): string {
  const date = new Date(time);
  const day = date.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const clock = date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  return `${day} at ${clock}`;
}

/** "Nov 23, 2026": a day in a custom date range. */
export function formatDay(day: number, locale?: string): string {
  return new Date(day).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "November 23, 2026": the same for screen readers. */
export function formatDaySpoken(day: number, locale?: string): string {
  return new Date(day).toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** How a trip's items are ordered on its page. */
export type TripItemSort = 'name' | 'department';

export const TRIP_ITEM_SORTS: readonly TripItemSort[] = ['name', 'department'];

export const TRIP_ITEM_SORT_LABELS: Record<TripItemSort, string> = { name: 'Name', department: 'Department' };

/** A run of a trip's items, under an optional department heading. */
export type TripItemGroup = { key: string; title: string | null; items: TripItem[] };

/**
 * Orders a trip's items for its page.
 * - name: one ungrouped run, by name (then brand).
 * - department: one group per department (ignoring case and spacing), with items by name inside.
 * `direction` reverses both the groups and the items within them.
 */
export function sortTripItems(items: TripItem[], sort: TripItemSort, direction: SortDirection): TripItemGroup[] {
  const sign = direction === 'asc' ? 1 : -1;
  const byName = (a: TripItem, b: TripItem) =>
    sign * (compareText(a.name, b.name) || compareText(a.brand ?? '', b.brand ?? ''));
  if (sort === 'name') return [{ key: 'all', title: null, items: [...items].sort(byName) }];

  const groups = new Map<string, TripItemGroup>();
  for (const item of items) {
    const key = nameKey(item.department);
    const group = groups.get(key) ?? { key: `dept:${key}`, title: normalizeText(item.department), items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  const sorted = [...groups.values()].sort((a, b) => sign * compareText(a.title as string, b.title as string));
  for (const group of sorted) group.items.sort(byName);
  return sorted;
}

/** "Ham, Acme, 1 lb, Deli, Tags: Work": everything shown for an item, as screen readers should say it. */
export function describeTripItemSpoken(item: TripItem, withDepartment: boolean): string {
  return [item.name, item.brand, item.quantity, withDepartment ? item.department : undefined, describeTags(item.tags).spoken]
    .filter((part) => part)
    .join(', ');
}

/**
 * The Android calendar works in UTC days: midnight UTC on the same calendar date as a local day,
 * so the calendar opens on the right day whatever the time zone.
 */
export function localDayToUtcDay(day: number): number {
  const date = new Date(day);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/** The local day for a day the Android calendar picked (midnight UTC on that date). */
export function utcDayToLocalDay(utcDay: number): number {
  const date = new Date(utcDay);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()).getTime();
}

/** The last moment of a local day, for pickers whose latest choice is a time, not a day. */
export function endOfDay(day: number): number {
  return addDays(startOfDay(day), 1) - 1;
}
