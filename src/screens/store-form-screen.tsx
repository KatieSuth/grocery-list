import { useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import Animated, { useAnimatedRef } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { DepartmentEditor } from '@/components/department-editor';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ErrorText, TextField } from '@/components/text-field';
import { deleteStore, saveStore } from '@/data/stores-repo';
import { useDatabase } from '@/db/database-provider';
import {
  countItemsAtStore,
  emptyStoreDraft,
  hasErrors,
  removedDepartmentsInUse,
  storeDraftChanged,
  storeToDraft,
  validateStoreDraft,
} from '@/domain/store-draft';
import { MAX_NAME_LENGTH } from '@/domain/names';
import type { Item, Store } from '@/domain/types';
import { useItems, useStores } from '@/hooks/use-data';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning';
import { confirmDestructive } from '@/utils/confirm';
import { goBack } from '@/utils/navigation';
import { runWrite } from '@/utils/run-write';
import { normalizeText, sameName } from '@/utils/text';

type Props = {
  /** Where Save, Cancel and Delete return to. */
  backTo: Href;
};

/** Add (no `id` param) or edit (`?id=`) a store. Shared by setup and the main app. */
export function StoreFormScreen({ backTo }: Props) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const stores = useStores();
  const items = useItems();
  if (!stores || !items) return null;

  if (!id) return <StoreForm stores={stores} items={items} backTo={backTo} />;
  const store = stores.find((s) => s.id === id);
  if (!store) {
    return (
      <Screen footer={<Button variant="secondary" label="Back" onPress={() => goBack(backTo)} />}>
        <EmptyState title="Store not found" message="It may have been deleted." />
      </Screen>
    );
  }
  return <StoreForm key={store.id} store={store} stores={stores} items={items} backTo={backTo} />;
}

const countItems = (n: number) => (n === 1 ? '1 item' : `${n} items`);

function StoreForm({ store, stores, items, backTo }: Props & { store?: Store; stores: Store[]; items: Item[] }) {
  const db = useDatabase();
  const [initial] = useState(() => (store ? storeToDraft(store) : emptyStoreDraft()));
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const leave = useUnsavedChangesWarning(storeDraftChanged(draft, initial), 'store');

  const otherStores = stores.filter((s) => s.id !== store?.id);
  const errors = submitted ? validateStoreDraft(draft, otherStores) : {};

  const save = async () => {
    setSaving(true);
    setSaveError(undefined);
    try {
      await saveStore(db, draft, store?.id);
      leave(backTo);
    } catch {
      setSaveError('Could not save this store. Please try again.');
      setSaving(false);
    }
  };

  const handleSave = () => {
    setSubmitted(true);
    if (hasErrors(validateStoreDraft(draft, otherStores))) return;
    const removed = store ? removedDepartmentsInUse(store, draft, items) : undefined;
    if (!removed || removed.itemCount === 0) {
      void save();
      return;
    }
    // Removing a department takes its items out of this store; make sure that's meant.
    const readded = removed.names.some((name) => draft.departments.some((d) => sameName(d.name, name)));
    confirmDestructive({
      title: 'Remove departments with items?',
      message:
        `${countItems(removed.itemCount)} in ${removed.names.join(', ')} will no longer be listed under ${normalizeText(draft.name)}.` +
        (readded ? ' A department added back with the same name starts out empty; its items aren’t moved to it.' : ''),
      confirmLabel: 'Remove and save',
      cancelLabel: 'Keep editing',
      onConfirm: () => void save(),
    });
  };

  const handleDelete = (target: Store) => {
    const count = countItemsAtStore(target.id, items);
    confirmDestructive({
      title: `Delete ${target.name}?`,
      message:
        count > 0
          ? `${countItems(count)} will no longer be listed under this store.`
          : 'No items are listed under this store.',
      confirmLabel: 'Delete',
      onConfirm: () => {
        leave(backTo);
        runWrite(() => deleteStore(db, target.id), `Could not delete ${target.name}. Please try again.`);
      },
    });
  };

  return (
    <Screen
      scrollRef={scrollRef}
      footer={
        <>
          <Button variant="secondary" label="Cancel" onPress={() => goBack(backTo)} />
          <Button label="Save" disabled={saving} onPress={handleSave} />
        </>
      }>
      <TextField
        label="Store name"
        placeholder="e.g. Corner Market"
        value={draft.name}
        onChangeText={(name) => setDraft({ ...draft, name })}
        error={errors.name}
        autoCapitalize="words"
        autoFocus={!store}
        maxLength={MAX_NAME_LENGTH}
      />
      <TextField
        label="Location"
        optional
        placeholder="e.g. Main St, downtown"
        value={draft.location}
        onChangeText={(location) => setDraft({ ...draft, location })}
        error={errors.location}
        maxLength={MAX_NAME_LENGTH}
      />
      <DepartmentEditor
        departments={draft.departments}
        onChange={(departments) => setDraft({ ...draft, departments })}
        error={errors.departments}
        knownStores={stores}
        currentStoreId={store?.id}
        scrollableRef={scrollRef}
      />
      {saveError ? <ErrorText message={saveError} /> : null}
      {store ? <Button variant="danger" label="Delete store" onPress={() => handleDelete(store)} /> : null}
    </Screen>
  );
}
