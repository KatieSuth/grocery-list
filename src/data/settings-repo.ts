import { map, type Observable } from 'rxjs';

import type { AppDatabase } from '@/db/database';
import { SETTINGS_ID, type SettingsDoc } from '@/db/schema';
import { DEFAULT_COLOR_SCHEME, type ColorSchemeChoice } from '@/domain/appearance';
import { DEFAULT_SORT_CHOICE, ITEM_SORTS, SORT_DIRECTIONS, type ItemSortChoice } from '@/domain/item-sort';

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

/** How the master list is sorted when it opens. Unknown saved values fall back to the default. */
export function observeItemSortChoice(db: AppDatabase): Observable<ItemSortChoice> {
  return db.settings.findOne(SETTINGS_ID).$.pipe(
    map((doc) => ({
      sort: doc?.itemSort && ITEM_SORTS.includes(doc.itemSort) ? doc.itemSort : DEFAULT_SORT_CHOICE.sort,
      direction:
        doc?.itemSortDirection && SORT_DIRECTIONS.includes(doc.itemSortDirection)
          ? doc.itemSortDirection
          : DEFAULT_SORT_CHOICE.direction,
    })),
  );
}

export async function setItemSortChoice(db: AppDatabase, { sort, direction }: ItemSortChoice): Promise<void> {
  await patchSettings(db, { itemSort: sort, itemSortDirection: direction });
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
