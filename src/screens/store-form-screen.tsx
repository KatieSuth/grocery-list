import { useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import Animated, { useAnimatedRef } from 'react-native-reanimated';

import { BusyOverlay } from '@/components/busy-overlay';
import { Button } from '@/components/button';
import { DepartmentEditor } from '@/components/department-editor';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { SwitchRow } from '@/components/switch-row';
import { ErrorText, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { copyStore, CopyNotUndoneError, saveStore } from '@/data/stores-repo';
import { useDatabase } from '@/db/database-provider';
import {
  copyStoreDraft,
  countItemsAtStore,
  emptyStoreDraft,
  hasErrors,
  removedDepartmentsInUse,
  storeDraftChanged,
  storeToDraft,
  validateStoreDraft,
} from '@/domain/store-draft';
import { storeLabel } from '@/domain/describe';
import { MAX_NAME_LENGTH } from '@/domain/names';
import type { Item, Store } from '@/domain/types';
import { useItems, useStores } from '@/hooks/use-data';
import { useDeleteStore } from '@/hooks/use-delete-store';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning';
import { confirmDestructive } from '@/utils/confirm';
import { goBack } from '@/utils/navigation';
import { normalizeText, sameName } from '@/utils/text';

type Props = {
  /** Where Save, Cancel and Delete return to. */
  backTo: Href;
};

/**
 * Add (no params), edit (`?id=`) or copy (`?copyFrom=`) a store. Shared by setup and the main app;
 * stores are copied from the Stores tab's long-press menu.
 */
export function StoreFormScreen({ backTo }: Props) {
  const { id, copyFrom } = useLocalSearchParams<{ id?: string; copyFrom?: string }>();
  const stores = useStores();
  const items = useItems();
  // Keep copying the same store even if it's deleted while the form is open (then no items are copied).
  const [copySource, setCopySource] = useState<Store>();
  const found = copyFrom ? stores?.find((s) => s.id === copyFrom) : undefined;
  if (found && !copySource) setCopySource(found);
  if (!stores || !items) return null;

  if (!id && !copyFrom) return <StoreForm stores={stores} items={items} backTo={backTo} />;
  const store = id ? stores.find((s) => s.id === id) : copySource;
  if (!store) {
    return (
      <Screen footer={<Button variant="secondary" label="Back" onPress={() => goBack(backTo)} />}>
        <EmptyState title="Store not found" message="It may have been deleted." />
      </Screen>
    );
  }
  if (!id) return <StoreForm key={store.id} copySource={store} stores={stores} items={items} backTo={backTo} />;
  return <StoreForm key={store.id} store={store} stores={stores} items={items} backTo={backTo} />;
}

const countItems = (n: number) => (n === 1 ? '1 item' : `${n} items`);

type FormProps = Props & {
  /** The store being edited; absent when adding or copying. */
  store?: Store;
  /** The store being copied. */
  copySource?: Store;
  stores: Store[];
  items: Item[];
};

function StoreForm({ store, copySource, stores, items, backTo }: FormProps) {
  const db = useDatabase();
  const [start] = useState(() =>
    copySource
      ? copyStoreDraft(copySource)
      : { draft: store ? storeToDraft(store) : emptyStoreDraft(), departmentSources: {} },
  );
  const initial = start.draft;
  const [draft, setDraft] = useState(initial);
  const [copyItems, setCopyItems] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const leave = useUnsavedChangesWarning(storeDraftChanged(draft, initial), 'store', saving);

  const otherStores = stores.filter((s) => s.id !== store?.id);
  const deleteWithConfirm = useDeleteStore(items);
  const allErrors = validateStoreDraft(draft, otherStores);
  // When copying, say straight away if the name and location are already taken (the copy starts
  // out like its source, so this is easy to miss); other problems wait until Save, as usual.
  // Nothing to report while saving: the draft was checked when Save was tapped, and a copy's new
  // store, saved before its items, would otherwise show up as a store with the same name.
  const errors = saving
    ? {}
    : submitted
      ? allErrors
    : copySource && normalizeText(draft.name)
      ? { name: allErrors.name, location: allErrors.location }
      : {};

  const save = async () => {
    setSaving(true);
    setSaveError(undefined);
    try {
      if (copySource) {
        await copyStore(db, draft, {
          sourceStoreId: copySource.id,
          departmentSources: start.departmentSources,
          copyItems,
        });
      } else {
        await saveStore(db, draft, store?.id);
      }
      leave(backTo);
    } catch (error) {
      setSaveError(
        error instanceof CopyNotUndoneError
          ? `The copy was only partly saved, and couldn’t be undone. Check ${normalizeText(draft.name)} on the Stores tab.`
          : `Could not ${copySource ? 'copy' : 'save'} this store. Please try again.`,
      );
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

  return (
    <Screen
      scrollRef={scrollRef}
      footer={
        <>
          <Button variant="secondary" label="Cancel" disabled={saving} onPress={() => goBack(backTo)} />
          <Button label="Save" disabled={saving} onPress={handleSave} />
        </>
      }>
      {copySource ? (
        <ThemedText themeColor="textSecondary">
          Copying {storeLabel(copySource)}. Give the new store its own name or location.
        </ThemedText>
      ) : null}
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
      {copySource ? <CopyItemsSwitch source={copySource} items={items} value={copyItems} onChange={setCopyItems} /> : null}
      {saveError ? <ErrorText message={saveError} /> : null}
      {/* Saving updates every item listed under the store (and copying lists them under the new one),
          which can take a while: the form can't be left until it's done, so say so. */}
      {saving ? <BusyOverlay message={copySource ? 'Copying store…' : 'Saving store…'} /> : null}
      {store ? (
        <Button variant="danger" label="Delete store" disabled={saving} onPress={() => deleteWithConfirm(store, () => leave(backTo))} />
      ) : null}
    </Screen>
  );
}

/** Whether a copied store also lists the source store's items (on to start). */
function CopyItemsSwitch({
  source,
  items,
  value,
  onChange,
}: {
  source: Store;
  items: Item[];
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const count = countItemsAtStore(source.id, items);
  return (
    <SwitchRow
      label={`Copy items from ${storeLabel(source)}`}
      description={
        count > 0
          ? `The ${countItems(count)} listed under ${source.name} will also be listed under this store, in the same departments. Items aren’t duplicated, and items in departments you remove aren’t copied.`
          : `${source.name} has no items yet.`
      }
      value={value}
      onValueChange={onChange}
    />
  );
}
