// The pairing input: the desktop's public relay identity, as nodeterm writes it to
// ~/.nodeterm/relay.json while "Reach this Mac from anywhere" is on (relay-advertise.ts):
//   {v:1, hostId, hostPublicKeyB64, relayEndpoint, hostDeviceId}
// carried to the phone as `ntpwa1:<base64url(JSON)>` (scripts/pair-code.sh adds `label`), or pasted
// as the raw JSON. Public material only; trust comes from it having come off the owner's own screen.
import { b64UrlToBytes, bytesToB64 } from './b64'
import { hostIdFromKey, hostKeyFromB64 } from './crypto'
import { allowedEndpoint } from './api'

export const PAIR_PREFIX = 'ntpwa1:'

export interface HostIdentity {
  hostId: string
  hostPublicKeyB64: string
  relayEndpoint: string
  hostDeviceId: string
  label: string
}

const str = (o: Record<string, unknown>, k: string, max: number): string | null =>
  typeof o[k] === 'string' && (o[k] as string).length > 0 && (o[k] as string).length <= max ? (o[k] as string) : null

/** Decode and verify a pairing code. Throws a sentence the pairing screen can show. */
export async function decodePairCode(input: string): Promise<HostIdentity> {
  const t = input.trim()
  let json: string
  if (t.startsWith(PAIR_PREFIX)) {
    const bytes = b64UrlToBytes(t.slice(PAIR_PREFIX.length))
    if (!bytes) throw new Error("That code is damaged. Copy it again from the Mac.")
    json = new TextDecoder().decode(bytes)
  } else if (t.startsWith('{')) {
    json = t
  } else {
    throw new Error("That isn't a pairing code. It starts with ntpwa1:")
  }
  let o: Record<string, unknown>
  try {
    o = JSON.parse(json)
  } catch {
    throw new Error("That code is damaged. Copy it again from the Mac.")
  }
  const hostPublicKeyB64 = str(o, 'hostPublicKeyB64', 64)
  const hostId = str(o, 'hostId', 64)
  const hostDeviceId = str(o, 'hostDeviceId', 128)
  const relayEndpoint = str(o, 'relayEndpoint', 512)
  if (o.v !== 1 || !hostPublicKeyB64 || !hostId || !hostDeviceId || !relayEndpoint) {
    throw new Error('That code is missing parts. Make sure remote access is on, then make a new code.')
  }
  if (!allowedEndpoint(relayEndpoint)) throw new Error('That code names a relay that is not encrypted (wss).')
  let key: Uint8Array
  try {
    key = hostKeyFromB64(hostPublicKeyB64)
  } catch {
    throw new Error("That code's key is not valid. Make a new code on the Mac.")
  }
  if ((await hostIdFromKey(key)) !== hostId) throw new Error("That code's key and address don't match.")
  const rawLabel = typeof o.label === 'string' ? o.label : ''
  // eslint-disable-next-line no-control-regex
  const label = rawLabel.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, 60) || 'Mac'
  return { hostId, hostPublicKeyB64: bytesToB64(key), relayEndpoint, hostDeviceId, label }
}
