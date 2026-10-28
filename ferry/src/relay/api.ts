// The two token legs (nodeterm src/core/relay/join-token.ts), through this app's own origin:
// `/api/relay/device` and `/api/relay/join` are proxied by the add-on (server/server.mjs) or the Vite
// dev server to api.nodeterm.dev/v1/relay/*, because that API sends no CORS headers.
//   device: {deviceId, hostDeviceId, hostPublicKeyB64, label} → {deviceToken}   (~90 days; damped daily)
//   join:   {deviceToken}                                     → {pairingToken, relayEndpoint} (single use, ~120 s)

export const API_BASE = '/api/relay'
const TIMEOUT_MS = 8000

export type DeviceMint =
  | { ok: true; deviceToken: string }
  | { ok: false; kind: 'network' | 'refused' | 'rate-limited' | 'throttled'; retryAfterMs?: number }
export type JoinMint =
  | { ok: true; pairingToken: string; relayEndpoint: string }
  | { ok: false; kind: 'bad-token' | 'revoked' | 'network' | 'throttled'; retryAfterMs?: number }

interface Reply {
  status: number
  body: unknown
  retryAfterMs?: number
}

async function post(path: string, body: unknown, f: typeof fetch): Promise<Reply | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await f(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      credentials: 'omit',
      cache: 'no-store'
    })
    const parsed: unknown = await res.json().catch(() => null)
    const ra = res.headers.get('retry-after')
    return { status: res.status, body: parsed, ...(ra && /^\d+$/.test(ra) ? { retryAfterMs: Number(ra) * 1000 } : {}) }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const ipScoped = (b: unknown) => !!b && typeof b === 'object' && (b as { scope?: unknown }).scope === 'ip'

/** A relay endpoint we will dial: `wss:` only (nodeterm join-code.ts allowedEndpoint, minus loopback). */
export function allowedEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string') return false
  try {
    return new URL(endpoint).protocol === 'wss:'
  } catch {
    return false
  }
}

export async function mintDeviceToken(
  req: { deviceId: string; hostDeviceId: string; hostPublicKeyB64: string; label: string },
  f: typeof fetch = fetch
): Promise<DeviceMint> {
  const res = await post('/device', req, f)
  if (!res) return { ok: false, kind: 'network' }
  if (res.status === 429)
    return ipScoped(res.body)
      ? { ok: false, kind: 'throttled', ...(res.retryAfterMs ? { retryAfterMs: res.retryAfterMs } : {}) }
      : { ok: false, kind: 'rate-limited' }
  if (res.status >= 500) return { ok: false, kind: 'network' }
  const token = (res.body as { deviceToken?: unknown } | null)?.deviceToken
  if (res.status >= 400 || typeof token !== 'string' || !token) return { ok: false, kind: 'refused' }
  return { ok: true, deviceToken: token }
}

export async function mintJoinToken(deviceToken: string, f: typeof fetch = fetch): Promise<JoinMint> {
  const res = await post('/join', { deviceToken }, f)
  if (!res) return { ok: false, kind: 'network' }
  if (res.status === 401) return { ok: false, kind: 'bad-token' }
  if (res.status === 403) return { ok: false, kind: 'revoked' }
  if (res.status === 429) return { ok: false, kind: 'throttled', ...(res.retryAfterMs ? { retryAfterMs: res.retryAfterMs } : {}) }
  const j = res.body as { pairingToken?: unknown; relayEndpoint?: unknown } | null
  if (res.status >= 400 || typeof j?.pairingToken !== 'string' || !j.pairingToken || !allowedEndpoint(j.relayEndpoint)) {
    return { ok: false, kind: 'network' }
  }
  return { ok: true, pairingToken: j.pairingToken, relayEndpoint: j.relayEndpoint }
}
