import { map, type Observable } from 'rxjs';

import type { AppDatabase } from '@/db/database';
import { addDepartment } from '@/domain/departments';
import { pruneLocations } from '@/domain/item-draft';
import { copiedLocations, type DepartmentSources, type StoreDraft } from '@/domain/store-draft';
import { compareStores } from '@/domain/store-sort';
import type { Department, Store } from '@/domain/types';
import { createId } from '@/utils/id';
import { normalizeText } from '@/utils/text';

/** All stores, A–Z by name and then location (see compareStores): the order they're listed in everywhere. */
export function observeStores(db: AppDatabase): Observable<Store[]> {
  return db.stores
    .find({ sort: [{ createdAt: 'asc' }] })
    .$.pipe(map((docs) => docs.map((doc) => doc.toMutableJSON()).sort(compareStores)));
}

function fromDraft(draft: StoreDraft): Pick<Store, 'name' | 'location' | 'departments'> {
  const location = normalizeText(draft.location);
  return {
    name: normalizeText(draft.name),
    ...(location ? { location } : {}),
    departments: draft.departments.map((d) => ({ id: d.id, name: d.name })),
  };
}

/** Removes item locations that point at stores or departments that no longer exist. */
async function pruneItemLocations(db: AppDatabase): Promise<void> {
  const stores = (await db.stores.find().exec()).map((d) => d.toMutableJSON());
  const items = await db.items.find().exec();
  for (const item of items) {
    const pruned = pruneLocations(item.toMutableJSON().locations, stores);
    if (pruned.length !== item.locations.length) {
      await item.incrementalPatch({ locations: pruned });
    }
  }
}

/** Creates a store, or updates the store with `id`. Returns the saved store. */
export async function saveStore(db: AppDatabase, draft: StoreDraft, id?: string): Promise<Store> {
  const fields = fromDraft(draft);
  const existing = id ? await db.stores.findOne(id).exec() : null;
  if (!existing) {
    const doc = await db.stores.insert({ id: id ?? createId(), createdAt: Date.now(), ...fields });
    return doc.toMutableJSON();
  }
  const doc = await existing.incrementalModify((old) => {
    const { location: _drop, ...rest } = old;
    return { ...rest, ...fields };
  });
  await pruneItemLocations(db);
  return doc.toMutableJSON();
}

/** A copy failed and couldn't be undone: the new store was left, with only some of its items. */
export class CopyNotUndoneError extends Error {
  constructor(readonly cause: unknown) {
    super('A failed copy could not be undone');
  }
}

export type CopyStoreOptions = {
  /** The store being copied. */
  sourceStoreId: string;
  /** Which source department each of the draft's departments was copied from. */
  departmentSources: DepartmentSources;
  /** Also list the source store's items under the new store, in the matching departments. */
  copyItems: boolean;
};

/**
 * Saves `draft` as a new store copied from another. With `copyItems`, the source store's items
 * are listed under the new store too (see copiedLocations): the same items, not duplicates.
 * Items are matched against the source store as it is now; if it's been deleted, none are.
 *
 * The storage has no transactions, so the copy is made all or nothing as far as it can be: the
 * store is written first, then every item in a single bulk write. If anything fails, the new
 * store is deleted again, which also removes any item listings already written for it. If even
 * that fails, a CopyNotUndoneError says so.
 */
export async function copyStore(
  db: AppDatabase,
  draft: StoreDraft,
  { sourceStoreId, departmentSources, copyItems }: CopyStoreOptions,
): Promise<Store> {
  const store = await saveStore(db, draft);
  if (!copyItems) return store;
  try {
    const source = await db.stores.findOne(sourceStoreId).exec();
    if (!source) return store;
    const items = (await db.items.find().exec()).map((doc) => doc.toMutableJSON());
    const locations = copiedLocations(items, source.toMutableJSON(), store.id, draft, departmentSources);
    // The store is new, so no item is listed under it yet.
    const updated = items.flatMap((item) => {
      const location = locations.get(item.id);
      return location ? [{ ...item, locations: [...item.locations, location] }] : [];
    });
    if (updated.length > 0) {
      const { error } = await db.items.bulkUpsert(updated);
      if (error.length > 0) throw new Error(`Could not list ${error.length} items under the copy`);
    }
    return store;
  } catch (error) {
    try {
      await deleteStore(db, store.id);
    } catch {
      throw new CopyNotUndoneError(error);
    }
    throw error;
  }
}

export async function deleteStore(db: AppDatabase, id: string): Promise<void> {
  await db.stores.findOne(id).remove();
  await pruneItemLocations(db);
}

export type AddStoreDepartmentResult = { ok: true; department: Department } | { ok: false; error: string };

/**
 * Adds a department to the end of a store's walking order (it can be moved on the store form),
 * e.g. from the item form while saying where to find an item. Blank and duplicate names are
 * refused, checked against the store as saved.
 */
export async function addStoreDepartment(db: AppDatabase, storeId: string, name: string): Promise<AddStoreDepartmentResult> {
  const doc = await db.stores.findOne(storeId).exec();
  if (!doc) return { ok: false, error: 'This store no longer exists.' };
  // Refuse blank and duplicate names without writing anything.
  const check = addDepartment(doc.departments, name);
  if (!check.ok) return check;

  let outcome: AddStoreDepartmentResult = { ok: false, error: 'Could not add the department.' };
  await doc.incrementalModify((old) => {
    // The store may have changed since it was read; add to what's there now.
    const result = addDepartment(old.departments, name);
    outcome = result.ok ? { ok: true, department: result.departments[result.departments.length - 1] } : result;
    return result.ok ? { ...old, departments: result.departments } : old;
  });
  return outcome;
}
