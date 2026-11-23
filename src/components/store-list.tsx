import { useRef } from 'react';
import type { HostInstance } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import type { Store } from '@/domain/types';

/** More things to do with a store than edit it, from a long-press menu (Stores tab only). */
export type StoreListActions = {
  /** Show the menu for `store`, under its row (`anchor`). */
  onMenu: (store: Store, anchor: HostInstance | null) => void;
  onCopy: (store: Store) => void;
  onDelete: (store: Store) => void;
};

type Props = {
  stores: Store[];
  onSelect: (store: Store) => void;
  actions?: StoreListActions;
};

/** Saved stores with their department order, or an empty state. */
export function StoreList({ stores, onSelect, actions }: Props) {
  if (stores.length === 0) {
    return <EmptyState title="No stores yet" message="Add the first store you shop at to get started." />;
  }
  return stores.map((store) => <StoreCard key={store.id} store={store} onSelect={onSelect} actions={actions} />);
}

function StoreCard({ store, onSelect, actions }: { store: Store; onSelect: (store: Store) => void; actions?: StoreListActions }) {
  const ref = useRef<HostInstance>(null);
  return (
    <Card
      ref={ref}
      title={store.name}
      subtitle={store.location}
      detail={store.departments.map((d) => d.name).join(' → ')}
      spokenDetail={
        store.departments.length > 0
          ? `Departments in order: ${store.departments.map((d) => d.name).join(', ')}`
          : 'No departments'
      }
      detailNumberOfLines={1}
      accessibilityHint={actions ? 'Edit this store. Long-press for more options.' : 'Edit this store'}
      onPress={() => onSelect(store)}
      {...(actions && {
        onLongPress: () => actions.onMenu(store, ref.current),
        // Screen readers can reach each option directly too (TalkBack's actions menu, VoiceOver's rotor).
        accessibilityActions: [
          { name: 'longpress', label: 'More options' },
          { name: 'copy', label: 'Copy store' },
          { name: 'delete', label: 'Delete store' },
        ],
        onAccessibilityAction: ({ nativeEvent }) => {
          if (nativeEvent.actionName === 'copy') actions.onCopy(store);
          else if (nativeEvent.actionName === 'delete') actions.onDelete(store);
          else actions.onMenu(store, ref.current);
        },
      })}
    />
  );
}
