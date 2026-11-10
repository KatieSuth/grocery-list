import { firstValueFrom, of } from 'rxjs';

import {
  clearTripStore,
  observeColorSchemeChoice,
  observeItemSortChoice,
  observeSetupComplete,
  observeTripSettings,
  setColorSchemeChoice,
  setItemSortChoice,
  setSetupComplete,
  setTripReversed,
  setTripStore,
} from '@/data/settings-repo';
import { closeTestDatabases, createTestDatabase } from '@/test-utils/db';

afterEach(closeTestDatabases);

test('setup is incomplete on a fresh install and can be toggled', async () => {
  const db = await createTestDatabase();
  expect(await firstValueFrom(observeSetupComplete(db))).toBe(false);
  await setSetupComplete(db, true);
  expect(await firstValueFrom(observeSetupComplete(db))).toBe(true);
  await setSetupComplete(db, false);
  expect(await firstValueFrom(observeSetupComplete(db))).toBe(false);
});

test('trip settings default to no store, usual order, and are kept separately from setup', async () => {
  const db = await createTestDatabase();
  expect(await firstValueFrom(observeTripSettings(db))).toEqual({ reversed: false });

  // Set before the settings document exists.
  await setTripStore(db, 's1');
  expect(await firstValueFrom(observeTripSettings(db))).toEqual({ storeId: 's1', reversed: false });
  expect(await firstValueFrom(observeSetupComplete(db))).toBe(false);

  await setTripReversed(db, true);
  await setSetupComplete(db, true);
  expect(await firstValueFrom(observeTripSettings(db))).toEqual({ storeId: 's1', reversed: true });
  expect(await firstValueFrom(observeSetupComplete(db))).toBe(true);
});

test('clearing the trip store forgets only the store', async () => {
  const db = await createTestDatabase();
  // Nothing to clear before the settings document exists.
  await clearTripStore(db);
  expect(await firstValueFrom(observeTripSettings(db))).toEqual({ reversed: false });

  await setTripStore(db, 's1');
  await setTripReversed(db, true);
  await setSetupComplete(db, true);
  await clearTripStore(db);
  expect(await firstValueFrom(observeTripSettings(db))).toEqual({ reversed: true });
  expect(await firstValueFrom(observeSetupComplete(db))).toBe(true);
});

test('the appearance follows the device until light or dark is chosen', async () => {
  const db = await createTestDatabase();
  expect(await firstValueFrom(observeColorSchemeChoice(db))).toBe('system');
  await setColorSchemeChoice(db, 'dark');
  expect(await firstValueFrom(observeColorSchemeChoice(db))).toBe('dark');
  await setColorSchemeChoice(db, 'system');
  expect(await firstValueFrom(observeColorSchemeChoice(db))).toBe('system');
  expect(await firstValueFrom(observeSetupComplete(db))).toBe(false);
});

test('the items’ default sort is by name, A–Z, until chosen; it can be changed', async () => {
  const db = await createTestDatabase();
  expect(await firstValueFrom(observeItemSortChoice(db))).toEqual({ sort: 'name', direction: 'asc' });

  await setItemSortChoice(db, { sort: 'lastBought', direction: 'desc' });
  expect(await firstValueFrom(observeItemSortChoice(db))).toEqual({ sort: 'lastBought', direction: 'desc' });
  expect((await db.settings.findOne('app').exec())?.toJSON()).toMatchObject({ itemSort: 'lastBought', itemSortDirection: 'desc' });
});

test('an unrecognised saved sort falls back to the default', async () => {
  // e.g. written by a newer version of the app; production builds skip schema checks.
  const db = { settings: { findOne: () => ({ $: of({ itemSort: 'price', itemSortDirection: 'sideways' }) }) } };
  expect(await firstValueFrom(observeItemSortChoice(db as never))).toEqual({ sort: 'name', direction: 'asc' });
});
