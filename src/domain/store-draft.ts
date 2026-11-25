import { createId } from '@/utils/id';
import { nameKey, normalizeText, sameName } from '@/utils/text';

import { storeLabel } from './describe';
import { checkName } from './names';

import type { Department, Item, ItemLocation, Store } from './types';

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

/** An item in a department that saving would remove, and the other stores it's listed under. */
export type ItemToReassign = { item: Item; otherStores: string[] };

/** A department that saving would remove, with its items (A–Z). */
export type DepartmentToReassign = { department: Department; items: ItemToReassign[] };

/**
 * The departments saving `draft` would remove from `store` that items are in, in the store's
 * order, each with its items A–Z and the other stores they're listed under (labelled "Kroger,
 * Main St"), so the user can choose new departments for them before saving.
 */
export function departmentsToReassign(store: Store, draft: StoreDraft, items: Item[], stores: Store[]): DepartmentToReassign[] {
  const kept = new Set(draft.departments.map((d) => d.id));
  const label = (id: string) => {
    const other = stores.find((s) => s.id === id);
    return other ? storeLabel(other) : undefined;
  };
  return store.departments
    .filter((d) => !kept.has(d.id))
    .map((department) => ({
      department,
      items: items
        .filter((item) => item.locations.some((l) => l.storeId === store.id && l.departmentId === department.id))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map((item) => ({
          item,
          otherStores: item.locations
            .filter((l) => l.storeId !== store.id)
            .flatMap((l) => {
              const name = label(l.storeId);
              return name ? [name] : [];
            }),
        })),
    }))
    .filter((group) => group.items.length > 0);
}

/** How many of the items to reassign have no new department chosen (`choices`: item id → department id). */
export function unassignedCount(groups: DepartmentToReassign[], choices: Record<string, string | undefined>): number {
  return groups.reduce((n, group) => n + group.items.filter(({ item }) => !choices[item.id]).length, 0);
}

/** How many items are listed under the store. */
export function countItemsAtStore(storeId: string, items: Item[]): number {
  return items.filter((item) => item.locations.some((l) => l.storeId === storeId)).length;
}

/** Which source department each copied department came from: new department id → source department id. */
export type DepartmentSources = Record<string, string>;

/**
 * The starting draft for copying `source`: no name or location yet (the user gives the new
 * store's), and a copy of each of its departments, in order, under new ids.
 */
export function copyStoreDraft(source: Store): { draft: StoreDraft; departmentSources: DepartmentSources } {
  const departmentSources: DepartmentSources = {};
  const departments = source.departments.map((d) => {
    const id = createId();
    departmentSources[id] = d.id;
    return { id, name: d.name };
  });
  return { draft: { name: '', location: '', departments }, departmentSources };
}

/**
 * Where to list `source`'s items in the copy (`draft`, saved as `newStoreId`): each item at the
 * source store goes in the copy of its department there. A source department's copy is:
 * - the department copied from it, if still in the draft (it may have been renamed or moved);
 * - else a draft department with the same name (ignoring case and spacing) that isn't the copy
 *   of another department, e.g. one removed and added back before saving;
 * - else there is none, and its items are left out.
 */
export function copiedLocations(
  items: Item[],
  source: Store,
  newStoreId: string,
  draft: StoreDraft,
  departmentSources: DepartmentSources,
): Map<string, ItemLocation> {
  const draftIds = new Set(draft.departments.map((d) => d.id));
  const copyOf = new Map<string, string>();
  for (const [copyId, sourceId] of Object.entries(departmentSources)) {
    if (draftIds.has(copyId)) copyOf.set(sourceId, copyId);
  }
  // Draft departments still copied from a source department can't be claimed by name as well.
  const claimed = new Set(copyOf.values());
  for (const dept of source.departments) {
    if (copyOf.has(dept.id)) continue;
    const match = draft.departments.find((d) => !claimed.has(d.id) && sameName(d.name, dept.name));
    if (match) {
      copyOf.set(dept.id, match.id);
      claimed.add(match.id);
    }
  }

  const locations = new Map<string, ItemLocation>();
  for (const item of items) {
    const loc = item.locations.find((l) => l.storeId === source.id);
    const departmentId = loc && copyOf.get(loc.departmentId);
    if (departmentId) locations.set(item.id, { storeId: newStoreId, departmentId });
  }
  return locations;
}
