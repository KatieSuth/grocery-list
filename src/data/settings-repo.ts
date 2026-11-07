import { map, type Observable } from 'rxjs';

import type { AppDatabase } from '@/db/database';
import { SETTINGS_ID, type SettingsDoc } from '@/db/schema';
import { DEFAULT_COLOR_SCHEME, type ColorSchemeChoice } from '@/domain/appearance';

export function observeSetupComplete(db: AppDatabase): Observable<boolean> {
  return db.settings.findOne(SETTINGS_ID).$.pipe(map((doc) => doc?.setupComplete ?? false));
}

export async function setSetupComplete(db: AppDatabase, setupComplete: boolean): Promise<void> {
  await patchSettings(db, { setupComplete });
}

/** The Trip tab's remembered choices. */
export type TripSettings = {
  /** The chosen store, if any. It may have been deleted since. */
  storeId?: string;
  reversed: boolean;
};

export function observeTripSettings(db: AppDatabase): Observable<TripSettings> {
  return db.settings.findOne(SETTINGS_ID).$.pipe(
    map((doc) => ({
      ...(doc?.tripStoreId ? { storeId: doc.tripStoreId } : {}),
      reversed: doc?.tripReversed ?? false,
    })),
  );
}

export async function setTripStore(db: AppDatabase, storeId: string): Promise<void> {
  await patchSettings(db, { tripStoreId: storeId });
}

export async function setTripReversed(db: AppDatabase, reversed: boolean): Promise<void> {
  await patchSettings(db, { tripReversed: reversed });
}

export function observeColorSchemeChoice(db: AppDatabase): Observable<ColorSchemeChoice> {
  return db.settings.findOne(SETTINGS_ID).$.pipe(map((doc) => doc?.colorScheme ?? DEFAULT_COLOR_SCHEME));
}

export async function setColorSchemeChoice(db: AppDatabase, colorScheme: ColorSchemeChoice): Promise<void> {
  await patchSettings(db, { colorScheme });
}

/** Changes some settings, keeping the rest. */
async function patchSettings(db: AppDatabase, patch: Partial<Omit<SettingsDoc, 'id'>>): Promise<void> {
  const doc = await db.settings.findOne(SETTINGS_ID).exec();
  if (doc) {
    await doc.incrementalPatch(patch);
  } else {
    await db.settings.insert({ id: SETTINGS_ID, setupComplete: false, ...patch });
  }
}
