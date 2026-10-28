// Base64 the way nodeterm's relay expects it: standard alphabet, padded, and CANONICAL on the way in
// (the decoded bytes must re-encode to the exact input), because keys are compared as strings in
// every pin store and a second spelling of one key matches none of its pins (e2ee.ts
// canonicalB64ToBytes).

export function bytesToB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

/** Decode standard padded base64 of exactly `length` bytes, refusing any other spelling. */
export function canonicalB64ToBytes(b64: unknown, length: number, what: string): Uint8Array {
  if (typeof b64 !== 'string') throw new Error(`Invalid ${what}: not a string`)
  if (b64.length !== 4 * Math.ceil(length / 3)) throw new Error(`Invalid ${what}: expected ${length} bytes of base64`)
  let raw: string
  try {
    raw = atob(b64)
  } catch {
    throw new Error(`Invalid ${what}: not base64`)
  }
  const out = Uint8Array.from(raw, (c) => c.charCodeAt(0))
  if (out.length !== length || bytesToB64(out) !== b64) throw new Error(`Invalid ${what}: not canonical base64`)
  return out
}

export function bytesToB64Url(bytes: Uint8Array): string {
  return bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Canonical base64url (no padding), after removing ASCII whitespace (a code wrapped by a mail
 *  client). Null for anything else. */
export function b64UrlToBytes(s: string): Uint8Array | null {
  const b = s.replace(/[\t\n\r ]+/g, '')
  if (!b || !/^[A-Za-z0-9_-]+$/.test(b)) return null
  const std = b.replace(/-/g, '+').replace(/_/g, '/')
  let raw: string
  try {
    raw = atob(std + '='.repeat((4 - (std.length % 4)) % 4))
  } catch {
    return null
  }
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0))
  return bytesToB64Url(bytes) === b ? bytes : null
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** A copy backed by a plain ArrayBuffer, which WebCrypto's BufferSource typing requires. */
export function buf(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes)
}
