import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { setQuantity } from '@/data/list-repo';
import type { AppDatabase } from '@/db/database';
import { runWrite } from '@/utils/run-write';

/** How long typing has to pause before a quantity is saved. */
export const QUANTITY_SAVE_DELAY_MS = 400;

type Pending = { value: string; timer: ReturnType<typeof setTimeout> };

function saveQuantity(db: AppDatabase, itemId: string, value: string): void {
  runWrite(() => setQuantity(db, itemId, value), 'Could not save the quantity. Please try again.');
}

/**
 * Saves quantities once typing pauses, rather than on every keystroke: each save is a database
 * write, and each write redraws the whole list. Saves still waiting are made right away when the
 * screen closes or the app goes to the background (where it may be closed), so nothing typed is
 * lost.
 */
export function useDelayedQuantitySave(db: AppDatabase) {
  const pending = useRef(new Map<string, Pending>());

  useEffect(() => {
    const waiting = pending.current;
    const saveNow = () => {
      for (const [itemId, { value, timer }] of waiting) {
        clearTimeout(timer);
        saveQuantity(db, itemId, value);
      }
      waiting.clear();
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') saveNow();
    });
    return () => {
      subscription.remove();
      saveNow();
    };
  }, [db]);

  /** Saves `value` as the item's quantity once typing pauses. */
  const schedule = (itemId: string, value: string) => {
    const waiting = pending.current;
    clearTimeout(waiting.get(itemId)?.timer);
    const timer = setTimeout(() => {
      waiting.delete(itemId);
      saveQuantity(db, itemId, value);
    }, QUANTITY_SAVE_DELAY_MS);
    waiting.set(itemId, { value, timer });
  };

  /** Drops a save still waiting for the item, e.g. because it was unchecked. */
  const cancel = (itemId: string) => {
    const waiting = pending.current;
    clearTimeout(waiting.get(itemId)?.timer);
    waiting.delete(itemId);
  };

  return { schedule, cancel };
}
