import { createHash, hkdfSync } from 'node:crypto'
import nacl from 'tweetnacl'
import { describe, expect, it } from 'vitest'
import { bytesToB64, canonicalB64ToBytes } from './b64'
import {
  WeakPeerKeyError,
  deriveBaseKey,
  deriveSessionKey,
  deviceKeyFromSecret,
  generateDeviceKey,
  hostIdFromKey,
  hostKeyFromB64,
  isLowOrderPublicKey,
  sasFromBaseKey
} from './crypto'

const hex = (h: string) => Uint8Array.from(Buffer.from(h, 'hex'))
const fill = (n: number) => new Uint8Array(32).fill(n)

// Vectors: nodeterm docs/ios-protocol-migration.md §3.1 (computed independently with Python hashlib).
describe('SAS v2', () => {
  const cases: [Uint8Array, string][] = [
    [fill(0x00), '809 281 4822'],
    [fill(0x01), '736 635 8284'],
    [Uint8Array.from({ length: 32 }, (_, i) => i), '170 596 5663'],
    [fill(0xff), '773 237 5799'],
    [Uint8Array.from([0x00, 0x17, ...new Array(30).fill(0)]), '071 120 4361'],
    [Uint8Array.from([0x00, 0x0b, ...new Array(30).fill(0)]), '243 975 0790']
  ]
  it.each(cases)('vector %#', (base, sas) => expect(sasFromBaseKey(base)).toBe(sas))
})

describe('key agreement', () => {
  it('matches the documented end-to-end vector (WebCrypto X25519 + HSalsa20 = box.before)', async () => {
    const a = await deviceKeyFromSecret(fill(0x01))
    const pubB = nacl.scalarMult.base(fill(0x02))
    expect(bytesToB64(a.publicKey)).toBe('pOCSkrZRwni5dyxWn1+puxPZBrRqtoyd+dwrRAn4ogk=')
    expect(bytesToB64(pubB)).toBe('zo060cy2M+x7cMF4FKXHbs0CloUFDTRHRboFhw5YfVk=')
    const base = await deriveBaseKey(a, pubB)
    expect(Buffer.from(base).toString('hex')).toBe('18a99320f3488fa18a04239715d8ee738065e65c3d4b2898522d6c3d4ead588c')
    expect(sasFromBaseKey(base)).toBe('561 048 8895')
  })

  it('agrees with nacl.box.before for a generated, non-extractable key', async () => {
    const dev = await generateDeviceKey()
    expect(dev.privateKey.extractable).toBe(false)
    const host = nacl.box.keyPair()
    expect(await deriveBaseKey(dev, host.publicKey)).toEqual(nacl.box.before(dev.publicKey, host.secretKey))
  })

  it('derives the session key with salt = hostNonce ‖ clientNonce', async () => {
    const base = fill(7)
    const h = fill(1).subarray(0, 16)
    const c = fill(2).subarray(0, 16)
    const want = hkdfSync('sha256', base, Buffer.concat([h, c]), 'nodeterm-relay-session-v2', 32)
    expect(await deriveSessionKey(base, h, c)).toEqual(new Uint8Array(want))
  })

  it('refuses low-order host keys before any agreement', async () => {
    const dev = await generateDeviceKey()
    for (const bad of [new Uint8Array(32), Uint8Array.from([1, ...new Array(31).fill(0)])]) {
      expect(isLowOrderPublicKey(bad)).toBe(true)
      await expect(deriveBaseKey(dev, bad)).rejects.toBeInstanceOf(WeakPeerKeyError)
      expect(() => hostKeyFromB64(bytesToB64(bad))).toThrow(WeakPeerKeyError)
    }
    expect(isLowOrderPublicKey(nacl.box.keyPair().publicKey)).toBe(false)
  })

  it('takes keys only in canonical padded base64', () => {
    const key = bytesToB64(nacl.box.keyPair().publicKey)
    expect(canonicalB64ToBytes(key, 32, 'k')).toHaveLength(32)
    for (const bad of ['!!!' + key, key.replace(/=$/, ''), key + '==', key.slice(0, -2) + 'B=']) {
      expect(() => canonicalB64ToBytes(bad, 32, 'k')).toThrow()
    }
  })

  it('derives the relay host id like relay-id.ts', async () => {
    const pub = nacl.box.keyPair().publicKey
    expect(await hostIdFromKey(pub)).toBe(createHash('sha256').update(pub).digest('base64url').slice(0, 22))
  })
})
