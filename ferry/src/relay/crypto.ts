// The relay's key agreement, browser side (nodeterm src/core/relay/e2ee.ts is the reference).
//
// baseKey = HSalsa20(X25519(ourSecret, hostPub)) — exactly tweetnacl's `box.before`. The X25519 step
// runs in WebCrypto against a NON-EXTRACTABLE private key, so the device secret never exists as bytes
// in JS: script can use it while the page runs but can never copy it out. HSalsa20 then turns the raw
// output into the NaCl precompute. sessionKey = HKDF-SHA256(baseKey, hostNonce‖clientNonce,
// "nodeterm-relay-session-v2").
import nacl from 'tweetnacl'
import { buf, bytesToB64Url, canonicalB64ToBytes } from './b64'

const subtle = () => globalThis.crypto.subtle

export const KEY_BYTES = 32
export const HANDSHAKE_NONCE_BYTES = 16
const SESSION_INFO = new TextEncoder().encode('nodeterm-relay-session-v2')

export interface DeviceKey {
  /** Non-extractable X25519 private key (a CryptoKey: IndexedDB stores it by structured clone). */
  privateKey: CryptoKey
  /** Raw 32-byte public key, sent in `e2ee_hello` and pinned by the desktop. */
  publicKey: Uint8Array
}

export class WeakPeerKeyError extends Error {
  readonly code = 'E_WEAK_PEER_KEY'
  constructor() {
    super('Refused a low-order X25519 key: the shared secret would be public. The code is corrupt or was tampered with.')
  }
}

export async function generateDeviceKey(): Promise<DeviceKey> {
  const pair = (await subtle().generateKey({ name: 'X25519' }, false, ['deriveBits'])) as CryptoKeyPair
  const publicKey = new Uint8Array(await subtle().exportKey('raw', pair.publicKey))
  return { privateKey: pair.privateKey, publicKey }
}

/** Test seam: a device key from a known secret (the docs' vectors). Never used by the app. */
export async function deviceKeyFromSecret(secret: Uint8Array): Promise<DeviceKey> {
  const publicKey = nacl.scalarMult.base(secret)
  const jwk = { kty: 'OKP', crv: 'X25519', d: bytesToB64Url(secret), x: bytesToB64Url(publicKey) }
  const privateKey = await subtle().importKey('jwk', jwk, { name: 'X25519' }, false, ['deriveBits'])
  return { privateKey, publicKey }
}

const allZero = (b: Uint8Array): boolean => b.every((x) => x === 0)
const LOW_ORDER_PROBE = new Uint8Array(32).fill(0x5a)

/** Any clamped scalar sends exactly the low-order points to zero (e2ee.ts isLowOrderPublicKey). */
export function isLowOrderPublicKey(pub: Uint8Array): boolean {
  return pub.length === KEY_BYTES && allZero(nacl.scalarMult(LOW_ORDER_PROBE, pub))
}

/** A host key from canonical base64, refusing a low-order point. */
export function hostKeyFromB64(b64: unknown): Uint8Array {
  const key = canonicalB64ToBytes(b64, KEY_BYTES, 'host key')
  if (isLowOrderPublicKey(key)) throw new WeakPeerKeyError()
  return key
}

const SIGMA = new TextEncoder().encode('expand 32-byte k')
const lowlevel = (nacl as unknown as {
  lowlevel: { crypto_core_hsalsa20(out: Uint8Array, inp: Uint8Array, k: Uint8Array, c: Uint8Array): number }
}).lowlevel

/** HSalsa20(raw X25519 output) = nacl.box.before. */
export function hsalsa(raw: Uint8Array): Uint8Array {
  const out = new Uint8Array(32)
  lowlevel.crypto_core_hsalsa20(out, new Uint8Array(16), raw, SIGMA)
  return out
}

/** The stable identity key both ends derive (the SAS comes from it; traffic never uses it directly). */
export async function deriveBaseKey(device: DeviceKey, hostPub: Uint8Array): Promise<Uint8Array> {
  if (isLowOrderPublicKey(hostPub)) throw new WeakPeerKeyError()
  const peer = await subtle().importKey('raw', buf(hostPub), { name: 'X25519' }, false, [])
  let raw: Uint8Array
  try {
    raw = new Uint8Array(await subtle().deriveBits({ name: 'X25519', public: peer }, device.privateKey, 256))
  } catch {
    throw new WeakPeerKeyError() // WebCrypto refuses an all-zero result itself
  }
  if (allZero(raw)) throw new WeakPeerKeyError()
  return hsalsa(raw)
}

export async function deriveSessionKey(base: Uint8Array, hostNonce: Uint8Array, clientNonce: Uint8Array): Promise<Uint8Array> {
  const salt = new Uint8Array(hostNonce.length + clientNonce.length)
  salt.set(hostNonce)
  salt.set(clientNonce, hostNonce.length)
  const ikm = await subtle().importKey('raw', buf(base), 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: buf(salt), info: SESSION_INFO }, ikm, 256))
}

/** SAS v2, "NNN NNN NNNN": h = SHA-512(base); a = BE_u32(h[0..4]) mod 1e6; b = BE_u32(h[4..8]) mod 1e4. */
export function sasFromBaseKey(base: Uint8Array): string {
  const h = nacl.hash(base)
  const u32 = (i: number) => ((h[i]! << 24) | (h[i + 1]! << 16) | (h[i + 2]! << 8) | h[i + 3]!) >>> 0
  const a = String(u32(0) % 1_000_000).padStart(6, '0')
  const b = String(u32(4) % 10_000).padStart(4, '0')
  return `${a.slice(0, 3)} ${a.slice(3)} ${b}`
}

/** The relay broker's room id: base64url(sha256(rawHostKey)).slice(0, 22) (relay-id.ts). */
export async function hostIdFromKey(pub: Uint8Array): Promise<string> {
  return bytesToB64Url(new Uint8Array(await subtle().digest('SHA-256', buf(pub)))).slice(0, 22)
}

export function randomNonce(): Uint8Array {
  return nacl.randomBytes(HANDSHAKE_NONCE_BYTES)
}
