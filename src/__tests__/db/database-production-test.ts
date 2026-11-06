import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';

import type * as DatabaseModule from '@/db/database';

test('production builds skip dev-mode and validation but still work', async () => {
  const globals = globalThis as { __DEV__?: boolean };
  const previous = globals.__DEV__;
  globals.__DEV__ = false;
  try {
    let mod!: typeof DatabaseModule;
    jest.isolateModules(() => {
      mod = jest.requireActual('@/db/database');
    });
    const db = await mod.createAppDatabase('prodtest', { storage: getRxStorageMemory() });
    await db.stores.insert({ id: 's', name: 'Shop', departments: [], createdAt: 1 });
    expect(await db.stores.count().exec()).toBe(1);
    await db.close();
  } finally {
    globals.__DEV__ = previous;
  }
});
