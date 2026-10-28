import nacl from 'tweetnacl'
import { describe, expect, it, vi } from 'vitest'
import { generateDeviceKey, sasFromBaseKey } from './crypto'
import { connectRelaySocket } from './socket'
import { AWAITING_APPROVAL, RelayRpc, RpcError } from './rpc'
import { OP, sizePayload } from './wire'
import { NO_REPLY, fakeHost } from './test/fake-host'

const flush = async (n = 30) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0))
}

async function connected() {
  const host = fakeHost()
  const device = await generateDeviceKey()
  const events = { onReady: vi.fn(), onEnvelope: vi.fn(), onFrame: vi.fn(), onClose: vi.fn() }
  const socket = connectRelaySocket({ transport: host.transport, device, hostPub: host.hostPublicKey, events })
  const rpc = new RelayRpc(socket)
  events.onEnvelope.mockImplementation((e) => rpc.handleEnvelope(e))
  events.onFrame.mockImplementation((f) => rpc.handleFrame(f))
  events.onClose.mockImplementation(() => rpc.handleClose())
  await flush()
  return { host, device, events, socket, rpc }
}

describe('handshake against an independent host', () => {
  it('completes, and both ends show the same SAS', async () => {
    const { host, events, socket } = await connected()
    expect(JSON.parse(host.textIn[0]!)).toMatchObject({ type: 'e2ee_hello' })
    expect(host.ready()).toBe(true)
    expect(events.onReady).toHaveBeenCalledOnce()
    expect(socket.sas()).toBe(sasFromBaseKey(host.base()!))
    expect(socket.sas()).toMatch(/^\d{3} \d{3} \d{4}$/)
  })

  it('never dials a low-order host key', async () => {
    const host = fakeHost()
    const onClose = vi.fn()
    connectRelaySocket({
      transport: host.transport,
      device: await generateDeviceKey(),
      hostPub: new Uint8Array(32),
      events: { onReady: vi.fn(), onEnvelope: vi.fn(), onFrame: vi.fn(), onClose }
    })
    await flush()
    expect(host.textIn).toHaveLength(0)
    expect(onClose).toHaveBeenCalled()
  })

  it('ignores a plaintext e2ee_ready after ready (no re-key)', async () => {
    const { host, socket, rpc } = await connected()
    const before = socket.sas()
    host.sendText(JSON.stringify({ type: 'e2ee_ready', nonceB64: Buffer.from(nacl.randomBytes(16)).toString('base64') }))
    await flush()
    expect(socket.sas()).toBe(before)
    host.handle = () => ({ ok: 1 })
    await expect(rpc.request('host.info')).resolves.toEqual({ ok: 1 })
  })

  it('drops reflected (own-role) and replayed boxes', async () => {
    const { host, events } = await connected()
    const body = new TextEncoder().encode(JSON.stringify({ kind: 'notify', method: 'canvas:state', params: 1 }))
    host.sendSealedRaw(2, 999, 0x01, body) // our own role: a relay reflection
    host.sendSealedRaw(1, 0, 0x01, body) // seq 0 was the e2ee_authenticated box: a replay
    await flush()
    expect(events.onEnvelope).not.toHaveBeenCalled()
    host.sendSealedRaw(1, 5, 0x01, body)
    await flush()
    expect(events.onEnvelope).toHaveBeenCalledOnce()
  })
})

describe('rpc', () => {
  it('surfaces a refusal with its message, e.g. awaiting approval', async () => {
    const { host, rpc } = await connected()
    host.handle = () => {
      throw { message: AWAITING_APPROVAL }
    }
    const err = await rpc.request('host.info').catch((e) => e)
    expect(err).toBeInstanceOf(RpcError)
    expect(err.message).toBe(AWAITING_APPROVAL)
    expect(host.envelopes[0]).toMatchObject({ kind: 'req', method: 'host.info' })
  })

  it('fails in-flight requests when the socket closes', async () => {
    const { host, rpc } = await connected()
    host.handle = () => NO_REPLY
    const p = rpc.request('chat.page', { nodeId: 'n1' })
    host.close()
    await expect(p).rejects.toMatchObject({ code: 'disconnected' })
  })

  it('reassembles a snapshot, streams output, and sends input + resize frames', async () => {
    const { host, rpc } = await connected()
    host.handle = (m) => (m === 'pty.attach' ? { streamId: 3, fresh: false } : {})
    const got = { snap: '', out: '', exit: null as number | null }
    const reply = await rpc.request<{ streamId: number }>('pty.attach', { nodeId: 'n1', cols: 80, rows: 24 })
    // Frames may arrive before the caller binds: they are held.
    host.sendFrame(OP.SnapshotStart, 3, new Uint8Array())
    host.sendFrame(OP.SnapshotChunk, 3, new TextEncoder().encode('hello '))
    host.sendFrame(OP.SnapshotChunk, 3, new TextEncoder().encode('wörld'))
    host.sendFrame(OP.SnapshotEnd, 3, new Uint8Array())
    host.sendFrame(OP.Output, 3, new TextEncoder().encode('$ '))
    await flush()
    rpc.bindStream(reply.streamId, {
      onSnapshot: (t) => (got.snap = t),
      onOutput: (d) => (got.out += d),
      onExit: (c) => (got.exit = c)
    })
    expect(got).toEqual({ snap: 'hello wörld', out: '$ ', exit: null })
    expect(rpc.input(3, 'ls\r')).toBe(true)
    expect(rpc.resize(3, 100, 30)).toBe(true)
    await flush()
    expect(host.frames[0]).toMatchObject({ op: OP.Input, streamId: 3 })
    expect(new TextDecoder().decode(host.frames[0]!.payload)).toBe('ls\r')
    expect(host.frames[1]).toMatchObject({ op: OP.Resize, streamId: 3, payload: sizePayload(100, 30) })
    host.sendFrame(OP.Error, 3, new TextEncoder().encode('{"exitCode":0}'))
    await flush()
    expect(got.exit).toBe(0)
  })
})
