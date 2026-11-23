import { act, cleanup, fireEvent, screen, within } from 'expo-router/testing-library';
import { Platform } from 'react-native';

import type { AppDatabase } from '@/db/database';
import {
  formatDaySpoken,
  formatTripDate,
  formatTripDateSpoken,
  localDayToUtcDay,
  startOfDay,
} from '@/domain/trip-history';
import type { TripRecord } from '@/domain/types';
import { eventually, renderApp } from '@/test-utils/app';
import { closeTestDatabases } from '@/test-utils/db';

jest.mock('@/db/database', () => ({
  ...jest.requireActual('@/db/database'),
  getAppDatabase: jest.fn(),
}));
jest.mock('@expo/ui/jetpack-compose', () => jest.requireActual('@/test-utils/expo-ui-mock').jetpackCompose);
jest.mock('@expo/ui/swift-ui', () => jest.requireActual('@/test-utils/expo-ui-mock').swiftUI);

afterEach(async () => {
  jest.restoreAllMocks();
  await cleanup();
  jest.useRealTimers();
  await closeTestDatabases();
});

const DAY = 24 * 60 * 60 * 1000;
/** Midday, `days` ago: well inside that day whatever the time now. */
const daysAgo = (days: number) => startOfDay(Date.now()) - days * DAY + DAY / 2;

const RECENT = daysAgo(2);
const LAST_MONTH = daysAgo(40);
const OLDER = daysAgo(100);
const LONG_AGO = daysAgo(200);

async function seed(db: AppDatabase, trips: TripRecord[] = TRIPS) {
  await db.settings.insert({ id: 'app', setupComplete: true });
  await db.stores.insert({ id: 'corner', name: 'Corner Market', location: 'Elm St', departments: [], createdAt: 1 });
  await db.stores.insert({ id: 'bigbox', name: 'Big Box', departments: [], createdAt: 2 });
  for (const trip of trips) await db.trips.insert(trip);
}

const TRIPS: TripRecord[] = [
  {
    id: 'recent',
    storeId: 'corner',
    storeName: 'Corner Market',
    storeLocation: 'Main St',
    finishedAt: RECENT,
    items: [
      { itemId: 'soup', name: 'Soup', department: 'Canned' },
      { itemId: 'ham', name: 'Ham', brand: 'Acme', quantity: '1 lb', department: 'Deli' },
      { itemId: 'apples', name: 'Apples', department: 'Produce' },
      { itemId: 'beans', name: 'Beans', quantity: '2', department: 'canned' },
    ],
  },
  {
    id: 'last-month',
    storeId: 'bigbox',
    storeName: 'Big Box',
    finishedAt: LAST_MONTH,
    items: [{ itemId: 'peas', name: 'Peas', department: 'Frozen' }],
  },
  // Logged before locations were saved: shows the store's current one.
  {
    id: 'older',
    storeId: 'corner',
    storeName: 'Corner Market',
    finishedAt: OLDER,
    items: [{ itemId: 'bread', name: 'Bread', department: 'Bakery' }],
  },
  // At a store deleted since.
  {
    id: 'long-ago',
    storeId: 'gone',
    storeName: 'Aldi',
    finishedAt: LONG_AGO,
    items: [{ itemId: 'milk', name: 'Milk', department: 'Dairy' }],
  },
  // Still being finished: not shown.
  {
    id: 'pending',
    storeId: 'bigbox',
    storeName: 'Big Box',
    finishedAt: daysAgo(1),
    pending: true,
    items: [{ itemId: 'peas', name: 'Peas', department: 'Frozen' }],
  },
];

/** Queries limited to the history screen: native tabs keep the other tabs mounted in Jest. */
const history = () => within(screen.getByTestId('trip-history'));
const pressIn = async (scope: () => ReturnType<typeof within>, name: string | RegExp) =>
  fireEvent.press(await scope().findByRole('button', { name }));
const press = (name: string | RegExp) => pressIn(history, name);

/** The trips listed, as their cards are announced. */
const listed = () =>
  history()
    .queryAllByRole('button', { name: /\. .* at .*\.$/ })
    .map((el) => el.props.accessibilityLabel as string);

const card = (place: string, time: number) => `${place}. ${formatTripDateSpoken(time)}.`;

const RECENT_CARD = card('Corner Market, Main St', RECENT);
const LAST_MONTH_CARD = card('Big Box', LAST_MONTH);
const OLDER_CARD = card('Corner Market, Elm St', OLDER);
const LONG_AGO_CARD = card('Aldi', LONG_AGO);

async function openHistory(trips?: TripRecord[]) {
  const db = await renderApp({ initialUrl: '/trip', seed: (db) => seed(db, trips) });
  const button = await screen.findByRole('button', { name: 'Trip history' });
  expect(button).toHaveProp('accessibilityHint', 'Shows your past shopping trips');
  await fireEvent.press(button);
  await screen.findByTestId('trip-history');
  return db;
}

/** Chooses a day in the From or To field, the way each platform's picker reports it. */
async function chooseDay(label: 'From' | 'To', day: number) {
  if (Platform.OS === 'ios') {
    const picker = history().getByTestId(`date-picker-${label}`);
    // The picker reports a moment on that day.
    await act(async () => picker.props.onDateChange(new Date(day + DAY / 3)));
    return;
  }
  await press(new RegExp(`^${label}, `));
  const dialog = history().getByTestId('date-picker-dialog');
  // The calendar opens on the current day, and reports the chosen one as midnight UTC.
  expect(new Date(dialog.props.initialDate).getUTCHours()).toBe(0);
  await act(async () => dialog.props.onDateSelected(new Date(localDayToUtcDay(day))));
  expect(history().queryByTestId('date-picker-dialog')).toBeNull();
}

test('the history icon opens the trip log, which says when there are no trips yet', async () => {
  await openHistory([]);
  expect(history().getByText('No trips yet')).toBeOnTheScreen();
  // Nothing to count yet.
  expect(history().queryByText(/trips?, last 90 days/)).toBeNull();
});

test('trips from the last 90 days are listed, newest first, with store, location and date', async () => {
  await openHistory();
  expect(listed()).toEqual([RECENT_CARD, LAST_MONTH_CARD]);
  expect(history().getByText('2 trips, last 90 days')).toBeOnTheScreen();
  // Shown: the store, its location, and the date and time; no items.
  expect(history().getByText('Main St')).toBeOnTheScreen();
  expect(history().getByText(formatTripDate(RECENT))).toBeOnTheScreen();
  expect(history().queryByText('Ham')).toBeNull();
  expect(history().getByRole('button', { name: RECENT_CARD })).toHaveProp(
    'accessibilityHint',
    'Shows the items bought on this trip',
  );
});

test('date presets, custom dates and stores narrow the list, and can be cleared', async () => {
  await openHistory();
  const filterButton = () => history().getByRole('button', { name: /^Filter trips, / });
  expect(filterButton()).toHaveProp('accessibilityLabel', 'Filter trips, last 90 days');
  expect(filterButton()).not.toBeExpanded();
  await fireEvent.press(filterButton());
  expect(filterButton()).toBeExpanded();
  expect(history().getByRole('header', { name: 'Dates' })).toBeOnTheScreen();
  expect(history().getByRole('radio', { name: 'Last 90 days' })).toBeChecked();

  await fireEvent.press(history().getByRole('radio', { name: 'Last 30 days' }));
  expect(listed()).toEqual([RECENT_CARD]);
  expect(filterButton()).toHaveProp('accessibilityLabel', 'Filter trips, last 30 days, 1 filter on');
  expect(history().getByText('1 trip, last 30 days')).toBeOnTheScreen();

  await fireEvent.press(history().getByRole('radio', { name: 'Last 6 months' }));
  expect(listed()).toEqual([RECENT_CARD, LAST_MONTH_CARD, OLDER_CARD]);
  await fireEvent.press(history().getByRole('radio', { name: 'Last year' }));
  expect(listed()).toEqual([RECENT_CARD, LAST_MONTH_CARD, OLDER_CARD, LONG_AGO_CARD]);

  // Stores: every store with a trip, including deleted ones.
  await press('Stores');
  expect(
    history()
      .getAllByRole('checkbox')
      .map((el) => el.props.accessibilityLabel),
  ).toEqual(['Stores: Aldi', 'Stores: Big Box', 'Stores: Corner Market, Main St']);
  await fireEvent.press(history().getByRole('checkbox', { name: 'Stores: Corner Market, Main St' }));
  expect(history().getByRole('checkbox', { name: 'Stores: Corner Market, Main St' })).toBeChecked();
  expect(listed()).toEqual([RECENT_CARD, OLDER_CARD]);
  expect(filterButton()).toHaveProp('accessibilityLabel', 'Filter trips, last year, 2 filters on');
  expect(history().getByText('2 filters on')).toBeOnTheScreen();

  // Clearing filters goes back to the last 90 days at every store.
  await press('Clear filters');
  expect(listed()).toEqual([RECENT_CARD, LAST_MONTH_CARD]);
  expect(filterButton()).toHaveProp('accessibilityLabel', 'Filter trips, last 90 days');
  expect(history().queryByText(/filters? on/)).toBeNull();
});

test('a custom range starts from the days shown, and never goes past today', async () => {
  await openHistory();
  await press(/^Filter trips, /);
  await fireEvent.press(history().getByRole('radio', { name: 'Custom dates' }));
  const today = startOfDay(Date.now());
  const ninetyDaysAgo = startOfDay(daysAgo(90));
  if (Platform.OS === 'ios') {
    const from = history().getByTestId('date-picker-From');
    const to = history().getByTestId('date-picker-To');
    expect(from.props.selection.getTime()).toBe(ninetyDaysAgo);
    // From can't be after To; To can't be before From or after today.
    expect(from.props.range).toEqual({ start: undefined, end: new Date(today + DAY - 1) });
    expect(to.props.range).toEqual({ start: new Date(ninetyDaysAgo), end: new Date(today + DAY - 1) });
  } else {
    expect(history().getByRole('button', { name: `From, ${formatDaySpoken(ninetyDaysAgo)}` })).toHaveProp(
      'accessibilityHint',
      'Opens a calendar to choose the day',
    );
    await press(/^To, /);
    expect(history().getByTestId('date-picker-dialog').props.selectableDates).toEqual({
      start: new Date(ninetyDaysAgo),
      end: new Date(today),
    });
    // Closing the calendar without choosing changes nothing.
    await act(async () => history().getByTestId('date-picker-dialog').props.onDismissRequest());
    expect(history().queryByTestId('date-picker-dialog')).toBeNull();
    await press(/^From, /);
    expect(history().getByTestId('date-picker-dialog').props.selectableDates).toEqual({
      start: undefined,
      end: new Date(today),
    });
    await act(async () => history().getByTestId('date-picker-dialog').props.onDismissRequest());
  }
  expect(listed()).toEqual([RECENT_CARD, LAST_MONTH_CARD]);
  expect(history().getByRole('button', { name: /^Filter trips, / })).toHaveProp(
    'accessibilityLabel',
    `Filter trips, ${formatDaySpoken(ninetyDaysAgo)} to ${formatDaySpoken(today)}, 1 filter on`,
  );

  await chooseDay('From', startOfDay(daysAgo(120)));
  await chooseDay('To', startOfDay(daysAgo(50)));
  expect(listed()).toEqual([OLDER_CARD]);
  if (Platform.OS !== 'ios') {
    expect(history().getByRole('button', { name: `To, ${formatDaySpoken(startOfDay(daysAgo(50)))}` })).toBeOnTheScreen();
  }
  expect(history().getByText(`1 trip, ${formatDaySpoken(startOfDay(daysAgo(120)))} to ${formatDaySpoken(startOfDay(daysAgo(50)))}`)).toBeOnTheScreen();
});

test('the search finds trips that bought an item or brand, within the filters', async () => {
  await openHistory();
  const search = history().getByLabelText('Search items or brands bought');
  await fireEvent.changeText(search, '  ACME ');
  expect(listed()).toEqual([RECENT_CARD]);
  expect(history().getByText('1 trip bought “ACME”, last 90 days')).toBeOnTheScreen();

  // Bread was bought on a trip older than 90 days.
  await fireEvent.changeText(search, 'bread');
  expect(listed()).toEqual([]);
  expect(history().getByText('No matching trips')).toBeOnTheScreen();
  expect(history().getByText('Try a different search, other dates, or fewer stores.')).toBeOnTheScreen();
  await press(/^Filter trips, /);
  await fireEvent.press(history().getByRole('radio', { name: 'Last year' }));
  expect(listed()).toEqual([OLDER_CARD]);

  // Clearing the filters keeps the search.
  await press('Clear filters');
  expect(listed()).toEqual([]);
  expect(search).toHaveDisplayValue('bread');
  await press('Clear search and filters');
  expect(listed()).toEqual([RECENT_CARD, LAST_MONTH_CARD]);
  expect(search).toHaveDisplayValue('');

  // With no search, the hint is about the filters only.
  await press('Stores');
  await fireEvent.press(history().getByRole('checkbox', { name: 'Stores: Aldi' }));
  expect(history().getByText('Try other dates, or fewer stores.')).toBeOnTheScreen();
});

test('a store selected for a trip that is then deleted from the log no longer filters', async () => {
  const db = await openHistory();
  await press(/^Filter trips, /);
  await fireEvent.press(history().getByRole('radio', { name: 'Last year' }));
  await press('Stores');
  await fireEvent.press(history().getByRole('checkbox', { name: 'Stores: Aldi' }));
  expect(listed()).toEqual([LONG_AGO_CARD]);
  await act(async () => {
    await (await db.trips.findOne('long-ago').exec())?.remove();
  });
  await eventually(async () => expect(listed()).toEqual([RECENT_CARD, LAST_MONTH_CARD, OLDER_CARD]));
  expect(history().getByRole('button', { name: /^Filter trips, / })).toHaveProp(
    'accessibilityLabel',
    'Filter trips, last year, 1 filter on',
  );
});

/** Queries limited to the trip's page. */
const detail = () => within(screen.getByTestId('trip-detail'));

/** Department headings and items, in display order, as announced. */
const detailRows = () =>
  detail()
    .getAllByTestId(/^trip-item/)
    .map((el) =>
      el.props.testID === 'trip-item-heading' ? `# ${el.props.children}` : (el.props.accessibilityLabel as string),
    );

test("tapping a trip lists what was bought, A to Z, and can sort by department and reverse", async () => {
  await openHistory();
  await press(RECENT_CARD);
  await screen.findByTestId('trip-detail');

  expect(
    detail().getByRole('header', {
      name: `Corner Market, Main St. ${formatTripDateSpoken(RECENT)}. 4 items bought.`,
    }),
  ).toBeOnTheScreen();
  expect(detail().getByText(`${formatTripDate(RECENT)} · 4 items`)).toBeOnTheScreen();

  const spoken = detailRows;
  expect(detail().getByRole('radio', { name: 'Sort by name' })).toBeChecked();
  expect(detail().getByRole('radio', { name: 'A to Z' })).toBeChecked();
  expect(spoken()).toEqual(['Apples, Produce', 'Beans, 2, canned', 'Ham, Acme, 1 lb, Deli', 'Soup, Canned']);
  expect(detail().getByText('Acme · 1 lb · Deli')).toBeOnTheScreen();

  await fireEvent.press(detail().getByRole('radio', { name: 'Z to A' }));
  expect(spoken()).toEqual(['Soup, Canned', 'Ham, Acme, 1 lb, Deli', 'Beans, 2, canned', 'Apples, Produce']);

  // By department: headed groups, without repeating the department on each item.
  await fireEvent.press(detail().getByRole('radio', { name: 'Sort by department' }));
  await fireEvent.press(detail().getByRole('radio', { name: 'A to Z' }));
  expect(detailRows()).toEqual(['# Canned', 'Beans, 2', 'Soup', '# Deli', 'Ham, Acme, 1 lb', '# Produce', 'Apples']);
  await fireEvent.press(detail().getByRole('radio', { name: 'Z to A' }));
  expect(detailRows()).toEqual(['# Produce', 'Apples', '# Deli', 'Ham, Acme, 1 lb', '# Canned', 'Soup', 'Beans, 2']);
});

test('a trip with no location says so in its header', async () => {
  await openHistory();
  await press(LAST_MONTH_CARD);
  expect(
    await screen.findByRole('header', { name: `Big Box. ${formatTripDateSpoken(LAST_MONTH)}. 1 item bought.` }),
  ).toBeOnTheScreen();
});

test('a trip no longer in the log says so', async () => {
  await renderApp({ initialUrl: '/trip/history/missing', seed: (db) => seed(db) });
  expect(await screen.findByText('Trip not found')).toBeOnTheScreen();
  expect(screen.getByText('This trip is no longer in the log.')).toBeOnTheScreen();
});
