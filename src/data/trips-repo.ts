import type { RxDocument } from 'rxdb';

import type { AppDatabase } from '@/db/database';
import { buildTripList } from '@/domain/trip';
import type { TripItem, TripRecord } from '@/domain/types';
import { createId } from '@/utils/id';

/**
 * Ends the visit to a store. The items checked off there are logged as bought, get their
 * "last bought" date, and are unchecked from the master list. Items still on the list but not
 * checked off stay checked. Returns the log record, or null if nothing was checked off.
 *
 * Safe to retry: the record is saved first, marked pending, and only marked complete once every
 * other step has worked. If an earlier attempt was interrupted, this completes that trip instead
 * of starting a new one, so nothing is logged twice or lost.
 */
export async function finishTrip(db: AppDatabase, storeId: string): Promise<TripRecord | null> {
  const unfinished = await db.trips.find({ selector: { pending: true } }).exec();
  if (unfinished.length > 0) {
    let completed: TripRecord | null = null;
    for (const doc of unfinished) completed = await completeTrip(db, doc);
    return completed;
  }

  const [store, items, entryDocs] = await Promise.all([
    db.stores.findOne(storeId).exec(),
    db.items.find().exec(),
    db.listEntries.find().exec(),
  ]);
  if (!store) return null;
  const entries = Object.fromEntries(entryDocs.map((d) => [d.itemId, d.toMutableJSON()]));
  const list = buildTripList(
    store.toMutableJSON(),
    items.map((i) => i.toMutableJSON()),
    entries,
    false,
  );

  const bought: TripItem[] = list.sections.flatMap((section) =>
    section.rows
      .filter((row) => row.inCart)
      .map(({ item, entry }) => ({
        itemId: item.id,
        name: item.name,
        ...(item.brand ? { brand: item.brand } : {}),
        ...(entry.quantity ? { quantity: entry.quantity } : {}),
        department: section.department.name,
      })),
  );
  if (bought.length === 0) return null;

  const doc = await db.trips.insert({
    id: createId(),
    storeId,
    storeName: store.name,
    finishedAt: Date.now(),
    items: bought,
    pending: true,
  });
  return completeTrip(db, doc);
}

/** Applies a saved trip to the items and the list, then marks it complete. Each step can be repeated. */
async function completeTrip(db: AppDatabase, doc: RxDocument<TripRecord>): Promise<TripRecord> {
  const { finishedAt, items } = doc;
  const ids = items.map((i) => i.itemId);

  // Items deleted since are skipped.
  const itemDocs = await db.items.findByIds(ids).exec();
  await Promise.all([...itemDocs.values()].map((item) => item.incrementalPatch({ lastBoughtAt: finishedAt })));

  // Only entries still in the cart: an item unchecked and checked again since keeps its new check.
  const entryDocs = await db.listEntries.findByIds(ids).exec();
  const inCart = [...entryDocs.values()].filter((entry) => entry.inCartAt !== undefined);
  // bulkRemove reports failures in its result instead of throwing.
  const { error } = await db.listEntries.bulkRemove(inCart);
  if (error.length > 0) {
    throw new Error(`Could not uncheck ${error.length} of ${inCart.length} items`);
  }

  const done = await doc.incrementalModify(({ pending: _done, ...rest }) => rest);
  return done.toMutableJSON();
}
