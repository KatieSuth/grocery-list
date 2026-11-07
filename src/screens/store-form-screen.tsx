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
import { emptyStoreDraft, hasErrors, storeToDraft, validateStoreDraft } from '@/domain/store-draft';
import type { Store } from '@/domain/types';
import { useStores } from '@/hooks/use-data';
import { confirmDestructive } from '@/utils/confirm';
import { goBack } from '@/utils/navigation';


type Props = {
  /** Where Save, Cancel and Delete return to. */
  backTo: Href;
};

/** Add (no `id` param) or edit (`?id=`) a store. Shared by setup and the main app. */
export function StoreFormScreen({ backTo }: Props) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const stores = useStores();
  if (!stores) return null;

  if (!id) return <StoreForm stores={stores} backTo={backTo} />;
  const store = stores.find((s) => s.id === id);
  if (!store) {
    return (
      <Screen footer={<Button variant="secondary" label="Back" onPress={() => goBack(backTo)} />}>
        <EmptyState title="Store not found" message="It may have been deleted." />
      </Screen>
    );
  }
  return <StoreForm key={store.id} store={store} stores={stores} backTo={backTo} />;
}

function StoreForm({ store, stores, backTo }: Props & { store?: Store; stores: Store[] }) {
  const db = useDatabase();
  const [draft, setDraft] = useState(() => (store ? storeToDraft(store) : emptyStoreDraft()));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const errors = submitted ? validateStoreDraft(draft) : {};

  const handleSave = async () => {
    setSubmitted(true);
    if (hasErrors(validateStoreDraft(draft))) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      await saveStore(db, draft, store?.id);
      goBack(backTo);
    } catch {
      setSaveError('Could not save this store. Please try again.');
      setSaving(false);
    }
  };

  const handleDelete = (target: Store) => {
    confirmDestructive({
      title: `Delete ${target.name}?`,
      message: 'Items will no longer be listed under this store.',
      confirmLabel: 'Delete',
      onConfirm: () => {
        goBack(backTo);
        void deleteStore(db, target.id);
      },
    });
  };

  return (
    <Screen
      scrollRef={scrollRef}
      footer={
        <>
          <Button variant="secondary" label="Cancel" onPress={() => goBack(backTo)} />
          <Button label="Save" disabled={saving} onPress={() => void handleSave()} />
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
      />
      <TextField
        label="Location"
        optional
        placeholder="e.g. Main St, downtown"
        value={draft.location}
        onChangeText={(location) => setDraft({ ...draft, location })}
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
