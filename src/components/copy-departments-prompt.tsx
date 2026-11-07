import { PickerSheet } from '@/components/picker-sheet';
import type { Store } from '@/domain/types';

type Props = {
  visible: boolean;
  stores: Store[];
  onChoose: (store: Store) => void;
  onCancel: () => void;
};

/** Asks which store to copy departments from. Each choice previews that store's departments. */
export function CopyDepartmentsPrompt({ visible, stores, onChoose, onCancel }: Props) {
  return (
    <PickerSheet
      visible={visible}
      title="Copy departments from…"
      message="They’re added after this store’s departments. Names already in the list are skipped."
      options={stores.map((store) => {
        const names = store.departments.map((d) => d.name);
        return {
          key: store.id,
          title: store.name,
          details: [...(store.location ? [store.location] : []), names.join(' → ')],
          accessibilityLabel: `Copy from ${store.name}${store.location ? `, ${store.location}` : ''}`,
          accessibilityHint: `Departments: ${names.join(', ')}`,
        };
      })}
      onChoose={(id) => onChoose(stores.find((s) => s.id === id) as Store)}
      onCancel={onCancel}
      cancelAccessibilityLabel="Cancel copying"
    />
  );
}
