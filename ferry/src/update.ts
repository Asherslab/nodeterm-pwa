// The installed app's update path, the meal planner's model (its js/app-update.js). A new build installs
// beside the running one and waits (build/service-worker.ts); an installed phone app is seldom closed
// outright, so on its own a new build would wait for days. So: look for one whenever the app comes back to
// the foreground (at most once a minute), say so when one is waiting, and let Reload hand over to it.
import { useEffect, useState } from 'preact/hooks'

const CHECK_EVERY_MS = 60_000
/** The release this bundle was built as (CI passes the add-on version); 'dev' locally. */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || 'dev'

let registration: ServiceWorkerRegistration | null = null
let waiting = false
let lastCheck = 0
const listeners = new Set<(ready: boolean) => void>()

function ready() {
  if (waiting) return
  waiting = true
  for (const cb of listeners) cb(true)
}

export function registerUpdates(): void {
  if (!('serviceWorker' in navigator)) return
  // 'none': the worker script is always checked against the server, never the HTTP cache.
  navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then((reg) => {
      registration = reg
      lastCheck = Date.now()
      // Only a build replacing one already running is news: the first install replaces nothing.
      const installed = (w: ServiceWorker | null) => w && navigator.serviceWorker.controller && ready()
      if (reg.waiting) installed(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const next = reg.installing
        next?.addEventListener('statechange', () => next.state === 'installed' && installed(next))
      })
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastCheck >= CHECK_EVERY_MS) void checkForUpdate()
      })
    })
    .catch(() => {
      /* no worker (a private tab, a refusing web view): the app runs without an offline copy */
    })
}

/** Ask the server for a newer build now. True when one is (now) waiting. */
export async function checkForUpdate(): Promise<boolean> {
  lastCheck = Date.now()
  try {
    await registration?.update()
  } catch {
    /* offline: the next time */
  }
  if (registration?.waiting && navigator.serviceWorker.controller) ready()
  return waiting
}

/** Reload into the newest build: let the waiting worker take over (it would otherwise wait for every
 *  window to close), then reload. Anything failing ends in a plain reload. */
export async function applyUpdate(): Promise<void> {
  try {
    const reg = registration ?? (await navigator.serviceWorker?.getRegistration())
    if (reg) {
      await reg.update().catch(() => {})
      const next = reg.installing ?? reg.waiting
      if (next) {
        const taken = new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
          setTimeout(resolve, 15_000)
        })
        if (next.state === 'installing')
          await new Promise<void>((resolve) => next.addEventListener('statechange', () => next.state !== 'installing' && resolve()))
        next.postMessage('skip-waiting')
        await taken
      }
    }
  } catch {
    /* fall through to a plain reload */
  }
  location.reload()
}

export function useUpdateReady(): boolean {
  const [r, set] = useState(waiting)
  useEffect(() => {
    listeners.add(set)
    set(waiting)
    return () => void listeners.delete(set)
  }, [])
  return r
}
