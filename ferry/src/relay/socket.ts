// The CLIENT side of the relay's E2EE handshake and sealed framing (nodeterm relay-socket.ts):
//   client → host  text  {"type":"e2ee_hello","publicKeyB64","nonceB64"}
//   host → client  text  {"type":"e2ee_ready","nonceB64"}           → sessionKey
//   client → host  box   [0x01]{"type":"e2ee_auth"}
//   host → client  box   [0x01]{"type":"e2ee_authenticated"}        → ready
// Security rules (nodeterm docs/ios-protocol-migration.md §2.4, §7) enforced here:
//   - after ready, a plaintext control frame is ignored: no re-key, no close;
//   - a box carrying our own role is a relay reflection and is dropped;
//   - inbound seq must strictly increase, or the box is dropped (replay / reorder);
//   - the host key is pinned up front; a low-order key never dials.
// Async steps (WebCrypto) run through one queue, so inbound messages are handled strictly in order.
import { bytesToB64, canonicalB64ToBytes } from './b64'
import { deriveBaseKey, deriveSessionKey, randomNonce, sasFromBaseKey, HANDSHAKE_NONCE_BYTES, type DeviceKey } from './crypto'
import { OP, ROLE_CLIENT, ROLE_HOST, TAG_FRAME, TAG_RPC, decodeFrame, encodeFrame, open, readHeader, seal, withHeader, type Frame } from './wire'

/** A duplex byte/text pipe. Text frames carry handshake control, binary frames carry boxes. */
export interface Transport {
  send(data: string | Uint8Array): void
  close(): void
  onMessage(cb: (data: string | Uint8Array) => void): void
  /** Fires exactly once, on a close or an error. */
  onClose(cb: () => void): void
}

export interface RelaySocketEvents {
  /** The handshake completed. The SAS is available from now on. */
  onReady(): void
  /** A JSON envelope from the host (`res` / `req` / `notify`); keepalives are swallowed. */
  onEnvelope(env: Record<string, unknown>): void
  onFrame(frame: Frame): void
  onClose(): void
}

export interface RelaySocket {
  readonly state: () => 'handshaking' | 'ready' | 'closed'
  sas(): string | null
  sendEnvelope(env: Record<string, unknown>): boolean
  sendFrame(op: number, streamId: number, seq: number, payload: Uint8Array): boolean
  close(): void
}

export const KEEPALIVE_MS = 25_000
const enc = new TextEncoder()
const dec = new TextDecoder()

export function connectRelaySocket(opts: {
  transport: Transport
  device: DeviceKey
  hostPub: Uint8Array
  events: RelaySocketEvents
}): RelaySocket {
  const { transport, events } = opts
  let state: 'handshaking' | 'ready' | 'closed' = 'handshaking'
  let base: Uint8Array | null = null
  let sessionKey: Uint8Array | null = null
  const ourNonce = randomNonce()
  let sendSeq = 0
  let recvSeq = -1
  let keepalive: ReturnType<typeof setInterval> | null = null
  let queue: Promise<void> = Promise.resolve()

  const enqueue = (fn: () => void | Promise<void>): void => {
    queue = queue.then(fn).catch(() => close())
  }

  function sendSealed(tag: number, body: Uint8Array): boolean {
    if (!sessionKey || state === 'closed') return false
    transport.send(seal(withHeader(ROLE_CLIENT, sendSeq++, tag, body), sessionKey))
    return true
  }

  function close(): void {
    if (state === 'closed') return
    state = 'closed'
    if (keepalive) clearInterval(keepalive)
    keepalive = null
    try {
      transport.close()
    } catch {
      /* already gone */
    }
    events.onClose()
  }

  async function onText(raw: string): Promise<void> {
    if (state !== 'handshaking' || sessionKey) return // frozen after the first ready: never re-key
    let msg: { type?: unknown; nonceB64?: unknown }
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    if (msg.type !== 'e2ee_ready' || !base) return
    let hostNonce: Uint8Array
    try {
      hostNonce = canonicalB64ToBytes(msg.nonceB64, HANDSHAKE_NONCE_BYTES, 'nonce')
    } catch {
      return
    }
    // salt = hostNonce ‖ clientNonce, in both roles.
    sessionKey = await deriveSessionKey(base, hostNonce, ourNonce)
    sendSealed(TAG_RPC, enc.encode(JSON.stringify({ type: 'e2ee_auth' })))
  }

  function onBinary(bytes: Uint8Array): void {
    if (!sessionKey || state === 'closed') return
    const plain = open(bytes, sessionKey)
    const h = plain && readHeader(plain)
    if (!h || h.role !== ROLE_HOST || h.seq <= recvSeq) return // bad MAC, reflection, replay
    recvSeq = h.seq
    if (state === 'handshaking') {
      if (h.tag !== TAG_RPC) return
      let msg: { type?: unknown }
      try {
        msg = JSON.parse(dec.decode(h.body))
      } catch {
        return
      }
      if (msg.type !== 'e2ee_authenticated') return
      state = 'ready'
      keepalive = setInterval(() => sendSealed(TAG_RPC, enc.encode('{"kind":"keepalive"}')), KEEPALIVE_MS)
      events.onReady()
      return
    }
    if (h.tag === TAG_FRAME) {
      const frame = decodeFrame(h.body)
      if (frame) events.onFrame(frame)
      return
    }
    if (h.tag !== TAG_RPC) return
    let env: Record<string, unknown>
    try {
      env = JSON.parse(dec.decode(h.body))
    } catch {
      return
    }
    if (!env || typeof env !== 'object' || env.kind === 'keepalive') return
    events.onEnvelope(env)
  }

  transport.onMessage((data) => enqueue(() => (typeof data === 'string' ? onText(data) : onBinary(data))))
  transport.onClose(() => enqueue(close))

  // Derive the identity key from the PINNED host key before saying anything: a low-order key throws
  // here and nothing is sent.
  enqueue(async () => {
    base = await deriveBaseKey(opts.device, opts.hostPub)
    transport.send(
      JSON.stringify({ type: 'e2ee_hello', publicKeyB64: bytesToB64(opts.device.publicKey), nonceB64: bytesToB64(ourNonce) })
    )
  })

  return {
    state: () => state,
    sas: () => (state === 'ready' && base ? sasFromBaseKey(base) : null),
    sendEnvelope: (env) => state === 'ready' && sendSealed(TAG_RPC, enc.encode(JSON.stringify(env))),
    sendFrame: (op, streamId, seq, payload) => state === 'ready' && sendSealed(TAG_FRAME, encodeFrame(op, streamId, seq, payload)),
    close
  }
}

export { OP }
