import { useMemo } from 'react';

import { observeItems } from '@/data/items-repo';
import { observeListEntries } from '@/data/list-repo';
import { observeSetupComplete } from '@/data/settings-repo';
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
