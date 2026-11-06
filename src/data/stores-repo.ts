import { map, type Observable } from 'rxjs';

import type { AppDatabase } from '@/db/database';
import { pruneLocations } from '@/domain/item-draft';
import type { StoreDraft } from '@/domain/store-draft';
import type { Store } from '@/domain/types';
import { createId } from '@/utils/id';
import { normalizeText } from '@/utils/text';

export function observeStores(db: AppDatabase): Observable<Store[]> {
  return db.stores
    .find({ sort: [{ createdAt: 'asc' }] })
    .$.pipe(map((docs) => docs.map((doc) => doc.toMutableJSON())));
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

export async function deleteStore(db: AppDatabase, id: string): Promise<void> {
  await db.stores.findOne(id).remove();
  await pruneItemLocations(db);
}
