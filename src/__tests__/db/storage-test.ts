import { ensureWindowEventListeners, getStorageConfig } from '@/db/storage.native';
import { sha256 } from '@/db/hash';

jest.mock('expo-sqlite/localStorage/install', () => {
  const { getLocalStorageMock: mock } = jest.requireActual('rxdb/plugins/storage-localstorage');
  globalThis.localStorage = mock();
});
jest.mock('expo-crypto', () => ({}));

describe('native', () => {
  test('uses the SQLite-backed localStorage and the expo-crypto hash', () => {
    const config = getStorageConfig();
    expect(config.storage.name).toBe('localstorage');
    expect(config.hashFunction).toBe(sha256);
    expect(globalThis.localStorage).toBeDefined();
  });

  test('ensureWindowEventListeners adds no-op listeners only where missing', () => {
    const bare: { addEventListener?: unknown; removeEventListener?: unknown } = {};
    ensureWindowEventListeners(bare);
    expect(typeof bare.addEventListener).toBe('function');
    expect(typeof bare.removeEventListener).toBe('function');
    expect((bare.addEventListener as () => void)()).toBeUndefined();
    expect((bare.removeEventListener as () => void)()).toBeUndefined();

    const existing = jest.fn();
    const target = { addEventListener: existing, removeEventListener: existing };
    ensureWindowEventListeners(target);
    expect(target.addEventListener).toBe(existing);

    expect(() => ensureWindowEventListeners(undefined)).not.toThrow();
  });

  test('works when window is undefined', () => {
    const original = globalThis.window;
    // @ts-expect-error simulate a runtime without window
    delete globalThis.window;
    try {
      expect(getStorageConfig().storage.name).toBe('localstorage');
    } finally {
      globalThis.window = original;
    }
  });
});

test('web uses browser localStorage with the default hash', () => {
  const web = jest.requireActual('../../db/storage.ts') as typeof import('@/db/storage');
  const config = web.getStorageConfig();
  expect(config.storage.name).toBe('localstorage');
  expect(config.hashFunction).toBeUndefined();
});
