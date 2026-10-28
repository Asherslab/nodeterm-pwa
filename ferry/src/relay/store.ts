// Persistent state in IndexedDB. The device key is a non-extractable CryptoKey: IndexedDB stores the
// key object itself (structured clone), never its bytes.
import type { DeviceKey } from './crypto'
import type { HostIdentity } from './paircode'

export interface Pairing {
  host: HostIdentity
  /** Set once the desktop approved this device by SAS (pinned on its side). */
  approvedAt: number | null
  deviceToken: string | null
}

export interface Persisted {
  device: DeviceKey | null
  deviceId: string | null
  pairing: Pairing | null
}

const DB = 'ferry'
const STORE = 'kv'

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode)
    const r = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(r ? r.result : undefined)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

export async function load(): Promise<Persisted> {
  const get = <T>(k: string) => tx<T>('readonly', (s) => s.get(k) as IDBRequest<T>)
  const [device, deviceId, pairing] = await Promise.all([get<DeviceKey>('device'), get<string>('deviceId'), get<Pairing>('pairing')])
  return { device: device ?? null, deviceId: deviceId ?? null, pairing: pairing ?? null }
}

export async function save<K extends keyof Persisted>(key: K, value: Persisted[K]): Promise<void> {
  await tx('readwrite', (s) => {
    if (value === null) s.delete(key)
    else s.put(value, key)
  })
}

/** Ask the browser not to evict our storage (an installed iOS PWA is exempt anyway). */
export async function persistStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
