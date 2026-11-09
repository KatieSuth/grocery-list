import { useMemo } from 'react';

import { observeItems } from '@/data/items-repo';
import { observeListEntries } from '@/data/list-repo';
import {
  observeColorSchemeChoice,
  observeItemSortChoice,
  observeSetupComplete,
  observeTripSettings,
} from '@/data/settings-repo';
import { observeStores } from '@/data/stores-repo';
import { useDatabase } from '@/db/database-provider';

import { useObservable } from './use-observable';

/** Live list of stores; undefined while loading. */
export function useStores() {
  const db = useDatabase();
  return useObservable(useMemo(() => observeStores(db), [db]));
}

/** Live list of items; undefined while loading. */
export function useItems() {
  const db = useDatabase();
  return useObservable(useMemo(() => observeItems(db), [db]));
}

/** Whether onboarding has been finished; undefined while loading. */
export function useSetupComplete() {
  const db = useDatabase();
  return useObservable(useMemo(() => observeSetupComplete(db), [db]));
}

/** Checked items keyed by item id; undefined while loading. */
export function useListEntries() {
  const db = useDatabase();
  return useObservable(useMemo(() => observeListEntries(db), [db]));
}

/** The Trip tab's chosen store and order; undefined while loading. */
export function useTripSettings() {
  const db = useDatabase();
  return useObservable(useMemo(() => observeTripSettings(db), [db]));
}

/** Light, dark or following the device; undefined while loading. */
export function useColorSchemeChoice() {
  const db = useDatabase();
  return useObservable(useMemo(() => observeColorSchemeChoice(db), [db]));
}

/** How the master list is sorted when it opens (chosen in Settings); undefined while loading. */
export function useItemSortChoice() {
  const db = useDatabase();
  return useObservable(useMemo(() => observeItemSortChoice(db), [db]));
}
