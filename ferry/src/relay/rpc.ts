// Request/response and terminal streams over a ready RelaySocket (nodeterm host-service.ts is the
// server). Requests are `{kind:'req', id, method, params}`; replies `{kind:'res', id, ok, body}` where a
// refusal's body is `{message, reason?}`. Terminal output arrives as OP frames keyed by streamId.
import { OP, readSize, sizePayload, type Frame } from './wire'
import type { RelaySocket } from './socket'

export class RpcError extends Error {
  constructor(
    message: string,
    readonly code: 'refused' | 'timeout' | 'disconnected',
    readonly reason?: string
  ) {
    super(message)
  }
}

/** The exact message an unapproved session gets for every request (host-service connectHostSession). */
export const AWAITING_APPROVAL = 'Awaiting host approval.'

export interface StreamHandlers {
  /** The attach's first paint: the screen as the host captured it (raw, LF line endings). */
  onSnapshot(text: string): void
  onOutput(data: string): void
  onResized?(size: { cols: number; rows: number }): void
  onExit(code: number): void
}

interface Pending {
  resolve(body: unknown): void
  reject(err: Error): void
  timer: ReturnType<typeof setTimeout>
}

interface StreamState {
  handlers: StreamHandlers | null
  early: Frame[]
  snapshot: Uint8Array[] | null
  outSeq: number
  decoder: TextDecoder
}

export class RelayRpc {
  private nextId = 1
  private pending = new Map<string, Pending>()
  private streams = new Map<number, StreamState>()
  private notifyHandlers = new Map<string, Set<(params: unknown) => void>>()
  private closed = false

  constructor(private socket: RelaySocket) {}

  /** Wire this to RelaySocketEvents.onEnvelope. */
  handleEnvelope(env: Record<string, unknown>): void {
    if (env.kind === 'res' && typeof env.id === 'string') {
      const p = this.pending.get(env.id)
      if (!p) return
      this.pending.delete(env.id)
      clearTimeout(p.timer)
      if (env.ok === true) p.resolve(env.body)
      else {
        const body = (env.body ?? {}) as { message?: unknown; reason?: unknown }
        p.reject(
          new RpcError(
            typeof body.message === 'string' ? body.message : 'The Mac refused the request.',
            'refused',
            typeof body.reason === 'string' ? body.reason : undefined
          )
        )
      }
      return
    }
    if (env.kind === 'notify' && typeof env.method === 'string') {
      for (const cb of this.notifyHandlers.get(env.method) ?? []) cb(env.params)
    }
  }

  /** Wire this to RelaySocketEvents.onFrame. Frames for a stream whose attach reply has not been
   *  handled yet are held (the host answers, then streams at once), bounded. */
  handleFrame(frame: Frame): void {
    let s = this.streams.get(frame.streamId)
    if (!s) {
      s = this.newStream()
      this.streams.set(frame.streamId, s)
    }
    if (!s.handlers) {
      if (s.early.length < 512) s.early.push(frame)
      return
    }
    this.dispatch(frame.streamId, s, frame)
  }

  /** Wire this to RelaySocketEvents.onClose. */
  handleClose(): void {
    this.closed = true
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(new RpcError('The connection to the Mac dropped.', 'disconnected'))
    }
    this.pending.clear()
    for (const [, s] of this.streams) s.handlers?.onExit(-1)
    this.streams.clear()
  }

  request<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<T> {
    if (this.closed) return Promise.reject(new RpcError('Not connected to the Mac.', 'disconnected'))
    const id = String(this.nextId++)
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new RpcError(`${method} timed out.`, 'timeout'))
      }, timeoutMs)
      this.pending.set(id, { resolve: resolve as (b: unknown) => void, reject, timer })
      if (!this.socket.sendEnvelope({ kind: 'req', id, method, params })) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(new RpcError('Not connected to the Mac.', 'disconnected'))
      }
    })
  }

  notify(method: string, params?: unknown): boolean {
    return this.socket.sendEnvelope({ kind: 'notify', method, params })
  }

  on(method: string, cb: (params: unknown) => void): () => void {
    let set = this.notifyHandlers.get(method)
    if (!set) this.notifyHandlers.set(method, (set = new Set()))
    set.add(cb)
    return () => set!.delete(cb)
  }

  /** Bind handlers to a stream the host just named (`pty.attach` reply), replaying held frames. */
  bindStream(streamId: number, handlers: StreamHandlers): void {
    let s = this.streams.get(streamId)
    if (!s) this.streams.set(streamId, (s = this.newStream()))
    s.handlers = handlers
    for (const f of s.early.splice(0)) this.dispatch(streamId, s, f)
  }

  unbindStream(streamId: number): void {
    this.streams.delete(streamId)
  }

  input(streamId: number, data: string): boolean {
    const s = this.streams.get(streamId)
    return !!s && this.socket.sendFrame(OP.Input, streamId, s.outSeq++, new TextEncoder().encode(data))
  }

  resize(streamId: number, cols: number, rows: number): boolean {
    const s = this.streams.get(streamId)
    return !!s && this.socket.sendFrame(OP.Resize, streamId, s.outSeq++, sizePayload(cols, rows))
  }

  private newStream(): StreamState {
    return { handlers: null, early: [], snapshot: null, outSeq: 0, decoder: new TextDecoder() }
  }

  private dispatch(streamId: number, s: StreamState, f: Frame): void {
    const h = s.handlers!
    switch (f.op) {
      case OP.SnapshotStart:
        s.snapshot = [] // a new Start discards a partial snapshot
        return
      case OP.SnapshotChunk:
        s.snapshot?.push(f.payload)
        return
      case OP.SnapshotEnd: {
        const parts = s.snapshot ?? []
        s.snapshot = null
        const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
        let o = 0
        for (const p of parts) (all.set(p, o), (o += p.length))
        h.onSnapshot(new TextDecoder().decode(all))
        return
      }
      case OP.Output:
        h.onOutput(s.decoder.decode(f.payload, { stream: true }))
        return
      case OP.Resized: {
        const size = readSize(f.payload)
        if (size) h.onResized?.(size)
        return
      }
      case OP.Error: {
        let code = 1
        try {
          const v = JSON.parse(new TextDecoder().decode(f.payload)) as { exitCode?: unknown }
          if (typeof v.exitCode === 'number') code = v.exitCode
        } catch {
          /* keep 1 */
        }
        this.streams.delete(streamId)
        h.onExit(code)
      }
    }
  }
}
