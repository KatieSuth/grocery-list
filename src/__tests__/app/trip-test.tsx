import { router } from 'expo-router';
import { act, cleanup, fireEvent, screen, within } from 'expo-router/testing-library';
import { Alert, Platform, type AlertButton } from 'react-native';

import { Colors } from '@/constants/theme';
import type { AppDatabase } from '@/db/database';
import { eventually, renderApp } from '@/test-utils/app';
import { closeTestDatabases } from '@/test-utils/db';

jest.mock('@/db/database', () => ({
  ...jest.requireActual('@/db/database'),
  getAppDatabase: jest.fn(),
}));

afterEach(async () => {
  jest.restoreAllMocks();
  await cleanup();
  jest.useRealTimers();
  await closeTestDatabases();
});

async function seed(db: AppDatabase, settings: { tripStoreId?: string } = {}) {
  await db.settings.insert({ id: 'app', setupComplete: true, ...settings });
  await db.stores.insert({
    id: 'corner',
    name: 'Corner Market',
    location: 'Main St',
    departments: [
      { id: 'c-produce', name: 'Produce' },
      { id: 'c-bakery', name: 'Bakery' },
      { id: 'c-deli', name: 'Deli' },
    ],
    createdAt: 1,
  });
  await db.stores.insert({
    id: 'bigbox',
    name: 'Big Box',
    departments: [
      { id: 'b-frozen', name: 'Frozen' },
      { id: 'b-deli', name: 'Deli' },
    ],
    createdAt: 2,
  });
  const add = (id: string, name: string, locations: [string, string][], brand?: string) =>
    db.items.insert({
      id,
      name,
      ...(brand ? { brand } : {}),
      locations: locations.map(([storeId, departmentId]) => ({ storeId, departmentId })),
      createdAt: 1,
    });
  await add('apples', 'Apples', [['corner', 'c-produce']]);
  await add('bread', 'Bread', [['corner', 'c-bakery']]);
  await add('ham', 'Ham', [['corner', 'c-deli'], ['bigbox', 'b-deli']], 'Acme');
  await add('peas', 'Peas', [['bigbox', 'b-frozen']]);
  await db.listEntries.insert({ itemId: 'apples', checkedAt: 1 });
  await db.listEntries.insert({ itemId: 'ham', quantity: '1 lb', checkedAt: 1 });
  // Left in the cart by an earlier trip whose store was deleted.
  await db.listEntries.insert({ itemId: 'peas', checkedAt: 1, inCartAt: 1 });
}

/**
 * Queries limited to the Trip screen: native tabs keep the other tabs mounted in Jest, and the
 * Items tab has checkboxes with the same names.
 */
const trip = () => within(screen.getByTestId('trip-screen'));
const press = async (name: string | RegExp) =>
  fireEvent.press(await trip().findByRole('button', { name }));
const checkbox = (name: string) => trip().getByRole('checkbox', { name });

/** Answers every Alert by pressing the button with the given text; returns the spy. */
function answerAlertsWith(text: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((b) => b.text === text)?.onPress?.();
  });
}

/** Department headings and item rows, in display order; checked-off rows end in ✓. */
const tripRows = () =>
  trip()
    .queryAllByRole(/^(header|checkbox)$/)
    .map((el) =>
      el.props.accessibilityRole === 'header'
        ? `# ${el.props.children}`
        : `${el.props.accessibilityLabel}${el.props['aria-checked'] ? ' ✓' : ''}`,
    );

async function chooseStore(name: string) {
  await press(/^(Store: .*|Choose a store)$/);
  await press(new RegExp(`^${name}(,|$)`));
}

const entry = async (db: AppDatabase, itemId: string) => (await db.listEntries.findOne(itemId).exec())?.toJSON();

test('choosing a store lists what to get there, by department in walking order', async () => {
  const db = await renderApp({ initialUrl: '/trip', seed: (db) => seed(db) });
  expect(await screen.findByText('Where are you shopping?')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Finish trip' })).toBeNull();

  // The dropdown lists the stores; Cancel closes it.
  await press('Choose a store');
  expect(screen.getByText('Which store are you at?')).toBeOnTheScreen();
  expect(trip().getByRole('button', { name: 'Corner Market, Main St' })).toBeOnTheScreen();
  await press('Cancel choosing a store');
  expect(screen.queryByText('Which store are you at?')).toBeNull();

  await chooseStore('Corner Market');
  expect(await screen.findByRole('button', { name: 'Store: Corner Market' })).toBeOnTheScreen();
  expect(trip().getByText('Main St')).toBeOnTheScreen();
  // Bread isn't checked, so there's no Bakery heading.
  expect(tripRows()).toEqual(['# Produce', 'Apples', '# Deli', 'Ham, Acme, 1 lb']);
  expect(screen.getByText('0 of 2 in cart')).toBeOnTheScreen();
  expect(screen.getByText("1 checked item isn't sold at Corner Market.")).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Finish trip' })).toBeDisabled();
  // A new trip starts with an empty cart, so the stale Peas entry was cleared.
  await eventually(async () => expect((await entry(db, 'peas'))?.inCartAt).toBeUndefined());

  // The choice is remembered.
  expect((await db.settings.findOne('app').exec())?.tripStoreId).toBe('corner');

  // Reverse order, for walking the store the other way.
  // The track is visible when off, not just when on.
  const reverseSwitch = trip().getByLabelText('Reverse order');
  const [offProp, onProp] = Platform.OS === 'ios' ? ['tintColor', 'onTintColor'] : ['trackColorForFalse', 'trackColorForTrue'];
  expect(reverseSwitch).toHaveProp(offProp, Colors.light.switchTrackOff);
  expect(reverseSwitch).toHaveProp(onProp, Colors.light.tint);
  await fireEvent(trip().getByLabelText('Reverse order'), 'valueChange', true);
  await eventually(async () => expect(tripRows()).toEqual(['# Deli', 'Ham, Acme, 1 lb', '# Produce', 'Apples']));
  expect((await db.settings.findOne('app').exec())?.tripReversed).toBe(true);

  // The current store is marked in the dropdown; choosing it again changes nothing.
  const alert = jest.spyOn(Alert, 'alert');
  await press('Store: Corner Market');
  await press('Corner Market, Main St, current');
  expect(alert).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Store: Corner Market' })).toBeOnTheScreen();
});

test('checking off keeps items on the list until the trip is finished and confirmed', async () => {
  const db = await renderApp({ initialUrl: '/trip', seed: (db) => seed(db, { tripStoreId: 'corner' }) });
  await trip().findByRole('checkbox', { name: 'Ham, Acme, 1 lb' });

  await fireEvent.press(checkbox('Ham, Acme, 1 lb'));
  await eventually(async () => expect(screen.getByText('1 of 2 in cart')).toBeOnTheScreen());
  expect(checkbox('Ham, Acme, 1 lb')).toBeChecked();
  // Still checked on the master list.
  expect(await entry(db, 'ham')).toMatchObject({ quantity: '1 lb', inCartAt: expect.any(Number) });

  // Unchecking puts it back.
  await fireEvent.press(checkbox('Ham, Acme, 1 lb'));
  await eventually(async () => expect(screen.getByText('0 of 2 in cart')).toBeOnTheScreen());
  await fireEvent.press(checkbox('Ham, Acme, 1 lb'));
  await eventually(async () => expect(screen.getByRole('button', { name: 'Finish trip' })).toBeEnabled());

  // Cancelling the confirmation changes nothing.
  const cancel = answerAlertsWith('Cancel');
  await press('Finish trip');
  expect(cancel).toHaveBeenCalledWith(
    'Finish your trip at Corner Market?',
    "1 item you checked off will be logged as bought and unchecked from your list. 1 item you didn't check off will stay on your list.",
    expect.any(Array),
  );
  expect(await db.trips.count().exec()).toBe(0);
  cancel.mockRestore();

  answerAlertsWith('Finish trip');
  await press('Finish trip');
  expect(await screen.findByText('Trip finished: 1 item logged as bought.')).toBeOnTheScreen();
  // The trip is over, so the store is cleared and the next trip starts by choosing one.
  expect(await screen.findByText('Where are you shopping?')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Choose a store' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Finish trip' })).toBeNull();
  await eventually(async () => expect((await db.settings.findOne('app').exec())?.tripStoreId).toBeUndefined());

  const [logged] = (await db.trips.find().exec()).map((t) => t.toJSON());
  expect(logged).toMatchObject({
    storeId: 'corner',
    storeName: 'Corner Market',
    items: [{ itemId: 'ham', name: 'Ham', brand: 'Acme', quantity: '1 lb', department: 'Deli' }],
  });
  expect(await entry(db, 'ham')).toBeUndefined();
  expect((await db.items.findOne('ham').exec())?.lastBoughtAt).toBe(logged.finishedAt);

  // The master list shows it unchecked, bought today.
  await act(() => router.navigate('/'));
  expect(await screen.findByText('Last bought today')).toBeOnTheScreen();
  const items = within(screen.getByTestId('master-list'));
  expect(items.getByRole('checkbox', { name: 'Ham' })).not.toBeChecked();
  expect(items.getByRole('checkbox', { name: 'Apples' })).toBeChecked();
});

test('finishing with everything checked off says nothing about items left behind', async () => {
  await renderApp({ initialUrl: '/trip', seed: (db) => seed(db, { tripStoreId: 'corner' }) });
  await fireEvent.press(await trip().findByRole('checkbox', { name: 'Apples' }));
  await fireEvent.press(checkbox('Ham, Acme, 1 lb'));
  await eventually(async () => expect(screen.getByText('2 of 2 in cart')).toBeOnTheScreen());

  const alert = answerAlertsWith('Finish trip');
  await press('Finish trip');
  expect(alert).toHaveBeenCalledWith(
    'Finish your trip at Corner Market?',
    '2 items you checked off will be logged as bought and unchecked from your list.',
    expect.any(Array),
  );
  expect(await screen.findByText('Trip finished: 2 items logged as bought.')).toBeOnTheScreen();
  expect(await screen.findByText('Where are you shopping?')).toBeOnTheScreen();
});

test('switching stores with items checked off asks to finish first', async () => {
  const db = await renderApp({ initialUrl: '/trip', seed: (db) => seed(db, { tripStoreId: 'corner' }) });
  await fireEvent.press(await trip().findByRole('checkbox', { name: 'Apples' }));
  await eventually(async () => expect(screen.getByText('1 of 2 in cart')).toBeOnTheScreen());

  // Not yet: stay at Corner Market with the cart as it was.
  const notYet = answerAlertsWith('Not yet');
  await chooseStore('Big Box');
  expect(notYet).toHaveBeenCalledWith(
    'Done with your trip at Corner Market?',
    "You've checked off 1 item here. Finish this trip to log them as bought, then switch to Big Box. If you're not done, you'll stay at Corner Market.",
    expect.arrayContaining([expect.objectContaining({ text: 'Finish and switch' })]),
  );
  expect(screen.getByRole('button', { name: 'Store: Corner Market' })).toBeOnTheScreen();
  expect(checkbox('Apples')).toBeChecked();
  notYet.mockRestore();

  // Yes: the trip is finished, then the store switches.
  answerAlertsWith('Finish and switch');
  await chooseStore('Big Box');
  expect(await screen.findByRole('button', { name: 'Store: Big Box' })).toBeOnTheScreen();
  expect(await db.trips.count().exec()).toBe(1);
  expect(await entry(db, 'apples')).toBeUndefined();
  // Peas' stale cart mark was cleared when switching, so Big Box starts with nothing in the cart.
  await eventually(async () =>
    expect(tripRows()).toEqual(['# Frozen', 'Peas', '# Deli', 'Ham, Acme, 1 lb']),
  );
  expect(screen.getByText('0 of 2 in cart')).toBeOnTheScreen();
});

test('switching stores with nothing checked off just switches', async () => {
  await renderApp({ initialUrl: '/trip', seed: (db) => seed(db, { tripStoreId: 'corner' }) });
  await trip().findByRole('checkbox', { name: 'Apples' });
  const alert = jest.spyOn(Alert, 'alert');
  await chooseStore('Big Box');
  expect(await screen.findByRole('button', { name: 'Store: Big Box' })).toBeOnTheScreen();
  expect(alert).not.toHaveBeenCalled();
  expect(screen.getByText("1 checked item isn't sold at Big Box.")).toBeOnTheScreen();
});

test('if finishing fails, the user is told and the store does not switch', async () => {
  const db = await renderApp({ initialUrl: '/trip', seed: (db) => seed(db, { tripStoreId: 'corner' }) });
  await fireEvent.press(await trip().findByRole('checkbox', { name: 'Apples' }));
  await eventually(async () => expect(screen.getByText('1 of 2 in cart')).toBeOnTheScreen());
  jest.spyOn(db.trips, 'insert').mockRejectedValue(new Error('disk full'));

  answerAlertsWith('Finish and switch');
  await chooseStore('Big Box');
  expect(await screen.findByText('Could not finish the trip. Please try again.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Store: Corner Market' })).toBeOnTheScreen();
  expect(checkbox('Apples')).toBeChecked();
});

test('a deleted store is treated as no store chosen; several items elsewhere are counted', async () => {
  await renderApp({
    initialUrl: '/trip',
    seed: async (db) => {
      await seed(db, { tripStoreId: 'gone' });
      await db.listEntries.insert({ itemId: 'bread', checkedAt: 1 });
    },
  });
  expect(await screen.findByText('Where are you shopping?')).toBeOnTheScreen();
  await chooseStore('Big Box');
  expect(await screen.findByText("2 checked items aren't sold at Big Box.")).toBeOnTheScreen();
});

test('a store with nothing checked to get there says so', async () => {
  await renderApp({
    initialUrl: '/trip',
    seed: async (db) => {
      await seed(db, { tripStoreId: 'corner' });
      await db.listEntries.find().remove();
    },
  });
  expect(await screen.findByText('Nothing to get at Corner Market')).toBeOnTheScreen();
  expect(screen.getByText('Nothing to get here')).toBeOnTheScreen();
});

test('if the cart empties while the confirmation is open, nothing is logged', async () => {
  const db = await renderApp({ initialUrl: '/trip', seed: (db) => seed(db, { tripStoreId: 'corner' }) });
  await fireEvent.press(await trip().findByRole('checkbox', { name: 'Apples' }));
  await eventually(async () => expect(trip().getByRole('button', { name: 'Finish trip' })).toBeEnabled());

  let buttons: AlertButton[] = [];
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, b?: AlertButton[]) => {
    buttons = b ?? [];
  });
  await press('Finish trip');
  // Unchecked on the Items tab before the user answers.
  await act(() => db.listEntries.findOne('apples').remove());
  await act(async () => buttons.find((b) => b.text === 'Finish trip')?.onPress?.());

  expect(await trip().findByText('Nothing was checked off, so there was nothing to log.')).toBeOnTheScreen();
  expect(await db.trips.count().exec()).toBe(0);
});

test('if finishing fails partway, pressing Finish again completes it without logging it twice', async () => {
  const db = await renderApp({ initialUrl: '/trip', seed: (db) => seed(db, { tripStoreId: 'corner' }) });
  await fireEvent.press(await trip().findByRole('checkbox', { name: 'Apples' }));
  await eventually(async () => expect(trip().getByRole('button', { name: 'Finish trip' })).toBeEnabled());
  jest.spyOn(db.listEntries, 'bulkRemove').mockResolvedValueOnce({ success: [], error: [{} as never] });

  answerAlertsWith('Finish trip');
  await press('Finish trip');
  expect(await trip().findByText('Could not finish the trip. Please try again.')).toBeOnTheScreen();
  // Still in the cart, so Finish can be pressed again.
  expect(checkbox('Apples')).toBeChecked();

  await press('Finish trip');
  expect(await trip().findByText('Trip finished: 1 item logged as bought.')).toBeOnTheScreen();
  expect(trip().queryByText('Could not finish the trip. Please try again.')).toBeNull();
  expect(await db.trips.count().exec()).toBe(1);
  expect(await entry(db, 'apples')).toBeUndefined();
});
