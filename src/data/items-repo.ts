import { map, type Observable } from 'rxjs';

import type { AppDatabase } from '@/db/database';
import type { Item, ItemLocation } from '@/domain/types';
import { createId } from '@/utils/id';
import { normalizeText } from '@/utils/text';

export type ItemInput = {
  name: string;
  brand: string;
  locations: ItemLocation[];
};

/** All items, alphabetical by name. */
export function observeItems(db: AppDatabase): Observable<Item[]> {
  return db.items.find({ sort: [{ createdAt: 'asc' }] }).$.pipe(
    map((docs) =>
      docs
        .map((doc) => doc.toMutableJSON())
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    ),
  );
}

function fromInput(input: ItemInput): Pick<Item, 'name' | 'brand' | 'locations'> {
  const brand = normalizeText(input.brand);
  return {
    name: normalizeText(input.name),
    ...(brand ? { brand } : {}),
    locations: input.locations.map((l) => ({ storeId: l.storeId, departmentId: l.departmentId })),
  };
}

/** Creates an item, or updates the item with `id`. Returns the saved item. */
export async function saveItem(db: AppDatabase, input: ItemInput, id?: string): Promise<Item> {
  const fields = fromInput(input);
  const existing = id ? await db.items.findOne(id).exec() : null;
  if (!existing) {
    const doc = await db.items.insert({ id: id ?? createId(), createdAt: Date.now(), ...fields });
    return doc.toMutableJSON();
  }
  const doc = await existing.incrementalModify((old) => {
    const { brand: _drop, ...rest } = old;
    return { ...rest, ...fields };
  });
  return doc.toMutableJSON();
}

export async function deleteItem(db: AppDatabase, id: string): Promise<void> {
  await db.items.findOne(id).remove();
  await db.listEntries.findOne(id).remove();
}
