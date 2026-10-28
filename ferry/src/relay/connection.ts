// One live link to the paired Mac: device token → join token → relay socket → approval → live.
// iOS suspends a backgrounded PWA and its socket dies with it, so every return to the foreground
// reconnects with a fresh join token (they are single-use, ~120 s); a dropped link retries on the
// desktop's own backoff (1, 2, 4, 8, 15 s) while the app is visible.
import { hostKeyFromB64, generateDeviceKey, type DeviceKey } from './crypto'
import { mintDeviceToken, mintJoinToken } from './api'
import { connectRelaySocket, type RelaySocket, type Transport } from './socket'
import { AWAITING_APPROVAL, RelayRpc, RpcError } from './rpc'
import type { HostIdentity } from './paircode'
import * as store from './store'
import { buf } from './b64'

export type LinkState =
  | { kind: 'loading' }
  | { kind: 'unpaired' }
  | { kind: 'connecting'; step: 'token' | 'relay' | 'handshake' }
  | { kind: 'approval'; sas: string }
  | { kind: 'live'; sas: string }
  | { kind: 'offline'; reason: string; retryAt: number | null }
  | { kind: 'denied'; reason: string }

const BACKOFF_MS = [1000, 2000, 4000, 8000, 15_000]
const HANDSHAKE_TIMEOUT_MS = 15_000
const APPROVAL_POLL_MS = 1500
const APPROVAL_GIVE_UP_MS = 180_000
const DEVICE_LABEL = 'Web app'

export function webSocketTransport(url: string): Transport {
  const ws = new WebSocket(url)
  ws.binaryType = 'arraybuffer'
  const queue: (string | Uint8Array)[] = []
  let closeCb: (() => void) | null = null
  let closed = false
  const fireClose = () => {
    if (closed) return
    closed = true
    closeCb?.()
  }
  ws.onopen = () => {
    for (const m of queue.splice(0)) ws.send(typeof m === 'string' ? m : buf(m))
  }
  ws.onclose = fireClose
  ws.onerror = fireClose
  return {
    send: (d) => (ws.readyState === WebSocket.OPEN ? ws.send(typeof d === 'string' ? d : buf(d)) : queue.push(d)),
    close: () => ws.close(),
    onMessage: (cb) => {
      ws.onmessage = (e) => cb(typeof e.data === 'string' ? e.data : new Uint8Array(e.data as ArrayBuffer))
    },
    onClose: (cb) => {
      closeCb = cb
    }
  }
}

export interface ConnectionDeps {
  transport(url: string): Transport
  fetch: typeof fetch
  now(): number
}

export class Connection {
  state: LinkState = { kind: 'loading' }
  rpc: RelayRpc | null = null
  host: HostIdentity | null = null
  private listeners = new Set<(s: LinkState) => void>()
  private device: DeviceKey | null = null
  private deviceId: string | null = null
  private pairing: store.Pairing | null = null
  private socket: RelaySocket | null = null
  private attempt = 0
  private generation = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private deps: ConnectionDeps = { transport: webSocketTransport, fetch: (...a) => fetch(...a), now: () => Date.now() }) {}

  /** Development only (src/dev/demo.ts): drive the real screens from a scripted host. */
  demo(rpc: RelayRpc, host: HostIdentity): void {
    this.rpc = rpc
    this.host = host
    this.pairing = { host, approvedAt: 1, deviceToken: null }
    this.set({ kind: 'live', sas: '561 048 8895' })
  }

  /** This device was approved on the Mac at least once (its key is pinned there). */
  get approved(): boolean {
    return !!this.pairing?.approvedAt
  }

  subscribe(cb: (s: LinkState) => void): () => void {
    this.listeners.add(cb)
    cb(this.state)
    return () => this.listeners.delete(cb)
  }

  private set(s: LinkState): void {
    this.state = s
    for (const cb of this.listeners) cb(s)
  }

  async start(): Promise<void> {
    const p = await store.load()
    this.device = p.device
    this.deviceId = p.deviceId
    this.pairing = p.pairing
    this.host = p.pairing?.host ?? null
    if (!this.pairing) return this.set({ kind: 'unpaired' })
    void this.connect()
  }

  async pair(host: HostIdentity): Promise<void> {
    if (!this.device) {
      this.device = await generateDeviceKey()
      await store.save('device', this.device)
    }
    if (!this.deviceId) {
      this.deviceId = crypto.randomUUID()
      await store.save('deviceId', this.deviceId)
    }
    void store.persistStorage()
    this.pairing = { host, approvedAt: null, deviceToken: null }
    this.host = host
    await store.save('pairing', this.pairing)
    this.attempt = 0
    await this.connect()
  }

  async forget(): Promise<void> {
    this.teardown()
    this.pairing = null
    this.host = null
    await store.save('pairing', null)
    this.set({ kind: 'unpaired' })
  }

  /** The app came back to the foreground (or the user tapped Retry). */
  resume(): void {
    if (!this.pairing) return
    if (this.state.kind === 'offline' || this.state.kind === 'denied') {
      this.attempt = 0
      void this.connect()
    }
  }

  /** The app went to the background: drop the link cleanly rather than let iOS kill it mid-frame. */
  suspend(): void {
    if (this.state.kind === 'live' || this.state.kind === 'connecting') {
      this.teardown()
      this.set({ kind: 'offline', reason: 'Paused in the background.', retryAt: null })
    }
  }

  private teardown(): void {
    this.generation++
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    const s = this.socket
    this.socket = null
    this.rpc = null
    s?.close()
  }

  private scheduleRetry(reason: string, minDelay = 0): void {
    const delay = Math.max(minDelay, BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)]!)
    this.attempt++
    const retryAt = this.deps.now() + delay
    this.set({ kind: 'offline', reason, retryAt })
    const gen = this.generation
    this.retryTimer = setTimeout(() => {
      if (gen === this.generation && (typeof document === 'undefined' || document.visibilityState === 'visible')) void this.connect()
    }, delay)
  }

  private async tokens(): Promise<{ pairingToken: string; relayEndpoint: string } | null> {
    const p = this.pairing!
    for (let fresh = 0; fresh < 2; fresh++) {
      if (!p.deviceToken) {
        const minted = await mintDeviceToken(
          { deviceId: this.deviceId!, hostDeviceId: p.host.hostDeviceId, hostPublicKeyB64: p.host.hostPublicKeyB64, label: DEVICE_LABEL },
          this.deps.fetch
        )
        if (!minted.ok) {
          if (minted.kind === 'rate-limited') this.set({ kind: 'denied', reason: 'Too many pairing attempts today. Try again tomorrow.' })
          else if (minted.kind === 'refused') this.set({ kind: 'denied', reason: "The relay service wouldn't register this device for that Mac." })
          else this.scheduleRetry(minted.kind === 'throttled' ? 'The relay asked us to slow down.' : "Can't reach the relay service.", minted.kind === 'throttled' ? (minted.retryAfterMs ?? 60_000) : 0)
          return null
        }
        p.deviceToken = minted.deviceToken
        await store.save('pairing', p)
      }
      const join = await mintJoinToken(p.deviceToken, this.deps.fetch)
      if (join.ok) return join
      if (join.kind === 'bad-token' && fresh === 0) {
        p.deviceToken = null // expired: one fresh device mint, never a loop
        continue
      }
      if (join.kind === 'revoked') this.set({ kind: 'denied', reason: 'This device was removed. Pair again from the Mac.' })
      else this.scheduleRetry(join.kind === 'throttled' ? 'The relay asked us to slow down.' : "Can't reach the relay service.", join.kind === 'throttled' ? (join.retryAfterMs ?? 60_000) : 0)
      return null
    }
    return null
  }

  private async connect(): Promise<void> {
    if (!this.pairing || !this.device) return
    this.teardown()
    const gen = this.generation
    this.set({ kind: 'connecting', step: 'token' })
    const t = await this.tokens()
    if (!t || gen !== this.generation) return
    this.set({ kind: 'connecting', step: 'relay' })
    const hostPub = hostKeyFromB64(this.pairing.host.hostPublicKeyB64)
    const transport = this.deps.transport(`${t.relayEndpoint}${t.relayEndpoint.includes('?') ? '&' : '?'}token=${encodeURIComponent(t.pairingToken)}`)
    let wasApproving = false
    const handshakeTimer = setTimeout(() => {
      if (gen === this.generation && this.socket?.state() === 'handshaking') {
        this.teardown()
        this.scheduleRetry("The Mac didn't answer. Is nodeterm running with remote access on?")
      }
    }, HANDSHAKE_TIMEOUT_MS)
    const socket = connectRelaySocket({
      transport,
      device: this.device,
      hostPub,
      events: {
        onReady: () => {
          clearTimeout(handshakeTimer)
          if (gen !== this.generation) return
          this.set({ kind: 'connecting', step: 'handshake' })
          void this.awaitApproval(gen, () => (wasApproving = true))
        },
        onEnvelope: (env) => rpc.handleEnvelope(env),
        onFrame: (f) => rpc.handleFrame(f),
        onClose: () => {
          clearTimeout(handshakeTimer)
          rpc.handleClose()
          if (gen !== this.generation) return
          this.socket = null
          this.rpc = null
          if (wasApproving && this.pairing && !this.pairing.approvedAt) {
            this.set({ kind: 'denied', reason: 'The Mac closed the connection before approving it. Was it rejected?' })
          } else {
            this.scheduleRetry('The connection dropped.')
          }
        }
      }
    })
    const rpc = new RelayRpc(socket)
    this.socket = socket
    this.rpc = rpc
  }

  private async awaitApproval(gen: number, approving: () => void): Promise<void> {
    const started = this.deps.now()
    for (;;) {
      if (gen !== this.generation || !this.rpc) return
      try {
        await this.rpc.request('host.info', {}, 10_000)
        break
      } catch (e) {
        if (!(e instanceof RpcError) || e.message !== AWAITING_APPROVAL) {
          // An older desktop without host.info still answers it, as "Unknown method": that IS approval.
          if (e instanceof RpcError && e.code === 'refused') break
          return // disconnected / timeout: onClose decides
        }
      }
      approving()
      this.set({ kind: 'approval', sas: this.socket?.sas() ?? '' })
      if (this.deps.now() - started > APPROVAL_GIVE_UP_MS) {
        this.teardown()
        this.set({ kind: 'denied', reason: 'Nobody approved it on the Mac in time.' })
        return
      }
      await new Promise((r) => setTimeout(r, APPROVAL_POLL_MS))
    }
    if (gen !== this.generation) return
    this.attempt = 0
    if (this.pairing && !this.pairing.approvedAt) {
      this.pairing.approvedAt = this.deps.now()
      await store.save('pairing', this.pairing)
    }
    this.set({ kind: 'live', sas: this.socket?.sas() ?? '' })
  }
}
