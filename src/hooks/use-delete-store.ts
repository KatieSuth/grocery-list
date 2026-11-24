import { useRef, useState } from 'react';

import { deleteStore } from '@/data/stores-repo';
import { useDatabase } from '@/db/database-provider';
import { countItemsAtStore } from '@/domain/store-draft';
import type { Item, Store } from '@/domain/types';
import { confirmDestructive } from '@/utils/confirm';

const countItems = (n: number) => (n === 1 ? '1 item' : `${n} items`);

export type DeleteStore = {
  /** Asks, then deletes `store`. `onDeleted` runs once it has been deleted. Ignored while a delete is under way. */
  confirmDelete: (store: Store, onDeleted?: () => void) => void;
  /** Whether a delete is being written: show a BusyOverlay and don't let the screen be left. */
  deleting: boolean;
  /**
   * Why the last delete failed, to show on the screen (an alert could be lost on iOS as the
   * BusyOverlay closes). Cleared when another delete starts.
   */
  error: string | undefined;
};

/**
 * Deletes a store after asking, saying how many items will no longer be listed under it. Used by
 * the store form and the Stores tab's long-press menu. Deleting takes the store off every item,
 * which can take a while, so `deleting` says when it's under way.
 */
export function useDeleteStore(items: Item[]): DeleteStore {
  const db = useDatabase();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();
  // Set at once, unlike state, so a second tap can't start another delete.
  const running = useRef(false);

  const remove = async (store: Store, onDeleted?: () => void) => {
    running.current = true;
    setDeleting(true);
    setError(undefined);
    try {
      await deleteStore(db, store.id);
    } catch {
      setError(`Could not delete ${store.name}. Please try again.`);
      return;
    } finally {
      running.current = false;
      setDeleting(false);
    }
    onDeleted?.();
  };

  const confirmDelete = (store: Store, onDeleted?: () => void) => {
    if (running.current) return;
    const count = countItemsAtStore(store.id, items);
    confirmDestructive({
      title: `Delete ${store.name}?`,
      message:
        count > 0 ? `${countItems(count)} will no longer be listed under this store.` : 'No items are listed under this store.',
      confirmLabel: 'Delete',
      onConfirm: () => void remove(store, onDeleted),
    });
  };

  return { confirmDelete, deleting, error };
}
