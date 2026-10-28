// The add-on's whole backend: serve the built PWA, and proxy exactly two token routes to nodeterm's
// API (which sends no CORS headers, so a page cannot read its replies; docs/protocol.md B1).
//
// What this process can do, by construction:
//   - read files under DIST, and nothing else on disk;
//   - make HTTPS requests to ONE fixed host (api.nodeterm.dev), for two fixed paths, with bodies it
//     rebuilt itself from an allowlist of fields. No URL, header, cookie or query string from a client
//     is ever forwarded. It is not an open proxy.
// It holds no secret, writes nothing, logs no request bodies and no tokens, and has no Home Assistant
// or Supervisor credentials (config.yaml grants none). Relay traffic never passes through it: the
// phone talks to wss://relay.nodeterm.dev directly, end-to-end encrypted.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'

const PORT = Number(process.env.PORT ?? 8099)
const DIST = normalize(process.env.DIST ?? new URL('../dist', import.meta.url).pathname)
const UPSTREAM = 'https://api.nodeterm.dev'
const MAX_BODY = 2048
const MAX_REPLY = 8192
const UPSTREAM_TIMEOUT_MS = 8000
const RATE = { windowMs: 60_000, max: 20 }

// Each route: the upstream path and the exact fields it may carry, with their maximum lengths.
const ROUTES = {
  '/api/relay/device': { path: '/v1/relay/device', fields: { deviceId: 128, hostDeviceId: 128, hostPublicKeyB64: 64, label: 64 } },
  '/api/relay/join': { path: '/v1/relay/join', fields: { deviceToken: 4096 } }
}
ROUTES['/api/relay/join'].maxBody = 4400

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
}

const SECURITY_HEADERS = {
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' wss://relay.nodeterm.dev",
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'"
  ].join('; '),
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'camera=(self), microphone=(), geolocation=(), payment=()'
}

// ---- rate limit (per client address, in memory) ---------------------------------------------
const hits = new Map()
function clientAddress(req) {
  // Behind Nginx Proxy Manager every request comes from the proxy; X-Forwarded-For's first hop is the
  // phone. Only used to share out the rate limit, never for access decisions.
  const xff = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
  return xff || req.socket.remoteAddress || 'unknown'
}
function limited(addr, now = Date.now()) {
  const h = hits.get(addr)
  if (!h || now - h.start > RATE.windowMs) {
    hits.set(addr, { start: now, n: 1 })
    if (hits.size > 10_000) for (const [k, v] of hits) if (now - v.start > RATE.windowMs) hits.delete(k)
    return false
  }
  return ++h.n > RATE.max
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'cache-control': 'no-store', ...headers })
  res.end(body)
}
const json = (res, status, obj, headers) => send(res, status, JSON.stringify(obj), { 'content-type': 'application/json', ...headers })

function readBody(req, limit) {
  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size <= limit) chunks.push(c)
    })
    // An oversized body is drained (not kept) so the 413 still reaches the client.
    req.on('end', () => resolve(size > limit ? null : Buffer.concat(chunks).toString('utf8')))
    req.on('error', () => resolve(null))
  })
}

/** Rebuild the body from the allowlist. Every field must be present, a non-empty string, and short. */
export function cleanBody(raw, fields) {
  let o
  try {
    o = JSON.parse(raw)
  } catch {
    return null
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null
  if (Object.keys(o).some((k) => !Object.hasOwn(fields, k))) return null
  const out = {}
  for (const [k, max] of Object.entries(fields)) {
    const v = o[k]
    // eslint-disable-next-line no-control-regex
    if (typeof v !== 'string' || v.length === 0 || v.length > max || /[\u0000-\u001f\u007f]/.test(v)) return null
    out[k] = v
  }
  return out
}

async function proxy(req, res, route) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' }, { allow: 'POST' })
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) return json(res, 415, { error: 'json_only' })
  if (limited(clientAddress(req))) return json(res, 429, { error: 'rate_limited', scope: 'ip' }, { 'retry-after': '60' })
  const raw = await readBody(req, route.maxBody ?? MAX_BODY)
  if (raw === null) return json(res, 413, { error: 'too_large' })
  const body = cleanBody(raw, route.fields)
  if (!body) return json(res, 400, { error: 'bad_request' })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const up = await fetch(UPSTREAM + route.path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: ctrl.signal
    })
    const text = await up.text()
    if (text.length > MAX_REPLY) return json(res, 502, { error: 'upstream_reply_too_large' })
    let parsed
    try {
      parsed = text ? JSON.parse(text) : {}
    } catch {
      return json(res, 502, { error: 'upstream_not_json' })
    }
    const ra = up.headers.get('retry-after')
    return json(res, up.status, parsed, ra && /^\d{1,5}$/.test(ra) ? { 'retry-after': ra } : {})
  } catch {
    return json(res, 502, { error: 'upstream_unreachable' })
  } finally {
    clearTimeout(timer)
  }
}

/** Resolve a URL path inside DIST, or null. No dotfiles, no traversal, no directories. */
export function resolveStatic(urlPath, dist = DIST) {
  let p
  try {
    p = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  if (p.includes('\0') || p.split('/').some((seg) => seg.startsWith('.'))) return null
  const full = normalize(join(dist, p))
  return full === dist || full.startsWith(dist + sep) ? full : null
}

async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, '', { allow: 'GET, HEAD' })
  let file = resolveStatic(pathname === '/' ? '/index.html' : pathname)
  // A refused path (dotfile, traversal, bad encoding) is a flat 404, never the shell fallback.
  if (!file) return send(res, 404, 'Not found', { 'content-type': 'text/plain' })
  let info = await stat(file).catch(() => null)
  // Client-side routes fall back to the app shell; a missing asset is a real 404.
  if ((!info || !info.isFile()) && !extname(pathname)) {
    file = join(DIST, 'index.html')
    info = await stat(file).catch(() => null)
  }
  if (!file || !info || !info.isFile()) return send(res, 404, 'Not found', { 'content-type': 'text/plain' })
  const immutable = pathname.startsWith('/assets/')
  const headers = {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...(pathname === '/sw.js' ? { 'service-worker-allowed': '/' } : {})
  }
  res.writeHead(200, { ...SECURITY_HEADERS, ...headers, 'content-length': info.size })
  if (req.method === 'HEAD') return res.end()
  res.end(await readFile(file))
}

export function handler(req, res) {
  let url
  try {
    url = new URL(req.url ?? '/', 'http://local')
  } catch {
    return send(res, 400, '')
  }
  const route = ROUTES[url.pathname]
  if (route) return void proxy(req, res, route)
  if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'not_found' })
  return void serveStatic(req, res, url.pathname).catch(() => send(res, 500, ''))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer(handler).listen(PORT, () => console.log(`[ferry] serving ${DIST} on :${PORT}`))
}
