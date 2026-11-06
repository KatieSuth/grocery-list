// Installs a synchronous, SQLite-backed `globalThis.localStorage` on iOS and Android.
import 'expo-sqlite/localStorage/install';

import { getRxStorageLocalstorage } from 'rxdb/plugins/storage-localstorage';

import { sha256 } from './hash';
import type { StorageConfig } from './storage-config';

type MaybeEventTarget = {
  addEventListener?: unknown;
  removeEventListener?: unknown;
};

/**
 * RxDB's localStorage storage listens for browser `storage` events via
 * `window.addEventListener`. React Native defines `window` but not the listener API,
 * and those events only matter across browser tabs, so a no-op is correct here.
 */
export function ensureWindowEventListeners(target: MaybeEventTarget | undefined): void {
  if (!target) return;
  if (typeof target.addEventListener !== 'function') {
    target.addEventListener = () => {};
  }
  if (typeof target.removeEventListener !== 'function') {
    target.removeEventListener = () => {};
  }
}

export function getStorageConfig(): StorageConfig {
  ensureWindowEventListeners(
    typeof window === 'undefined' ? undefined : (window as unknown as MaybeEventTarget),
  );
  return {
    storage: getRxStorageLocalstorage({ localStorage: globalThis.localStorage }),
    // Hermes has no crypto.subtle, which RxDB's default hash relies on.
    hashFunction: sha256,
  };
}
