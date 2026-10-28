import { createServer, type Server } from 'node:http'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const dist = mkdtempSync(join(tmpdir(), 'ferry-dist-'))
writeFileSync(join(dist, 'index.html'), '<!doctype html>shell')
mkdirSync(join(dist, 'assets'))
writeFileSync(join(dist, 'assets', 'app.js'), 'x')
writeFileSync(join(dist, '.env'), 'SECRET=1')
process.env.DIST = dist

// @ts-expect-error plain ESM module
const { handler, cleanBody, resolveStatic } = await import('./server.mjs')

let server: Server
let base = ''
const upstream: { url: string; init: RequestInit }[] = []
const realFetch = globalThis.fetch

beforeAll(async () => {
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    upstream.push({ url, init })
    return new Response(JSON.stringify({ pairingToken: 'p', relayEndpoint: 'wss://relay.nodeterm.dev' }), { status: 200 })
  })
  server = createServer(handler)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
afterAll(() => {
  server.close()
  vi.unstubAllGlobals()
})
const req = (path: string, init: RequestInit = {}) => realFetch(base + path, init)
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  req(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })

describe('proxy', () => {
  it('forwards an allowlisted join to the fixed upstream, and nothing from the client but the fields', async () => {
    const r = await post('/api/relay/join?u=https://evil.example', { deviceToken: 'tok' }, { cookie: 'a=b', authorization: 'x', 'x-target': 'evil' })
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ pairingToken: 'p' })
    const last = upstream.at(-1)!
    expect(last.url).toBe('https://api.nodeterm.dev/v1/relay/join')
    expect(last.init.body).toBe('{"deviceToken":"tok"}')
    expect(last.init.headers).toEqual({ 'content-type': 'application/json', accept: 'application/json' })
    expect(last.init.redirect).toBe('error')
    expect(r.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('refuses extra or malformed fields, non-JSON, other methods and other api paths', async () => {
    const n = upstream.length
    expect((await post('/api/relay/join', { deviceToken: 'a', url: 'x' })).status).toBe(400)
    expect((await post('/api/relay/join', { deviceToken: 5 })).status).toBe(400)
    expect((await post('/api/relay/device', { deviceId: 'a', hostDeviceId: 'b', hostPublicKeyB64: 'c' })).status).toBe(400)
    expect((await post('/api/relay/join', 'deviceToken=a', { 'content-type': 'text/plain' })).status).toBe(415)
    expect((await post('/api/relay/join', 'x'.repeat(10_000))).status).toBe(413)
    expect((await req('/api/relay/join')).status).toBe(405)
    expect((await post('/api/relay/host-token', { a: 'b' })).status).toBe(404)
    expect((await post('/api/../v1/relay/join', { deviceToken: 'a' })).status).not.toBe(200)
    expect(upstream.length).toBe(n)
  })

  it('rate-limits per client', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 25; i++) statuses.push((await post('/api/relay/join', { deviceToken: 't' }, { 'x-forwarded-for': '10.9.9.9' })).status)
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0)
  })
})

describe('static', () => {
  it('serves the shell with a strict CSP, assets as immutable, and SPA routes as the shell', async () => {
    const r = await req('/')
    expect(await r.text()).toContain('shell')
    expect(r.headers.get('content-security-policy')).toContain("connect-src 'self' wss://relay.nodeterm.dev")
    expect((await req('/assets/app.js')).headers.get('cache-control')).toContain('immutable')
    expect(await (await req('/session/abc')).text()).toContain('shell')
    expect((await req('/missing.js')).status).toBe(404)
  })
  it('never serves dotfiles or escapes the dist folder', async () => {
    expect((await req('/.env')).status).toBe(404)
    // The URL parser folds %2e%2e into '..' and resolves it away: what remains is an app route.
    expect(await (await req('/%2e%2e/%2e%2e/etc/passwd')).text()).toBe('<!doctype html>shell')
    expect(resolveStatic('/../../etc/passwd', dist)).toBeNull()
    expect(resolveStatic('/a/.git/config', dist)).toBeNull()
    expect((await req('/', { method: 'DELETE' })).status).toBe(405)
  })
})

describe('cleanBody', () => {
  it('rebuilds only the allowlist', () => {
    expect(cleanBody('{"deviceToken":"a"}', { deviceToken: 10 })).toEqual({ deviceToken: 'a' })
    expect(cleanBody('{"deviceToken":"a\\n"}', { deviceToken: 10 })).toBeNull()
    expect(cleanBody('[]', { deviceToken: 10 })).toBeNull()
    expect(cleanBody('{"__proto__":{"x":1},"deviceToken":"a"}', { deviceToken: 10 })).toBeNull()
  })
})
