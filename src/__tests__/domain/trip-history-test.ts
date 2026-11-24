import {
  activeTripFilterCount,
  applyTripFilter,
  describeTripItemSpoken,
  EMPTY_TRIP_FILTER,
  endOfDay,
  formatDay,
  formatDaySpoken,
  formatTripDate,
  formatTripDateSpoken,
  getTripStoreOptions,
  getTripTagOptions,
  isDefaultRange,
  localDayToUtcDay,
  pruneTripFilter,
  rangeDays,
  sortTripItems,
  startOfDay,
  utcDayToLocalDay,
  type TripFilter,
} from '@/domain/trip-history';
import type { TripItem, TripRecord } from '@/domain/types';

/** Local time, so the tests don't depend on the machine's time zone. */
const at = (year: number, month: number, day: number, hour = 0, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime();

// Some ICU versions put a narrow no-break space before "PM".
const plain = (text: string) => text.replace(/\s/g, ' ');

const NOW = at(2026, 11, 23, 15, 30);

const trip = (id: string, finishedAt: number, extra: Partial<TripRecord> = {}): TripRecord => ({
  id,
  storeId: 'corner',
  storeName: 'Corner Market',
  finishedAt,
  items: [{ itemId: 'apples', name: 'Apples', department: 'Produce' }],
  ...extra,
});

describe('date ranges', () => {
  test('presets count back from today and end today', () => {
    expect(rangeDays({ preset: '30d' }, NOW)).toEqual({ from: at(2026, 10, 24), to: at(2026, 11, 23) });
    expect(rangeDays({ preset: '90d' }, NOW)).toEqual({ from: at(2026, 8, 25), to: at(2026, 11, 23) });
    expect(rangeDays({ preset: '6m' }, NOW)).toEqual({ from: at(2026, 5, 23), to: at(2026, 11, 23) });
    expect(rangeDays({ preset: '1y' }, NOW)).toEqual({ from: at(2025, 11, 23), to: at(2026, 11, 23) });
  });

  test('months back land on the last day of a shorter month', () => {
    expect(rangeDays({ preset: '6m' }, at(2026, 8, 31, 9)).from).toBe(at(2026, 2, 28));
    expect(rangeDays({ preset: '1y' }, at(2028, 2, 29, 9)).from).toBe(at(2027, 2, 28));
  });

  test('a custom range never ends after today, nor starts after it ends', () => {
    expect(rangeDays({ preset: 'custom', from: at(2026, 1, 5, 13), to: at(2026, 2, 1, 8) }, NOW)).toEqual({
      from: at(2026, 1, 5),
      to: at(2026, 2, 1),
    });
    expect(rangeDays({ preset: 'custom', from: at(2026, 11, 1), to: at(2027, 1, 1) }, NOW)).toEqual({
      from: at(2026, 11, 1),
      to: at(2026, 11, 23),
    });
    expect(rangeDays({ preset: 'custom', from: at(2026, 12, 25), to: at(2027, 1, 1) }, NOW)).toEqual({
      from: at(2026, 11, 23),
      to: at(2026, 11, 23),
    });
  });

  test('startOfDay is local midnight, and endOfDay the moment before the next one', () => {
    expect(startOfDay(at(2026, 3, 8, 23, 59))).toBe(at(2026, 3, 8));
    expect(endOfDay(at(2026, 3, 8, 12))).toBe(at(2026, 3, 9) - 1);
  });

  test("days convert to and from the Android calendar's UTC days on the same date", () => {
    expect(new Date(localDayToUtcDay(at(2026, 3, 8, 23))).toISOString()).toBe('2026-03-08T00:00:00.000Z');
    expect(utcDayToLocalDay(Date.UTC(2026, 2, 8))).toBe(at(2026, 3, 8));
  });

  test('only the last 90 days are the default', () => {
    expect(isDefaultRange({ preset: '90d' })).toBe(true);
    expect(isDefaultRange({ preset: '30d' })).toBe(false);
    expect(isDefaultRange({ preset: 'custom', from: 1, to: 2 })).toBe(false);
  });
});

describe('filtering trips', () => {
  const trips = [
    trip('today', at(2026, 11, 23, 9), {
      items: [
        { itemId: 'ham', name: 'Ham', brand: 'Acme Foods', department: 'Deli', tags: ['Work', 'Patient'] },
        { itemId: 'peas', name: 'Peas', department: 'Frozen' },
      ],
    }),
    trip('first-day', at(2026, 8, 25, 0, 0), {
      storeId: 'bigbox',
      storeName: 'Big Box',
      items: [{ itemId: 'apples', name: 'Apples', department: 'Produce', tags: ['work '] }],
    }),
    trip('too-old', at(2026, 8, 24, 23, 59)),
  ];
  const filter = (f: Partial<TripFilter>) =>
    applyTripFilter(trips, { ...EMPTY_TRIP_FILTER, ...f }, NOW).map((t) => t.id);

  test('by default, trips from the last 90 days, keeping their order', () => {
    expect(filter({})).toEqual(['today', 'first-day']);
  });

  test('a custom range includes both of its days in full', () => {
    expect(filter({ range: { preset: 'custom', from: at(2026, 8, 24), to: at(2026, 8, 25) } })).toEqual([
      'first-day',
      'too-old',
    ]);
    expect(filter({ range: { preset: 'custom', from: at(2026, 8, 24), to: at(2026, 8, 24) } })).toEqual(['too-old']);
  });

  test('by store: any of the selected stores', () => {
    expect(filter({ storeIds: ['bigbox'] })).toEqual(['first-day']);
    expect(filter({ storeIds: ['bigbox', 'corner'] })).toEqual(['today', 'first-day']);
  });

  test('the search matches item names and brands, ignoring case and spacing', () => {
    expect(filter({ query: '  PEA ' })).toEqual(['today']);
    expect(filter({ query: 'acme   foods' })).toEqual(['today']);
    expect(filter({ query: 'apple' })).toEqual(['first-day']);
    expect(filter({ query: 'milk' })).toEqual([]);
    expect(filter({ query: '   ' })).toEqual(['today', 'first-day']);
  });

  test('by tag: a trip that bought an item with any of the selected tags at the time', () => {
    expect(filter({ tags: ['work'] })).toEqual(['today', 'first-day']);
    expect(filter({ tags: ['patient'] })).toEqual(['today']);
    expect(filter({ tags: ['patient'], storeIds: ['bigbox'] })).toEqual([]);
    // Trips with no tagged items (like those logged before tags existed) never match.
    expect(filter({ tags: ['work'], range: { preset: 'custom', from: at(2026, 8, 24), to: at(2026, 8, 24) } })).toEqual([]);
  });

  test('tag options come from the tags saved with trips', () => {
    expect(getTripTagOptions(trips)).toEqual([
      { key: 'patient', label: 'Patient' },
      { key: 'work', label: 'Work' },
    ]);
    expect(getTripTagOptions([])).toEqual([]);
  });

  test('counts each store and tag, and a changed date range, as filters', () => {
    expect(activeTripFilterCount(EMPTY_TRIP_FILTER)).toBe(0);
    expect(activeTripFilterCount({ ...EMPTY_TRIP_FILTER, tags: ['work', 'patient'], storeIds: ['a'] })).toBe(3);
    expect(activeTripFilterCount({ ...EMPTY_TRIP_FILTER, query: 'ham', storeIds: ['a', 'b'] })).toBe(2);
    expect(activeTripFilterCount({ ...EMPTY_TRIP_FILTER, range: { preset: '1y' }, storeIds: ['a'] })).toBe(2);
  });
});

describe('stores', () => {
  test('one option per store in the log, from its latest trip, ordered by name then location', () => {
    const trips = [
      trip('t1', 5, { storeId: 'k2', storeName: 'Kroger', storeLocation: 'Main St' }),
      trip('t2', 4, { storeId: 'corner', storeName: 'Corner Market' }),
      trip('t3', 3, { storeId: 'k1', storeName: 'kroger' }),
      trip('t4', 2, { storeId: 'k2', storeName: 'Old name', storeLocation: 'Old place' }),
      // Deleted since, and logged before locations were saved.
      trip('t5', 1, { storeId: 'gone', storeName: 'Aldi' }),
      trip('t6', 0, { storeId: 'k3', storeName: 'Kroger', storeLocation: 'Elm St' }),
    ];
    // Only the location saved with a trip is used, never the store's location now.
    expect(getTripStoreOptions(trips)).toEqual([
      { key: 'gone', label: 'Aldi' },
      { key: 'corner', label: 'Corner Market' },
      { key: 'k1', label: 'kroger' },
      { key: 'k3', label: 'Kroger, Elm St' },
      { key: 'k2', label: 'Kroger, Main St' },
    ]);
  });

  test('selected stores and tags with no trips left are dropped', () => {
    const pruned = pruneTripFilter(
      { ...EMPTY_TRIP_FILTER, query: 'x', storeIds: ['a', 'b'], tags: ['work', 'gone'] },
      [{ key: 'b', label: 'B' }],
      [{ key: 'work', label: 'Work' }],
    );
    expect(pruned).toEqual({ ...EMPTY_TRIP_FILTER, query: 'x', storeIds: ['b'], tags: ['work'] });
  });
});

describe('dates as shown and spoken', () => {
  const time = at(2026, 11, 22, 16, 5);
  test('trip times', () => {
    expect(plain(formatTripDate(time, 'en-US'))).toBe('Sun, Nov 22, 2026, 4:05 PM');
    expect(plain(formatTripDateSpoken(time, 'en-US'))).toBe('Sunday, November 22, 2026 at 4:05 PM');
  });
  test('days', () => {
    expect(formatDay(time, 'en-US')).toBe('Nov 22, 2026');
    expect(formatDaySpoken(time, 'en-US')).toBe('November 22, 2026');
  });
});

describe("a trip's items", () => {
  const items: TripItem[] = [
    { itemId: 'soup2', name: 'soup', brand: 'Zesty', department: 'Canned' },
    { itemId: 'ham', name: 'Ham', brand: 'Acme', quantity: '1 lb', department: 'Deli' },
    { itemId: 'soup', name: 'Soup', department: 'canned ' },
    { itemId: 'apples', name: 'Apples', department: 'Produce' },
    { itemId: 'soup3', name: 'Soup', brand: 'Acme', department: 'Canned' },
  ];
  const ids = (groups: ReturnType<typeof sortTripItems>) =>
    groups.map((g) => [g.title, g.items.map((i) => i.itemId)]);

  test('by name, A to Z or Z to A, then by brand', () => {
    expect(ids(sortTripItems(items, 'name', 'asc'))).toEqual([[null, ['apples', 'ham', 'soup', 'soup3', 'soup2']]]);
    expect(ids(sortTripItems(items, 'name', 'desc'))).toEqual([[null, ['soup2', 'soup3', 'soup', 'ham', 'apples']]]);
  });

  test('by department, grouping departments that differ only in case or spacing', () => {
    expect(ids(sortTripItems(items, 'department', 'asc'))).toEqual([
      ['Canned', ['soup', 'soup3', 'soup2']],
      ['Deli', ['ham']],
      ['Produce', ['apples']],
    ]);
    expect(ids(sortTripItems(items, 'department', 'desc'))).toEqual([
      ['Produce', ['apples']],
      ['Deli', ['ham']],
      ['Canned', ['soup2', 'soup3', 'soup']],
    ]);
  });

  test('spoken with everything shown, leaving out blanks', () => {
    expect(describeTripItemSpoken(items[1], true)).toBe('Ham, Acme, 1 lb, Deli');
    expect(describeTripItemSpoken(items[1], false)).toBe('Ham, Acme, 1 lb');
    expect(describeTripItemSpoken(items[3], true)).toBe('Apples, Produce');
    expect(describeTripItemSpoken({ ...items[3], tags: ['Work', 'Patient'] }, false)).toBe('Apples, Tags: Work, Patient');
  });
});
