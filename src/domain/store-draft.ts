import { nameKey, normalizeText } from '@/utils/text';

import { checkName } from './names';

import type { Department, Item, Store } from './types';

export type StoreDraft = {
  name: string;
  location: string;
  departments: Department[];
};

export type StoreDraftErrors = {
  name?: string;
  location?: string;
  departments?: string;
};

export function emptyStoreDraft(): StoreDraft {
  return { name: '', location: '', departments: [] };
}

export function storeToDraft(store: Store): StoreDraft {
  return {
    name: store.name,
    location: store.location ?? '',
    departments: store.departments.map((d) => ({ ...d })),
  };
}

/**
 * Checks the draft. `otherStores` are the user's other stores: two stores can share a name only
 * if their locations differ, so they can be told apart (on the trip, and in an imported file).
 */
export function validateStoreDraft(draft: StoreDraft, otherStores: Store[]): StoreDraftErrors {
  const errors: StoreDraftErrors = {};
  const name = checkName(draft.name, 'Store name', { required: true });
  const location = checkName(draft.location, 'Location', { required: false });
  if (!normalizeText(draft.name)) {
    errors.name = 'Store name is required.';
  } else if (!name.ok) {
    errors.name = name.error;
  }
  if (!location.ok) {
    errors.location = location.error;
  } else if (name.ok) {
    const twin = otherStores.find(
      (s) => nameKey(s.name) === nameKey(name.value) && nameKey(s.location ?? '') === nameKey(location.value),
    );
    if (twin) {
      errors.location = location.value
        ? `You already have ${twin.name} at ${twin.location}. Use a different location to tell them apart.`
        : `You already have a store called ${twin.name}. Add a location to tell them apart.`;
    }
  }
  if (draft.departments.length === 0) {
    errors.departments = 'Add at least one department so items can be placed in this store.';
  }
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

/** Whether the draft differs from how the form started (`initial`). */
export function storeDraftChanged(draft: StoreDraft, initial: StoreDraft): boolean {
  return (
    draft.name !== initial.name ||
    draft.location !== initial.location ||
    draft.departments.length !== initial.departments.length ||
    draft.departments.some((d, i) => d.id !== initial.departments[i].id || d.name !== initial.departments[i].name)
  );
}

export type RemovedDepartmentsInUse = {
  /** Removed departments that items are in, in the store's order. */
  names: string[];
  /** How many items are in them, and so will no longer be listed under the store. */
  itemCount: number;
};

/**
 * The departments saving `draft` would remove from `store` that items are still in. Those items
 * lose their place in this store. A department added back under the same name is a new, empty
 * one: items aren't moved to it.
 */
export function removedDepartmentsInUse(store: Store, draft: StoreDraft, items: Item[]): RemovedDepartmentsInUse {
  const kept = new Set(draft.departments.map((d) => d.id));
  const removed = new Set(store.departments.filter((d) => !kept.has(d.id)).map((d) => d.id));
  const used = new Set<string>();
  let itemCount = 0;
  for (const item of items) {
    const loc = item.locations.find((l) => l.storeId === store.id);
    if (loc && removed.has(loc.departmentId)) {
      used.add(loc.departmentId);
      itemCount += 1;
    }
  }
  return { names: store.departments.filter((d) => used.has(d.id)).map((d) => d.name), itemCount };
}

/** How many items are listed under the store. */
export function countItemsAtStore(storeId: string, items: Item[]): number {
  return items.filter((item) => item.locations.some((l) => l.storeId === storeId)).length;
}
