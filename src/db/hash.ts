import * as Crypto from 'expo-crypto';

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 as a hex string, matching RxDB's default hash output format. */
export async function sha256(input: string | ArrayBuffer | Blob): Promise<string> {
  if (typeof input === 'string') {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input, {
      encoding: Crypto.CryptoEncoding.HEX,
    });
  }
  const buffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  return toHex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(buffer)));
}
