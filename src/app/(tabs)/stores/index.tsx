import { router } from 'expo-router';
import { useState } from 'react';
import type { HostInstance } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { StoreActionsMenu } from '@/components/store-actions-menu';
import { StoreList, type StoreListActions } from '@/components/store-list';
import type { Store } from '@/domain/types';
import { useItems, useStores } from '@/hooks/use-data';
import { useDeleteStore } from '@/hooks/use-delete-store';

const editStore = (store: Store) => router.push({ pathname: '/store-form', params: { id: store.id } });
const copyStore = (store: Store) => router.push({ pathname: '/store-form', params: { copyFrom: store.id } });

/**
 * Store configuration: the same stores and departments set up during onboarding. Tapping a store
 * edits it; long-pressing it shows a menu to edit, copy or delete it.
 */
export default function StoresScreen() {
  const stores = useStores();
  const items = useItems();
  const deleteStore = useDeleteStore(items ?? []);
  const [menu, setMenu] = useState<{ store: Store; anchor: HostInstance | null } | null>(null);
  if (!stores) return null;

  const actions: StoreListActions = {
    onMenu: (store, anchor) => setMenu({ store, anchor }),
    onCopy: copyStore,
    onDelete: (store) => deleteStore(store),
  };
  /** Closes the menu, then does `action` with its store. */
  const fromMenu = (action: (store: Store) => void) => (store: Store) => {
    setMenu(null);
    action(store);
  };

  return (
    <Screen>
      <Button label="Add a store" onPress={() => router.push('/store-form')} />
      <StoreList stores={stores} onSelect={editStore} actions={actions} />
      <StoreActionsMenu
        store={menu?.store ?? null}
        anchor={menu?.anchor ?? null}
        onEdit={fromMenu(editStore)}
        onCopy={fromMenu(copyStore)}
        onDelete={fromMenu(actions.onDelete)}
        onClose={() => setMenu(null)}
      />
    </Screen>
  );
}
