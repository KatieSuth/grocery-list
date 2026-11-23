import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import type { Store } from '@/domain/types';

type Props = {
  stores: Store[];
  onSelect: (store: Store) => void;
};

/** Saved stores with their department order, or an empty state. */
export function StoreList({ stores, onSelect }: Props) {
  if (stores.length === 0) {
    return <EmptyState title="No stores yet" message="Add the first store you shop at to get started." />;
  }
  return stores.map((store) => (
    <Card
      key={store.id}
      title={store.name}
      subtitle={store.location}
      detail={store.departments.map((d) => d.name).join(' → ')}
      spokenDetail={
        store.departments.length > 0
          ? `Departments in order: ${store.departments.map((d) => d.name).join(', ')}`
          : 'No departments'
      }
      detailNumberOfLines={1}
      accessibilityHint="Edit this store"
      onPress={() => onSelect(store)}
    />
  ));
}
