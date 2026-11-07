import { firstValueFrom } from 'rxjs';

import {
  observeColorSchemeChoice,
  observeSetupComplete,
  observeTripSettings,
  setColorSchemeChoice,
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

test('the appearance follows the device until light or dark is chosen', async () => {
  const db = await createTestDatabase();
  expect(await firstValueFrom(observeColorSchemeChoice(db))).toBe('system');
  await setColorSchemeChoice(db, 'dark');
  expect(await firstValueFrom(observeColorSchemeChoice(db))).toBe('dark');
  await setColorSchemeChoice(db, 'system');
  expect(await firstValueFrom(observeColorSchemeChoice(db))).toBe('system');
  expect(await firstValueFrom(observeSetupComplete(db))).toBe(false);
});
