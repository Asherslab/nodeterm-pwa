import nacl from 'tweetnacl'
import { describe, expect, it } from 'vitest'
import { OP, decodeFrame, encodeFrame, open, readHeader, readSize, seal, sizePayload, withHeader } from './wire'

describe('sealed plaintext header', () => {
  it('is [role][seqHi u32 LE][seqLo u32 LE][tag] (relay-socket.ts withHeader)', () => {
    const p = withHeader(2, 2 ** 32 + 5, 0x01, Uint8Array.of(9))
    expect([...p]).toEqual([2, 1, 0, 0, 0, 5, 0, 0, 0, 0x01, 9])
    expect(readHeader(p)).toMatchObject({ role: 2, seq: 2 ** 32 + 5, tag: 1 })
  })
})

describe('box', () => {
  it('round-trips and refuses a tampered or short box', () => {
    const key = nacl.randomBytes(32)
    const box = seal(Uint8Array.of(1, 2, 3), key)
    expect(box.length).toBe(24 + 16 + 3)
    expect(open(box, key)).toEqual(Uint8Array.of(1, 2, 3))
    box[30]! ^= 1
    expect(open(box, key)).toBeNull()
    expect(open(new Uint8Array(10), key)).toBeNull()
  })
})

describe('terminal frames (framing.ts)', () => {
  it('encodes the 16-byte header little-endian', () => {
    const f = encodeFrame(OP.Input, 7, 2 ** 32 + 1, Uint8Array.of(0x61))
    expect([...f.subarray(0, 16)]).toEqual([0x74, 1, 7, 0, 7, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])
    expect(decodeFrame(f)).toEqual({ op: 7, streamId: 7, seq: 2 ** 32 + 1, payload: Uint8Array.of(0x61) })
  })
  it('rejects a bad kind, version or opcode', () => {
    const f = encodeFrame(OP.Output, 1, 0, new Uint8Array())
    expect(decodeFrame(Uint8Array.of(0x75, ...f.subarray(1)))).toBeNull()
    expect(decodeFrame(Uint8Array.of(0x74, 2, ...f.subarray(2)))).toBeNull()
    expect(decodeFrame(Uint8Array.of(0x74, 1, 99, ...f.subarray(3)))).toBeNull()
  })
  it('sizes are u16 LE, clamped', () => {
    expect([...sizePayload(80, 24)]).toEqual([80, 0, 24, 0])
    expect(readSize(sizePayload(0, 70000))).toEqual({ cols: 1, rows: 0xffff })
  })
})
