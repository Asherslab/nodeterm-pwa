import 'fake-indexeddb/auto'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { bytesToB64 } from './b64'
import { Connection, type LinkState } from './connection'
import { AWAITING_APPROVAL } from './rpc'
import { load } from './store'
import { fakeHost } from './test/fake-host'

describe('Connection', () => {
  it('pairs: tokens → handshake → waits for approval with the SAS → live, and persists the pin', async () => {
    const host = fakeHost()
    let approved = false
    host.handle = (m) => {
      if (!approved) throw { message: AWAITING_APPROVAL }
      return m === 'host.info' ? { platform: 'darwin', verbs: [] } : {}
    }
    const calls: string[] = []
    const fetchFake = (async (url: string, init: RequestInit) => {
      calls.push(`${url} ${init.body}`)
      const body = url.endsWith('/device') ? { deviceToken: 'dev-tok' } : { pairingToken: 'pair-tok', relayEndpoint: 'wss://relay.example' }
      return new Response(JSON.stringify(body), { status: 200 })
    }) as unknown as typeof fetch
    const urls: string[] = []
    const conn = new Connection({ transport: (u) => (urls.push(u), host.transport), fetch: fetchFake, now: () => Date.now() })
    const states: LinkState[] = []
    conn.subscribe((s) => states.push(s))

    const pub = host.hostPublicKey
    await conn.pair({
      hostId: createHash('sha256').update(pub).digest('base64url').slice(0, 22),
      hostPublicKeyB64: bytesToB64(pub),
      relayEndpoint: 'wss://relay.example',
      hostDeviceId: 'host-dev',
      label: 'Studio Mac'
    })
    await waitFor(() => conn.state.kind === 'approval')
    const sas = (conn.state as { sas: string }).sas
    expect(sas).toMatch(/^\d{3} \d{3} \d{4}$/)
    expect(calls[0]).toMatch(/\/api\/relay\/device .*"hostDeviceId":"host-dev"/)
    expect(calls[1]).toBe('/api/relay/join {"deviceToken":"dev-tok"}')
    expect(urls[0]).toBe('wss://relay.example?token=pair-tok')

    approved = true // the human pressed Approve on the Mac
    await waitFor(() => conn.state.kind === 'live', 4000)
    expect(states.map((s) => s.kind)).toEqual(expect.arrayContaining(['connecting', 'approval', 'live']))
    const persisted = await load()
    expect(persisted.pairing?.approvedAt).toBeGreaterThan(0)
    expect(persisted.pairing?.deviceToken).toBe('dev-tok')
    expect(persisted.device?.privateKey.extractable).toBe(false)
  }, 10_000)
})

async function waitFor(pred: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms
  while (!pred()) {
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 10))
  }
}
