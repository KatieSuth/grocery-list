import { useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Screen } from "@/components/screen";
import { StoreLocationPicker } from "@/components/store-location-picker";
import { ErrorText, TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { deleteItem, saveItem } from "@/data/items-repo";
import { useDatabase } from "@/db/database-provider";
import {
  chooseDepartment,
  draftToLocations,
  emptyItemDraft,
  isItemDraftBlank,
  itemToDraft,
  toggleStore,
  validateItemDraft,
} from "@/domain/item-draft";
import { hasErrors } from "@/domain/store-draft";
import type { Item, Store } from "@/domain/types";
import { useItems, useStores } from "@/hooks/use-data";
import { confirmDestructive } from "@/utils/confirm";
import { goBack } from "@/utils/navigation";

type Props = {
  /** Where Save, Cancel and Delete return to. */
  backTo: Href;
};

/** Add (no `id` param) or edit (`?id=`) a item. Shared by setup and the main app. */
export function ItemFormScreen({ backTo }: Props) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const items = useItems();
  const stores = useStores();
  if (!items || !stores) return null;

  if (!id) return <ItemForm stores={stores} backTo={backTo} />;
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
  return <ItemForm key={item.id} item={item} stores={stores} backTo={backTo} />;
}

function ItemForm({
  item,
  stores,
  backTo,
}: Props & { item?: Item; stores: Store[] }) {
  const db = useDatabase();
  const [draft, setDraft] = useState(() =>
    item ? itemToDraft(item) : emptyItemDraft(),
  );
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [saveError, setSaveError] = useState<string>();

  const errors = submitted ? validateItemDraft(draft, stores) : {};

  /** Validates and saves; resolves to the saved item, or null if invalid or failed. */
  const save = async (): Promise<Item | null> => {
    setSubmitted(true);
    setMessage(undefined);
    if (hasErrors(validateItemDraft(draft, stores))) return null;
    setSaving(true);
    setSaveError(undefined);
    try {
      return await saveItem(
        db,
        {
          name: draft.name,
          brand: draft.brand,
          locations: draftToLocations(draft, stores),
        },
        item?.id,
      );
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
      goBack(backTo);
      return;
    }
    if (await save()) goBack(backTo);
  };

  const handleDelete = (target: Item) => {
    confirmDestructive({
      title: `Delete ${target.name}?`,
      confirmLabel: "Delete",
      onConfirm: () => {
        goBack(backTo);
        void deleteItem(db, target.id);
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
      />
      <TextField
        label="Brand/Distinguisher"
        optional
        placeholder="e.g. 'Organic Valley,' '3-pack,' etc."
        value={draft.brand}
        onChangeText={(brand) => setDraft({ ...draft, brand })}
      />
      {stores.length > 0 ? (
        <StoreLocationPicker
          stores={stores}
          selections={draft.selections}
          onToggleStore={(storeId) => setDraft(toggleStore(draft, storeId))}
          onChooseDepartment={(storeId, departmentId) =>
            setDraft(chooseDepartment(draft, storeId, departmentId))
          }
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
