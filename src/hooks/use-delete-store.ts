import { deleteStore } from '@/data/stores-repo';
import { useDatabase } from '@/db/database-provider';
import { countItemsAtStore } from '@/domain/store-draft';
import type { Item, Store } from '@/domain/types';
import { confirmDestructive } from '@/utils/confirm';
import { runWrite } from '@/utils/run-write';

const countItems = (n: number) => (n === 1 ? '1 item' : `${n} items`);

/**
 * Deletes a store after asking, saying how many items will no longer be listed under it. Used by
 * the store form and the Stores tab's long-press menu. `onDeleted` runs once the user confirms.
 */
export function useDeleteStore(items: Item[]): (store: Store, onDeleted?: () => void) => void {
  const db = useDatabase();
  return (store, onDeleted) => {
    const count = countItemsAtStore(store.id, items);
    confirmDestructive({
      title: `Delete ${store.name}?`,
      message:
        count > 0 ? `${countItems(count)} will no longer be listed under this store.` : 'No items are listed under this store.',
      confirmLabel: 'Delete',
      onConfirm: () => {
        onDeleted?.();
        runWrite(() => deleteStore(db, store.id), `Could not delete ${store.name}. Please try again.`);
      },
    });
  };
}
