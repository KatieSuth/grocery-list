type KeyValueStorage = Pick<Storage, 'key' | 'length' | 'removeItem'>;

/**
 * RxDB's localStorage storage keeps each collection's most recent change event, including the
 * document before the change, under a "changes" key so other browser tabs can pick it up. RxDB
 * itself only removes these keys when the database closes. Forgetting them right after deleting
 * everything makes sure no deleted data is left behind. Nothing reads them except other tabs.
 */
export function forgetChangeEvents(
  databaseName: string,
  storage: KeyValueStorage | undefined = globalThis.localStorage,
): void {
  if (!storage) return;
  const prefix = `RxDB-ls-changes-${databaseName}--`;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}
