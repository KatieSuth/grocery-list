import { normalizeText } from '@/utils/text';

import type { Item, ItemLocation, Store } from './types';

export type ItemDraft = {
  name: string;
  brand: string;
  /**
   * Stores the item is available in, keyed by store id. The value is the chosen
   * department id, or null when the store is selected but no department is picked yet.
   */
  selections: Record<string, string | null>;
};

export type ItemDraftErrors = {
  name?: string;
  stores?: string;
  /** Missing-department errors keyed by store id. */
  departments?: Record<string, string>;
};

export function emptyItemDraft(): ItemDraft {
  return { name: '', brand: '', selections: {} };
}

export function itemToDraft(item: Item): ItemDraft {
  const selections: Record<string, string | null> = {};
  for (const loc of item.locations) {
    selections[loc.storeId] = loc.departmentId;
  }
  return { name: item.name, brand: item.brand ?? '', selections };
}

export function toggleStore(draft: ItemDraft, storeId: string): ItemDraft {
  const selections = { ...draft.selections };
  if (storeId in selections) {
    delete selections[storeId];
  } else {
    selections[storeId] = null;
  }
  return { ...draft, selections };
}

export function chooseDepartment(draft: ItemDraft, storeId: string, departmentId: string): ItemDraft {
  return { ...draft, selections: { ...draft.selections, [storeId]: departmentId } };
}

export function isItemDraftBlank(draft: ItemDraft): boolean {
  return (
    !normalizeText(draft.name) &&
    !normalizeText(draft.brand) &&
    Object.keys(draft.selections).length === 0
  );
}

/** Selections that point at stores that still exist, in the user's store order. */
function selectedStores(draft: ItemDraft, stores: Store[]): Store[] {
  return stores.filter((s) => s.id in draft.selections);
}

export function validateItemDraft(draft: ItemDraft, stores: Store[]): ItemDraftErrors {
  const errors: ItemDraftErrors = {};
  if (!normalizeText(draft.name)) {
    errors.name = 'Item name is required.';
  }
  const selected = selectedStores(draft, stores);
  if (selected.length === 0) {
    errors.stores = 'Choose at least one store.';
  }
  const departmentErrors: Record<string, string> = {};
  for (const store of selected) {
    const departmentId = draft.selections[store.id];
    if (!store.departments.some((d) => d.id === departmentId)) {
      departmentErrors[store.id] = `Choose a department in ${store.name}.`;
    }
  }
  if (Object.keys(departmentErrors).length > 0) {
    errors.departments = departmentErrors;
  }
  return errors;
}

export function draftToLocations(draft: ItemDraft, stores: Store[]): ItemLocation[] {
  return selectedStores(draft, stores).flatMap((store) => {
    const departmentId = draft.selections[store.id];
    return store.departments.some((d) => d.id === departmentId)
      ? [{ storeId: store.id, departmentId: departmentId as string }]
      : [];
  });
}

/** Drops locations whose store or department no longer exists. */
export function pruneLocations(locations: ItemLocation[], stores: Store[]): ItemLocation[] {
  return locations.filter((loc) =>
    stores.some(
      (s) => s.id === loc.storeId && s.departments.some((d) => d.id === loc.departmentId),
    ),
  );
}
