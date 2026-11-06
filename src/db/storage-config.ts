import type { HashFunction, RxStorage } from 'rxdb';

export type StorageConfig = {
  // RxDB storages are generic over internals this app never touches.
  storage: RxStorage<any, any>;
  hashFunction?: HashFunction;
};
