import { sha256 } from '@/db/hash';

jest.mock('expo-crypto', () => {
  const nodeCrypto = jest.requireActual('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    CryptoEncoding: { HEX: 'hex' },
    digestStringAsync: jest.fn(async (_alg: string, data: string) =>
      nodeCrypto.createHash('sha256').update(data).digest('hex'),
    ),
    digest: jest.fn(async (_alg: string, data: Uint8Array) => {
      const out = nodeCrypto.createHash('sha256').update(data).digest();
      return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
    }),
  };
});

// Well-known SHA-256 test vector for "abc".
const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const bytes = () => new TextEncoder().encode('abc').buffer as ArrayBuffer;

test('hashes strings to hex', async () => {
  expect(await sha256('abc')).toBe(expected);
});

test('hashes ArrayBuffers to the same hex', async () => {
  expect(await sha256(bytes())).toBe(expected);
});

test('hashes Blobs via their bytes', async () => {
  const blob = { arrayBuffer: async () => bytes() } as unknown as Blob;
  expect(await sha256(blob)).toBe(expected);
});
