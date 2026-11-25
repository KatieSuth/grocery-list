import { Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { HostInstance } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';

import { BusyOverlay } from '@/components/busy-overlay';
import { ReassignDepartments } from '@/components/reassign-departments';
import { Button } from '@/components/button';
import { DepartmentEditor } from '@/components/department-editor';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { SwitchRow } from '@/components/switch-row';
import { ErrorText, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { copyStore, CopyNotUndoneError, saveStore, type Reassignments } from '@/data/stores-repo';
import { useDatabase } from '@/db/database-provider';
import {
  copyStoreDraft,
  countItemsAtStore,
  emptyStoreDraft,
  hasErrors,
  departmentsToReassign,
  type DepartmentToReassign,
  type StoreDraft,
  storeDraftChanged,
  storeToDraft,
  validateStoreDraft,
} from '@/domain/store-draft';
import { storeLabel } from '@/domain/describe';
import { MAX_NAME_LENGTH } from '@/domain/names';
import { addPendingDepartment } from '@/domain/departments';
import type { Department, Item, Store } from '@/domain/types';
import { useItems, useStores } from '@/hooks/use-data';
import { useDeleteStore, type DeleteStore } from '@/hooks/use-delete-store';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning';
import { goBack } from '@/utils/navigation';
import { moveAccessibilityFocus } from '@/utils/accessibility-focus';
import { STORE_FORM_TITLES } from '@/utils/form-title';
import { normalizeText } from '@/utils/text';

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
  const deletion = useDeleteStore(items ?? []);
  // The store being deleted from this form, so the form stays up (with its spinner) until it
  // closes, instead of saying "Store not found" once the store is gone.
  const [deletingStore, setDeletingStore] = useState<Store>();
  // Keep copying the same store even if it's deleted while the form is open (then no items are copied).
  const [copySource, setCopySource] = useState<Store>();
  const found = copyFrom ? stores?.find((s) => s.id === copyFrom) : undefined;
  if (found && !copySource) setCopySource(found);
  if (!stores || !items) return null;

  if (!id && !copyFrom) return <StoreForm stores={stores} items={items} backTo={backTo} />;
  const store = id ? (stores.find((s) => s.id === id) ?? deletingStore) : copySource;
  if (!store) {
    return (
      <Screen footer={<Button variant="secondary" label="Back" onPress={() => goBack(backTo)} />}>
        <EmptyState title="Store not found" message="It may have been deleted." />
      </Screen>
    );
  }
  if (!id) return <StoreForm key={store.id} copySource={store} stores={stores} items={items} backTo={backTo} />;
  const confirmDelete: DeleteStore['confirmDelete'] = (target, onDeleted) => {
    setDeletingStore(target);
    deletion.confirmDelete(target, onDeleted);
  };
  return (
    <StoreForm
      key={store.id}
      store={store}
      stores={stores}
      items={items}
      backTo={backTo}
      deletion={{ ...deletion, confirmDelete }}
    />
  );
}

const countItems = (n: number) => (n === 1 ? '1 item' : `${n} items`);

type FormProps = Props & {
  /** The store being edited; absent when adding or copying. */
  store?: Store;
  /** The store being copied. */
  copySource?: Store;
  stores: Store[];
  items: Item[];
  /** Deleting the store being edited (see useDeleteStore). */
  deletion?: DeleteStore;
};

function StoreForm({ store, copySource, stores, items, backTo, deletion }: FormProps) {
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
  /** What's typed in the New department field but not added yet, and its error (see DepartmentEditor). */
  const [newDepartment, setNewDepartment] = useState('');
  const [departmentAddError, setDepartmentAddError] = useState<string>();
  /**
   * Set while choosing new departments for the items in departments being removed (see
   * ReassignDepartments): those departments and items, and the draft as it was when Save was
   * tapped. The choices and any departments added there are kept here too, so a failed save
   * keeps them.
   */
  const [reassigning, setReassigning] = useState<{ groups: DepartmentToReassign[]; draft: StoreDraft }>();
  const [choices, setChoices] = useState<Record<string, string | undefined>>({});
  const [addedDepartments, setAddedDepartments] = useState<Department[]>([]);
  const saveButton = useRef<HostInstance>(null);
  const [backToForm, setBackToForm] = useState<object>();
  const deleting = deletion?.deleting ?? false;
  // Saving or deleting: the form can't be left (or changed) until it's written.
  const busy = saving || deleting;

  /** Back to the form, as it was: nothing saved, and departments added while reassigning dropped. */
  const cancelReassigning = () => {
    setReassigning(undefined);
    setChoices({});
    setAddedDepartments([]);
    setSaveError(undefined);
    setBackToForm({});
  };
  const leave = useUnsavedChangesWarning(
    // A department typed but not added yet counts too.
    storeDraftChanged(draft, initial) || !!normalizeText(newDepartment),
    'store',
    busy,
    // While reassigning, Back goes back to the form.
    reassigning ? cancelReassigning : undefined,
  );
  // Back on the form after reassigning: put the screen reader back on Save.
  useEffect(() => {
    if (backToForm && saveButton.current) moveAccessibilityFocus(saveButton.current);
  }, [backToForm]);

  const otherStores = stores.filter((s) => s.id !== store?.id);
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

  const save = async (toSave: StoreDraft, reassign?: Reassignments) => {
    setSaving(true);
    setSaveError(undefined);
    try {
      if (copySource) {
        await copyStore(db, toSave, {
          sourceStoreId: copySource.id,
          departmentSources: start.departmentSources,
          copyItems,
        });
      } else {
        await saveStore(db, toSave, store?.id, reassign);
      }
      leave(backTo);
    } catch (error) {
      setSaveError(
        error instanceof CopyNotUndoneError
          ? `The copy was only partly saved, and couldn’t be undone. Check ${normalizeText(toSave.name)} on the Stores tab.`
          : `Could not ${copySource ? 'copy' : 'save'} this store. Please try again.`,
      );
      setSaving(false);
    }
  };

  const handleSave = () => {
    setSubmitted(true);
    // A department typed but not added yet is added now, rather than being lost.
    const pending = addPendingDepartment(draft.departments, newDepartment, stores);
    if (!pending.ok) {
      setDepartmentAddError(pending.error);
      return;
    }
    const current = { ...draft, departments: pending.departments };
    setDraft(current);
    setNewDepartment('');
    confirmAndSave(current);
  };

  const confirmAndSave = (toSave: StoreDraft) => {
    if (hasErrors(validateStoreDraft(toSave, otherStores))) return;
    // Removing departments that items are in: first choose new departments for those items.
    const groups = store ? departmentsToReassign(store, toSave, items, stores) : [];
    if (groups.length === 0) {
      void save(toSave);
      return;
    }
    setChoices({});
    setAddedDepartments([]);
    setReassigning({ groups, draft: toSave });
  };

  const overlays = (
    <>
      {/* Saving updates every item listed under the store (and copying lists them under the new one),
          which can take a while: the form can't be left until it's done, so say so. */}
      {saving ? <BusyOverlay message={copySource ? 'Copying store…' : 'Saving store…'} /> : null}
      {deleting ? <BusyOverlay message="Deleting store…" /> : null}
    </>
  );
  // Edit mode's title, or "Reassign items" while reassigning.
  const title = store ? <Stack.Screen options={{ title: reassigning ? 'Reassign items' : STORE_FORM_TITLES.edit }} /> : null;

  if (store && reassigning) {
    const reassignments = Object.fromEntries(
      Object.entries(choices).filter((entry): entry is [string, string] => !!entry[1]),
    );
    return (
      <>
        {title}
        <ReassignDepartments
          storeName={store.name}
          groups={reassigning.groups}
          departments={reassigning.draft.departments}
          added={addedDepartments}
          onAddedChange={setAddedDepartments}
          choices={choices}
          onChoicesChange={setChoices}
          knownStores={stores}
          saving={busy}
          error={saveError}
          onCancel={cancelReassigning}
          onConfirm={() =>
            void save(
              // New departments go at the end of the store's order.
              { ...reassigning.draft, departments: [...reassigning.draft.departments, ...addedDepartments] },
              reassignments,
            )
          }
        />
        {overlays}
      </>
    );
  }

  return (
    <>
    {title}
    <Screen
      scrollRef={scrollRef}
      footer={
        <>
          <Button variant="secondary" label="Cancel" disabled={busy} onPress={() => goBack(backTo)} />
          <Button ref={saveButton} label="Save" disabled={busy} onPress={handleSave} />
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
        newName={newDepartment}
        onNewNameChange={setNewDepartment}
        addError={departmentAddError}
        onAddErrorChange={setDepartmentAddError}
      />
      {copySource ? <CopyItemsSwitch source={copySource} items={items} value={copyItems} onChange={setCopyItems} /> : null}
      {saveError ? <ErrorText message={saveError} /> : null}
      {deletion?.error ? <ErrorText message={deletion.error} /> : null}
      {store && deletion ? (
        <Button
          variant="danger"
          label="Delete store"
          disabled={busy}
          onPress={() => deletion.confirmDelete(store, () => leave(backTo))}
        />
      ) : null}
    </Screen>
    {overlays}
    </>
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
