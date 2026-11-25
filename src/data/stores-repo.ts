import { map, type Observable } from 'rxjs';

import type { AppDatabase } from '@/db/database';
import { addDepartment } from '@/domain/departments';
import { pruneLocations } from '@/domain/item-draft';
import { copiedLocations, type DepartmentSources, type StoreDraft } from '@/domain/store-draft';
import { compareStores } from '@/domain/store-sort';
import type { Department, Item, Store } from '@/domain/types';
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

/** New departments at a store for some of its items: item id → department id. */
export type Reassignments = Record<string, string>;

/**
 * Removes item locations that point at stores or departments that no longer exist (or, with
 * `leaving`, at that store, which is about to be deleted), in a single write. With `reassign`,
 * an item whose department at that store no longer exists is moved to its chosen one first, in
 * the same write. Returns the items as they were before, so the change can be undone.
 */
async function pruneItemLocations(
  db: AppDatabase,
  { leaving, reassign }: { leaving?: string; reassign?: { storeId: string; departments: Reassignments } } = {},
): Promise<Item[]> {
  const stores = (await db.stores.find().exec()).map((d) => d.toMutableJSON()).filter((s) => s.id !== leaving);
  const items = (await db.items.find().exec()).map((d) => d.toMutableJSON());
  const departmentExists = (storeId: string, departmentId: string) =>
    stores.some((s) => s.id === storeId && s.departments.some((d) => d.id === departmentId));
  const before: Item[] = [];
  const pruned: Item[] = [];
  for (const item of items) {
    const chosen = reassign?.departments[item.id];
    const moved = item.locations.map((l) =>
      chosen && l.storeId === reassign?.storeId && !departmentExists(l.storeId, l.departmentId)
        ? { storeId: l.storeId, departmentId: chosen }
        : l,
    );
    const locations = pruneLocations(moved, stores);
    const changed =
      locations.length !== item.locations.length || locations.some((l, i) => l.departmentId !== item.locations[i].departmentId);
    if (!changed) continue;
    before.push(item);
    pruned.push({ ...item, locations });
  }
  await bulkUpsertItems(db, pruned);
  return before;
}

async function bulkUpsertItems(db: AppDatabase, items: Item[]): Promise<void> {
  if (items.length === 0) return;
  const { error } = await db.items.bulkUpsert(items);
  if (error.length > 0) throw new Error(`Could not save ${error.length} items`);
}

/**
 * Creates a store, or updates the store with `id`. Returns the saved store. Items in departments
 * the update removes lose this store, except those in `reassign`, which move to their chosen
 * department (one the draft keeps or adds). If updating the items fails, the store is put back
 * as it was.
 */
export async function saveStore(db: AppDatabase, draft: StoreDraft, id?: string, reassign?: Reassignments): Promise<Store> {
  const fields = fromDraft(draft);
  const existing = id ? await db.stores.findOne(id).exec() : null;
  if (!existing) {
    const doc = await db.stores.insert({ id: id ?? createId(), createdAt: Date.now(), ...fields });
    return doc.toMutableJSON();
  }
  const before = existing.toMutableJSON();
  const doc = await existing.incrementalModify((old) => {
    const { location: _drop, ...rest } = old;
    return { ...rest, ...fields };
  });
  try {
    await pruneItemLocations(db, reassign && { reassign: { storeId: doc.id, departments: reassign } });
  } catch (error) {
    // Report what went wrong in the first place, even if putting the store back fails too (the
    // items are then tidied up by the next save).
    await doc.incrementalModify(() => before).catch(() => {});
    throw error;
  }
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
    await bulkUpsertItems(db, updated);
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

/**
 * Deletes a store, taking it off every item first, so the store only disappears once nothing is
 * left to do (a form showing it can stay open until then). If removing the store itself then
 * fails, the items are put back as they were.
 */
export async function deleteStore(db: AppDatabase, id: string): Promise<void> {
  const before = await pruneItemLocations(db, { leaving: id });
  try {
    await db.stores.findOne(id).remove();
  } catch (error) {
    await bulkUpsertItems(db, before);
    throw error;
  }
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
