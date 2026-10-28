// App-wide state: the one Connection, the projects snapshot it polls, the theme, and the route.
import { useEffect, useState } from 'preact/hooks'
import { Connection, type LinkState } from './relay/connection'
import { parseProjects, type Session, type Snapshot } from './relay/projects'

export const connection = new Connection()

export function useLink(): LinkState {
  const [s, set] = useState<LinkState>(connection.state)
  useEffect(() => connection.subscribe(set), [])
  return s
}

// ---- projects snapshot: polled while live and visible (docs/protocol.md §7) --------------------

type SnapState = { snap: Snapshot | null; at: number | null; error: string | null }
let snapState: SnapState = { snap: null, at: null, error: null }
const snapListeners = new Set<(s: SnapState) => void>()
let pollTimer: ReturnType<typeof setTimeout> | null = null
const POLL_MS = 5000

function setSnap(s: SnapState) {
  snapState = s
  for (const cb of snapListeners) cb(s)
}

export async function refreshProjects(): Promise<void> {
  const rpc = connection.rpc
  if (!rpc || connection.state.kind !== 'live') return
  try {
    const { output } = await rpc.request<{ output: string }>('projects.list', {}, 20_000)
    setSnap({ snap: parseProjects(output ?? ''), at: Date.now(), error: null })
  } catch (e) {
    setSnap({ ...snapState, error: (e as Error).message })
  }
}

function schedule() {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = null
  if (connection.state.kind !== 'live' || document.visibilityState !== 'visible') return
  pollTimer = setTimeout(async () => {
    await refreshProjects()
    schedule()
  }, POLL_MS)
}

connection.subscribe((s) => {
  if (s.kind === 'live') void refreshProjects().then(schedule)
  else schedule()
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    connection.resume()
    schedule()
  } else {
    connection.suspend()
  }
})

export function useSnapshot(): SnapState {
  const [s, set] = useState(snapState)
  useEffect(() => {
    snapListeners.add(set)
    return () => void snapListeners.delete(set)
  }, [])
  return s
}

export function findSession(snap: Snapshot | null, id: string): Session | null {
  return snap?.shelves.flatMap((s) => s.sessions).find((s) => s.id === id) ?? null
}

// ---- theme ------------------------------------------------------------------------------------

type ThemePref = 'system' | 'light' | 'dark'
const THEME_KEY = 'ferry.theme'
function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}
const media = matchMedia('(prefers-color-scheme: dark)')
export function applyTheme(pref = readPref()): void {
  const dark = pref === 'dark' || (pref === 'system' && media.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e2421' : '#1f4a44')
}
media.addEventListener('change', () => applyTheme())
export function useTheme(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState(readPref)
  return [
    pref,
    (p) => {
      try {
        if (p === 'system') localStorage.removeItem(THEME_KEY)
        else localStorage.setItem(THEME_KEY, p)
      } catch {
        /* storage blocked: still applies for this session */
      }
      setPref(p)
      applyTheme(p)
    }
  ]
}

// ---- route (hash) -----------------------------------------------------------------------------

export type Route =
  | { name: 'rack'; filter: 'all' | 'needs' | 'working' }
  | { name: 'session'; id: string; mode: 'chat' | 'term' }
  | { name: 'board'; projectId: string | null }
  | { name: 'mac' }

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  switch (parts[0]) {
    case 'needs':
    case 'working':
      return { name: 'rack', filter: parts[0] }
    case 's':
      return parts[1] ? { name: 'session', id: parts[1], mode: parts[2] === 'term' ? 'term' : 'chat' } : { name: 'rack', filter: 'all' }
    case 'board':
      return { name: 'board', projectId: parts[1] ?? null }
    case 'mac':
      return { name: 'mac' }
    default:
      return { name: 'rack', filter: 'all' }
  }
}

export const href = {
  rack: (f: 'all' | 'needs' | 'working' = 'all') => (f === 'all' ? '#/' : `#/${f}`),
  session: (id: string, mode: 'chat' | 'term' = 'chat') => `#/s/${encodeURIComponent(id)}${mode === 'term' ? '/term' : ''}`,
  board: (pid?: string) => (pid ? `#/board/${encodeURIComponent(pid)}` : '#/board'),
  mac: () => '#/mac'
}

export function useRoute(): Route {
  const [r, set] = useState(() => parseRoute(location.hash))
  useEffect(() => {
    const on = () => set(parseRoute(location.hash))
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return r
}

/** "12m", "3h", "2d": how long a session has been in its state. */
export function ago(since: number | null, now = Date.now()): string {
  if (!since) return ''
  const m = Math.max(0, Math.round((now - since) / 60_000))
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`
}
