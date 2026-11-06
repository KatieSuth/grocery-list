import { map, type Observable } from 'rxjs';

import type { AppDatabase } from '@/db/database';
import { normalizeQuantity } from '@/domain/quantity';
import type { ListEntry } from '@/domain/types';

/** All checked items, keyed by item id. */
export function observeListEntries(db: AppDatabase): Observable<Record<string, ListEntry>> {
  return db.listEntries.find().$.pipe(
    map((docs) => Object.fromEntries(docs.map((doc) => [doc.itemId, doc.toMutableJSON()]))),
  );
}

/** Checks an item (with no quantity) or unchecks it (discarding its quantity). */
export async function setChecked(db: AppDatabase, itemId: string, checked: boolean): Promise<void> {
  if (checked) {
    await db.listEntries.upsert({ itemId, checkedAt: Date.now() });
  } else {
    await db.listEntries.findOne(itemId).remove();
  }
}

/** Sets or clears the quantity of a checked item. Does nothing if the item isn't checked. */
export async function setQuantity(db: AppDatabase, itemId: string, value: string): Promise<void> {
  const doc = await db.listEntries.findOne(itemId).exec();
  if (!doc) return;
  const quantity = normalizeQuantity(value);
  await doc.incrementalModify((old) => {
    const { quantity: _drop, ...rest } = old;
    return quantity ? { ...rest, quantity } : rest;
  });
}
