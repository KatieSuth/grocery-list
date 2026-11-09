import type { AppDatabase } from '@/db/database';
import type { ImportPlan } from '@/domain/csv-import';
import type { Item, Store } from '@/domain/types';

/** The stores (in the user's order) and items an import is checked against. */
export async function loadImportContext(db: AppDatabase): Promise<{ stores: Store[]; items: Item[] }> {
  const [stores, items] = await Promise.all([
    db.stores.find({ sort: [{ createdAt: 'asc' }] }).exec(),
    db.items.find({ sort: [{ createdAt: 'asc' }] }).exec(),
  ]);
  return { stores: stores.map((d) => d.toMutableJSON()), items: items.map((d) => d.toMutableJSON()) };
}

function throwOnErrors(what: string, error: unknown[]): void {
  if (error.length > 0) throw new Error(`Could not save ${error.length} ${what}`);
}

/**
 * Writes a checked import plan (see planImport). Stores and departments go first, so if a later
 * write fails, nothing points at a department that doesn't exist. Changes to existing stores and
 * items only ever add to them, so edits made elsewhere aren't overwritten.
 */
export async function applyImportPlan(db: AppDatabase, plan: ImportPlan): Promise<void> {
  if (plan.newStores.length > 0) {
    throwOnErrors('stores', (await db.stores.bulkInsert(plan.newStores)).error);
  }
  for (const [storeId, departments] of plan.departmentAdds) {
    const doc = await db.stores.findOne(storeId).exec();
    if (!doc) throw new Error('A store changed during the import');
    await doc.incrementalModify((old) => ({
      ...old,
      departments: [...old.departments, ...departments.filter((d) => !old.departments.some((o) => o.id === d.id))],
    }));
  }

  if (plan.newItems.length > 0) {
    throwOnErrors('items', (await db.items.bulkInsert(plan.newItems)).error);
  }
  for (const [itemId, locations] of plan.locationAdds) {
    const doc = await db.items.findOne(itemId).exec();
    if (!doc) throw new Error('An item changed during the import');
    await doc.incrementalModify((old) => ({
      ...old,
      // Still one department per store, even if the item changed since the plan was made.
      locations: [...old.locations, ...locations.filter((l) => !old.locations.some((o) => o.storeId === l.storeId))],
    }));
  }
}
