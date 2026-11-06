// jsdom lacks some browser APIs RxDB uses; real browsers have them. Borrow Node's implementations.
import { webcrypto } from 'crypto';
import { TextDecoder, TextEncoder } from 'util';

Object.assign(globalThis, { TextEncoder, TextDecoder });
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
