import { randomToken } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';

import { createAppDatabase, type AppDatabase } from '@/db/database';

const open: AppDatabase[] = [];

/** A fresh, isolated in-memory database. Closed automatically after each test. */
export async function createTestDatabase(): Promise<AppDatabase> {
  const db = await createAppDatabase(`test${randomToken(10)}`, { storage: getRxStorageMemory() });
  open.push(db);
  return db;
}

export async function closeTestDatabases(): Promise<void> {
  await Promise.all(open.splice(0).map((db) => db.close()));
}
