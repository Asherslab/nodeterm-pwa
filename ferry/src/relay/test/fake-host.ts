// A host-role relay peer written straight from nodeterm's relay-socket.ts host branch, using the same
// primitives the desktop does (tweetnacl box.before, Node's hkdfSync), so the browser client is tested
// against an independent implementation rather than against itself.
import { hkdfSync } from 'node:crypto'
import nacl from 'tweetnacl'
import type { Transport } from '../socket'

/** Return this from `handle` to leave a request unanswered. */
export const NO_REPLY = Symbol('no-reply')
const enc = new TextEncoder()
const dec = new TextDecoder()

export interface FakeHost {
  /** The client's end of the pipe. */
  transport: Transport
  hostPublicKey: Uint8Array
  /** Every text frame the client sent (handshake controls). */
  textIn: string[]
  /** Decoded envelopes / frames the client sent after ready. */
  envelopes: Record<string, unknown>[]
  frames: { op: number; streamId: number; payload: Uint8Array }[]
  ready: () => boolean
  base: () => Uint8Array | null
  /** Answer requests: return a body, or throw {message} to refuse. */
  handle: (method: string, params: Record<string, unknown>) => unknown
  sendEnvelope(env: Record<string, unknown>): void
  sendFrame(op: number, streamId: number, payload: Uint8Array): void
  /** Adversarial seams. */
  sendText(s: string): void
  sendSealedRaw(role: number, seq: number, tag: number, body: Uint8Array): void
  close(): void
}

export function fakeHost(hostSecret = nacl.randomBytes(32)): FakeHost {
  const hostKeys = nacl.box.keyPair.fromSecretKey(hostSecret)
  let toClient: ((d: string | Uint8Array) => void) | null = null
  let clientClose: (() => void) | null = null
  let base: Uint8Array | null = null
  let session: Uint8Array | null = null
  let ready = false
  let sendSeq = 0
  let recvSeq = -1
  let frameSeq = 0
  const hostNonce = nacl.randomBytes(16)
  const deliver = (d: string | Uint8Array) => queueMicrotask(() => toClient?.(d))

  function sealed(role: number, seq: number, tag: number, body: Uint8Array): Uint8Array {
    const plain = new Uint8Array(10 + body.length)
    const v = new DataView(plain.buffer)
    plain[0] = role
    v.setUint32(1, Math.floor(seq / 0x100000000), true)
    v.setUint32(5, seq >>> 0, true)
    plain[9] = tag
    plain.set(body, 10)
    const nonce = nacl.randomBytes(24)
    const box = nacl.box.after(plain, nonce, session!)
    const out = new Uint8Array(24 + box.length)
    out.set(nonce)
    out.set(box, 24)
    return out
  }
  const send = (tag: number, body: Uint8Array) => deliver(sealed(1, sendSeq++, tag, body))

  const host: FakeHost = {
    hostPublicKey: hostKeys.publicKey,
    textIn: [],
    envelopes: [],
    frames: [],
    ready: () => ready,
    base: () => base,
    handle: () => ({}),
    transport: {
      send(data) {
        if (typeof data === 'string') {
          host.textIn.push(data)
          const m = JSON.parse(data)
          if (m.type === 'e2ee_hello' && !ready) {
            const clientPub = Uint8Array.from(Buffer.from(m.publicKeyB64, 'base64'))
            const clientNonce = Uint8Array.from(Buffer.from(m.nonceB64, 'base64'))
            base = nacl.box.before(clientPub, hostSecret)
            const salt = new Uint8Array(32)
            salt.set(hostNonce)
            salt.set(clientNonce, 16)
            session = new Uint8Array(hkdfSync('sha256', base, salt, enc.encode('nodeterm-relay-session-v2'), 32))
            deliver(JSON.stringify({ type: 'e2ee_ready', nonceB64: Buffer.from(hostNonce).toString('base64') }))
          }
          return
        }
        if (!session) return
        const plain = nacl.box.open.after(data.subarray(24), data.subarray(0, 24), session)
        if (!plain || plain[0] !== 2) return
        const v = new DataView(plain.buffer, plain.byteOffset, plain.byteLength)
        const seq = v.getUint32(1, true) * 0x100000000 + v.getUint32(5, true)
        if (seq <= recvSeq) return
        recvSeq = seq
        const tag = plain[9]
        const body = plain.subarray(10)
        if (tag === 1) {
          const env = JSON.parse(dec.decode(body))
          if (!ready) {
            if (env.type === 'e2ee_auth') {
              send(1, enc.encode(JSON.stringify({ type: 'e2ee_authenticated' })))
              ready = true
            }
            return
          }
          if (env.kind === 'keepalive') return
          host.envelopes.push(env)
          if (env.kind === 'req') {
            let res: Record<string, unknown>
            try {
              const body = host.handle(env.method, env.params ?? {})
              if (body === NO_REPLY) return
              res = { kind: 'res', id: env.id, ok: true, body: body ?? {} }
            } catch (e) {
              res = { kind: 'res', id: env.id, ok: false, body: e }
            }
            send(1, enc.encode(JSON.stringify(res)))
          }
        } else if (tag === 2) {
          const fv = new DataView(body.buffer, body.byteOffset, body.byteLength)
          host.frames.push({ op: body[2]!, streamId: fv.getUint32(4, true), payload: body.slice(16) })
        }
      },
      close() {
        queueMicrotask(() => clientClose?.())
      },
      onMessage(cb) {
        toClient = cb
      },
      onClose(cb) {
        clientClose = cb
      }
    },
    sendEnvelope: (env) => send(1, enc.encode(JSON.stringify(env))),
    sendFrame(op, streamId, payload) {
      const f = new Uint8Array(16 + payload.length)
      const v = new DataView(f.buffer)
      f[0] = 0x74
      f[1] = 1
      f[2] = op
      v.setUint32(4, streamId, true)
      v.setUint32(12, frameSeq++, true)
      f.set(payload, 16)
      send(2, f)
    },
    sendText: (s) => deliver(s),
    sendSealedRaw: (role, seq, tag, body) => deliver(sealed(role, seq, tag, body)),
    close: () => queueMicrotask(() => clientClose?.())
  }
  return host
}
