import { createHash } from 'node:crypto'
import nacl from 'tweetnacl'
import { describe, expect, it } from 'vitest'
import { bytesToB64 } from './b64'
import { decodePairCode, PAIR_PREFIX } from './paircode'
import { mintDeviceToken, mintJoinToken } from './api'

const pub = nacl.box.keyPair().publicKey
const ad = {
  v: 1,
  hostId: createHash('sha256').update(pub).digest('base64url').slice(0, 22),
  hostPublicKeyB64: bytesToB64(pub),
  relayEndpoint: 'wss://relay.nodeterm.dev',
  hostDeviceId: '3f2a5c1e-0000-4000-8000-000000000000'
}
const code = (o: unknown) => PAIR_PREFIX + Buffer.from(JSON.stringify(o)).toString('base64url')

describe('decodePairCode', () => {
  it('accepts a code and the raw relay.json', async () => {
    await expect(decodePairCode(code({ ...ad, label: 'Studio Mac' }))).resolves.toMatchObject({ label: 'Studio Mac', hostId: ad.hostId })
    await expect(decodePairCode(JSON.stringify(ad))).resolves.toMatchObject({ label: 'Mac' })
    const wrapped = code(ad).replace(/(.{20})/g, '$1\n')
    await expect(decodePairCode(wrapped)).resolves.toMatchObject({ hostDeviceId: ad.hostDeviceId })
  })
  it('refuses tampering', async () => {
    await expect(decodePairCode(code({ ...ad, hostId: 'x'.repeat(22) }))).rejects.toThrow(/don't match/)
    await expect(decodePairCode(code({ ...ad, relayEndpoint: 'ws://evil.example' }))).rejects.toThrow(/wss/)
    await expect(decodePairCode(code({ ...ad, hostPublicKeyB64: bytesToB64(new Uint8Array(32)) }))).rejects.toThrow(/key/)
    await expect(decodePairCode(code(ad) + '!')).rejects.toThrow(/damaged/)
    await expect(decodePairCode('hello')).rejects.toThrow(/ntpwa1/)
  })
})

describe('token API', () => {
  const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    (async () => new Response(JSON.stringify(body), { status, headers })) as unknown as typeof fetch
  const req = { deviceId: 'd', hostDeviceId: 'h', hostPublicKeyB64: 'k', label: 'l' }

  it('maps device mint replies', async () => {
    expect(await mintDeviceToken(req, reply(200, { deviceToken: 't' }))).toEqual({ ok: true, deviceToken: 't' })
    expect(await mintDeviceToken(req, reply(429, { error: 'rate_limited' }))).toMatchObject({ kind: 'rate-limited' })
    expect(await mintDeviceToken(req, reply(429, { scope: 'ip' }, { 'retry-after': '30' }))).toMatchObject({ kind: 'throttled', retryAfterMs: 30_000 })
    expect(await mintDeviceToken(req, reply(403, {}))).toMatchObject({ kind: 'refused' })
    expect(await mintDeviceToken(req, reply(502, {}))).toMatchObject({ kind: 'network' })
  })
  it('maps join replies and refuses a non-wss endpoint', async () => {
    expect(await mintJoinToken('t', reply(200, { pairingToken: 'p', relayEndpoint: 'wss://r' }))).toMatchObject({ ok: true })
    expect(await mintJoinToken('t', reply(200, { pairingToken: 'p', relayEndpoint: 'ws://r' }))).toMatchObject({ kind: 'network' })
    expect(await mintJoinToken('t', reply(401, {}))).toMatchObject({ kind: 'bad-token' })
    expect(await mintJoinToken('t', reply(403, {}))).toMatchObject({ kind: 'revoked' })
  })
})
