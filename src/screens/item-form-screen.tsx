import { useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Screen } from "@/components/screen";
import {
  StoreLocationPicker,
  type AddDepartmentOutcome,
} from "@/components/store-location-picker";
import { ErrorText, TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { ToggleSwitch } from "@/components/toggle-switch";
import { Spacing } from "@/constants/theme";
import { deleteItem, saveItem } from "@/data/items-repo";
import { setChecked } from "@/data/list-repo";
import { addStoreDepartment } from "@/data/stores-repo";
import { useDatabase } from "@/db/database-provider";
import {
  chooseDepartment,
  draftToLocations,
  emptyItemDraft,
  findDuplicateItem,
  isItemDraftBlank,
  itemDraftChanged,
  itemToDraft,
  toggleStore,
  validateItemDraft,
} from "@/domain/item-draft";
import { hasErrors } from "@/domain/store-draft";
import { MAX_NAME_LENGTH } from "@/domain/names";
import type { Item, Store } from "@/domain/types";
import { useItems, useStores } from "@/hooks/use-data";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import { confirmAction, confirmDestructive } from "@/utils/confirm";
import { goBack } from "@/utils/navigation";
import { runWrite } from "@/utils/run-write";
import { sameName } from "@/utils/text";

type Props = {
  /** Where Save, Cancel and Delete return to. */
  backTo: Href;
};

/** Add (no `id` param) or edit (`?id=`) an item. Shared by setup and the main app. */
export function ItemFormScreen({ backTo }: Props) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const items = useItems();
  const stores = useStores();
  if (!items || !stores) return null;

  if (!id) return <ItemForm items={items} stores={stores} backTo={backTo} />;
  const item = items.find((i) => i.id === id);
  if (!item) {
    return (
      <Screen
        footer={
          <Button
            variant="secondary"
            label="Back"
            onPress={() => goBack(backTo)}
          />
        }
      >
        <EmptyState
          title="Item not found"
          message="It may have been deleted."
        />
      </Screen>
    );
  }
  return (
    <ItemForm
      key={item.id}
      item={item}
      items={items}
      stores={stores}
      backTo={backTo}
    />
  );
}

/** Asks whether to save an item that has the same name and brand as one already in the list. */
function confirmSavingDuplicate(duplicate: Item): Promise<boolean> {
  const described = duplicate.brand
    ? `${duplicate.name} (${duplicate.brand})`
    : duplicate.name;
  return new Promise((resolve) =>
    confirmAction({
      title: "Already in your list",
      message: `${described} is already in your list. Save another one anyway?`,
      confirmLabel: "Save anyway",
      cancelLabel: "Keep editing",
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    }),
  );
}

function ItemForm({
  item,
  items,
  stores,
  backTo,
}: Props & { item?: Item; items: Item[]; stores: Store[] }) {
  const db = useDatabase();
  const [initial] = useState(() =>
    item ? itemToDraft(item) : emptyItemDraft(),
  );
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  /**
   * New items only: also check the item on the list when it's saved, since an item is often
   * added because it's needed right now. Kept as chosen across "Add more".
   */
  const [needed, setNeeded] = useState(true);
  const leave = useUnsavedChangesWarning(
    itemDraftChanged(draft, initial),
    "item",
  );

  const errors = submitted ? validateItemDraft(draft, stores) : {};

  /** Validates and saves; resolves to the saved item, or null if invalid or failed. */
  const save = async (): Promise<Item | null> => {
    setSubmitted(true);
    setMessage(undefined);
    if (hasErrors(validateItemDraft(draft, stores))) return null;
    // Two items with the same name and brand can be meant, but usually aren't.
    const duplicate = findDuplicateItem(draft, items, item?.id);
    if (duplicate && !(await confirmSavingDuplicate(duplicate))) return null;
    setSaving(true);
    setSaveError(undefined);
    try {
      const saved = await saveItem(
        db,
        {
          name: draft.name,
          brand: draft.brand,
          locations: draftToLocations(draft, stores),
        },
        item?.id,
      );
      if (!item && needed) {
        runWrite(
          () => setChecked(db, saved.id, true),
          `${saved.name} was saved, but couldn’t be checked on your list. Check it on the Items tab.`,
        );
      }
      return saved;
    } catch {
      setSaveError("Could not save this item. Please try again.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleAddMore = async () => {
    const saved = await save();
    if (!saved) return;
    setDraft(emptyItemDraft());
    setSubmitted(false);
    setMessage(`Saved “${saved.name}”. Add another, or tap Continue.`);
  };

  const handleContinue = async () => {
    // Nothing entered (e.g. right after "Add more"): just go back.
    if (!item && isItemDraftBlank(draft)) {
      leave(backTo);
      return;
    }
    if (await save()) leave(backTo);
  };

  /** Adds a missing department to a store and chooses it for this item. */
  const handleAddDepartment = async (
    storeId: string,
    name: string,
  ): Promise<AddDepartmentOutcome> => {
    // The picker only offers stores from this list.
    const store = stores.find((s) => s.id === storeId) as Store;
    // Typed a name the store already has: just choose that one.
    const existing = store.departments.find((d) => sameName(d.name, name));
    if (existing) {
      setDraft((d) => chooseDepartment(d, storeId, existing.id));
      return {
        ok: true,
        note: `${store.name} already has ${existing.name}, so it’s chosen.`,
      };
    }
    try {
      const result = await addStoreDepartment(db, storeId, name);
      if (!result.ok) return result;
      setDraft((d) => chooseDepartment(d, storeId, result.department.id));
      return {
        ok: true,
        note: `Added ${result.department.name} at the end of ${store.name}’s departments. You can move it on the store’s page.`,
      };
    } catch {
      return {
        ok: false,
        error: "Could not add the department. Please try again.",
      };
    }
  };

  const handleDelete = (target: Item) => {
    confirmDestructive({
      title: `Delete ${target.name}?`,
      confirmLabel: "Delete",
      onConfirm: () => {
        leave(backTo);
        runWrite(
          () => deleteItem(db, target.id),
          `Could not delete ${target.name}. Please try again.`,
        );
      },
    });
  };

  return (
    <Screen
      footer={
        item ? (
          <>
            <Button
              variant="secondary"
              label="Cancel"
              onPress={() => goBack(backTo)}
            />
            <Button
              label="Save"
              disabled={saving}
              onPress={() => void handleContinue()}
            />
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              label="Add more"
              disabled={saving}
              onPress={() => void handleAddMore()}
            />
            <Button
              label="Continue"
              disabled={saving}
              onPress={() => void handleContinue()}
            />
          </>
        )
      }
    >
      {message ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          accessibilityLiveRegion="polite"
        >
          {message}
        </ThemedText>
      ) : null}
      <TextField
        label="Item name"
        placeholder="e.g. Milk"
        value={draft.name}
        onChangeText={(name) => setDraft({ ...draft, name })}
        error={errors.name}
        autoFocus={!item}
        maxLength={MAX_NAME_LENGTH}
      />
      <TextField
        label="Brand/Distinguisher"
        optional
        placeholder="e.g. 'Organic Valley,' '3-pack,' etc."
        value={draft.brand}
        onChangeText={(brand) => setDraft({ ...draft, brand })}
        error={errors.brand}
        maxLength={MAX_NAME_LENGTH}
      />
      {item ? null : (
        <View style={styles.needed}>
          <View style={styles.neededText}>
            <ThemedText type="smallBold">Needed</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Check it on your list when it’s saved.
            </ThemedText>
          </View>
          <ToggleSwitch
            accessibilityLabel="Needed"
            accessibilityHint="When on, the item is checked on your list as soon as it’s saved"
            value={needed}
            onValueChange={setNeeded}
          />
        </View>
      )}
      {stores.length > 0 ? (
        <StoreLocationPicker
          stores={stores}
          selections={draft.selections}
          onToggleStore={(storeId) => setDraft(toggleStore(draft, storeId))}
          onChooseDepartment={(storeId, departmentId) =>
            setDraft(chooseDepartment(draft, storeId, departmentId))
          }
          onAddDepartment={handleAddDepartment}
          storesError={errors.stores}
          departmentErrors={errors.departments}
        />
      ) : (
        <EmptyState
          title="No stores yet"
          message="Go back and add a store first, so you can say where to find this item."
        />
      )}
      {saveError ? <ErrorText message={saveError} /> : null}
      {item ? (
        <Button
          variant="danger"
          label="Delete item"
          onPress={() => handleDelete(item)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  needed: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  neededText: { flex: 1, gap: Spacing.half },
});
