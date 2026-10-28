// Byte layouts of the relay's legacy "phone dialect" (nodeterm relay-socket.ts + framing.ts;
// byte-exact spec in nodeterm docs/ios-protocol-migration.md §2).
//
//   box    = nonce(24) ‖ nacl.box.after(plain, nonce, sessionKey)
//   plain  = [role:1][seqHi u32 LE][seqLo u32 LE][tag:1][body]       role: host 1, client 2
//   tag    0x01 JSON envelope {kind:'req'|'res'|'notify'|'keepalive'} (also e2ee_auth/authenticated)
//          0x02 terminal frame: [0x74][0x01][op][0][streamId u32 LE][seqHi u32 LE][seqLo u32 LE] payload
import nacl from 'tweetnacl'
import { concat } from './b64'

export const ROLE_HOST = 1
export const ROLE_CLIENT = 2
export const TAG_RPC = 0x01
export const TAG_FRAME = 0x02
const HEADER = 9

export function seal(plain: Uint8Array, key: Uint8Array): Uint8Array {
  const nonce = nacl.randomBytes(nacl.box.nonceLength) // fresh per frame, never caller-supplied
  return concat(nonce, nacl.box.after(plain, nonce, key))
}

export function open(box: Uint8Array, key: Uint8Array): Uint8Array | null {
  if (box.length < nacl.box.nonceLength + nacl.box.overheadLength) return null
  return nacl.box.open.after(box.subarray(nacl.box.nonceLength), box.subarray(0, nacl.box.nonceLength), key) ?? null
}

export function withHeader(role: number, seq: number, tag: number, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(HEADER + 1 + body.length)
  const view = new DataView(out.buffer)
  out[0] = role
  view.setUint32(1, Math.floor(seq / 0x100000000), true)
  view.setUint32(5, seq >>> 0, true)
  out[HEADER] = tag
  out.set(body, HEADER + 1)
  return out
}

export function readHeader(plain: Uint8Array): { role: number; seq: number; tag: number; body: Uint8Array } | null {
  if (plain.length < HEADER + 1) return null
  const view = new DataView(plain.buffer, plain.byteOffset, plain.byteLength)
  return {
    role: plain[0]!,
    seq: view.getUint32(1, true) * 0x100000000 + view.getUint32(5, true),
    tag: plain[HEADER]!,
    body: plain.subarray(HEADER + 1)
  }
}

// ---- terminal frames (framing.ts) -------------------------------------------------------------

export const OP = {
  Output: 1,
  SnapshotStart: 2,
  SnapshotChunk: 3,
  SnapshotEnd: 4,
  Resized: 5,
  Error: 6,
  Input: 7,
  Resize: 8
} as const

export interface Frame {
  op: number
  streamId: number
  seq: number
  payload: Uint8Array
}

const FRAME_KIND = 0x74
const FRAME_VERSION = 1
const FRAME_HEADER = 16
const KNOWN_OPS = new Set<number>([...Object.values(OP), 9, 10, 11])

export function encodeFrame(op: number, streamId: number, seq: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(FRAME_HEADER + payload.length)
  const view = new DataView(out.buffer)
  out[0] = FRAME_KIND
  out[1] = FRAME_VERSION
  out[2] = op
  view.setUint32(4, streamId, true)
  view.setUint32(8, Math.floor(seq / 0x100000000), true)
  view.setUint32(12, seq >>> 0, true)
  out.set(payload, FRAME_HEADER)
  return out
}

export function decodeFrame(buf: Uint8Array): Frame | null {
  if (buf.length < FRAME_HEADER || buf[0] !== FRAME_KIND || buf[1] !== FRAME_VERSION) return null
  const op = buf[2]!
  if (!KNOWN_OPS.has(op)) return null
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  return {
    op,
    streamId: view.getUint32(4, true),
    seq: view.getUint32(8, true) * 0x100000000 + view.getUint32(12, true),
    payload: buf.slice(FRAME_HEADER)
  }
}

/** OP.Resize / OP.Resized payload: cols, rows as u16 LE. */
export function sizePayload(cols: number, rows: number): Uint8Array {
  const out = new Uint8Array(4)
  const view = new DataView(out.buffer)
  view.setUint16(0, Math.min(0xffff, Math.max(1, Math.floor(cols))), true)
  view.setUint16(2, Math.min(0xffff, Math.max(1, Math.floor(rows))), true)
  return out
}

export function readSize(p: Uint8Array): { cols: number; rows: number } | null {
  if (p.length < 4) return null
  const view = new DataView(p.buffer, p.byteOffset, p.byteLength)
  return { cols: view.getUint16(0, true), rows: view.getUint16(2, true) }
}
