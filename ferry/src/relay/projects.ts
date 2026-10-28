// `projects.list` → shelves of sessions. The blob is three sections split by fixed markers
// (nodeterm main/index.ts listProjectsOutput):
//   <workspace JSON {version:2, projects:[…]}> \n--NT-PROJECTS-SPLIT--\n <tmux session names> \n--NT-STATUS-SPLIT--\n <agent-status.json>
// Every section is best-effort on the host (an empty string when unreadable), so every one is here too.

const PROJECTS_MARK = '\n--NT-PROJECTS-SPLIT--\n'
const STATUS_MARK = '\n--NT-STATUS-SPLIT--\n'

export type Ask = 'plan' | 'ask' | 'allow' | 'needs'
export type SessionState = 'needs' | 'working' | 'done' | 'idle' | 'asleep'

export interface Session {
  id: string
  designator: string
  title: string
  agent: string | null
  projectId: string
  state: SessionState
  ask: Ask | null
  /** Unresolved inbox events for this node, newest first (approvals/questions carry a pendingId). */
  pendingId: string | null
  /** One honest line: what it is doing or what it wants. */
  line: string
  /** Since when it has been in this state (ms epoch), when known. */
  since: number | null
  unread: boolean
  /** The status could not be confirmed recently: shown hatched, never as fact. */
  stale: boolean
  contextPercent: number | null
}

export interface Shelf {
  id: string
  name: string
  path: string
  sessions: Session[]
  kanban: Kanban | null
}

export interface Kanban {
  columns: { id: string; title: string; color: string }[]
  assignments: Record<string, string>
}

export interface Snapshot {
  shelves: Shelf[]
  /** The status file's own timestamp; null when the section was empty. */
  statusAt: number | null
}

interface MirrorNode {
  state?: string
  agentId?: string
  name?: string
  hibernated?: boolean
  updatedAt?: number
}
interface InboxEvent {
  id: string
  ts: number
  nodeId: string
  kind: 'approval' | 'question' | 'done'
  title?: string
  detail?: string
  resolved?: boolean
  pendingId?: string
}

const AGENT_NAMES: Record<string, string> = {
  claude: 'Claude', codex: 'Codex', gemini: 'Gemini', grok: 'Grok', copilot: 'Copilot', opencode: 'opencode', cursor: 'Cursor', devin: 'Devin'
}
export const STALE_AFTER_MS = 120_000

function parseJson(s: string): unknown {
  try {
    return s.trim() ? JSON.parse(s) : null
  } catch {
    return null
  }
}
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const text = (v: unknown): string | null => (typeof v === 'string' ? v : null)

export function agentName(agentId: string | null | undefined): string | null {
  if (!agentId) return null
  if (agentId.startsWith('custom:')) return 'Custom agent'
  return AGENT_NAMES[agentId] ?? agentId
}

function askOf(e: InboxEvent): Ask {
  if (e.kind === 'question') return 'ask'
  return /plan/i.test(`${e.title ?? ''} ${e.detail ?? ''}`) ? 'plan' : 'allow'
}

/** Short shelf codes: the first three letters, unique across shelves (PAN, STA, FAN …). */
export function shelfCodes(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((n) => {
    const letters = n.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'PRJ'
    let code = letters.slice(0, 3).padEnd(3, 'X')
    for (let i = 3; used.has(code) && i < letters.length; i++) code = letters.slice(0, 2) + letters[i]
    for (let k = 2; used.has(code); k++) code = letters.slice(0, 2) + String(k)
    used.add(code)
    return code
  })
}

export function parseProjects(blob: string, now = Date.now()): Snapshot {
  const [wsPart = '', rest = ''] = blob.split(PROJECTS_MARK)
  const [, statusPart = ''] = rest.split(STATUS_MARK)
  const ws = obj(parseJson(wsPart))
  const status = obj(parseJson(statusPart))
  const nodes = obj(status.nodes) as Record<string, MirrorNode>
  const statusAt = typeof status.updatedAt === 'number' ? status.updatedAt : null
  const inbox = obj(status.inbox)
  const events = (Array.isArray(inbox.events) ? inbox.events : []) as InboxEvent[]
  const nowInfo = obj(inbox.nodes) as Record<string, { activity?: string; tool?: string; contextPercent?: number; prompt?: string }>
  const open = new Map<string, InboxEvent>()
  const unread = new Set<string>()
  for (const e of events) {
    if (!e || typeof e.nodeId !== 'string' || e.resolved) continue
    if (e.kind === 'done') unread.add(e.nodeId)
    else if (!open.has(e.nodeId) || (open.get(e.nodeId)!.ts ?? 0) < e.ts) open.set(e.nodeId, e)
  }
  const stale = statusAt === null || now - statusAt > STALE_AFTER_MS

  const projects = (Array.isArray(ws.projects) ? ws.projects : []).map(obj).filter((p) => !p.closed && text(p.id))
  const codes = shelfCodes(projects.map((p) => text(p.name) ?? ''))
  const shelves = projects.map((p, pi): Shelf => {
    const terminals = (Array.isArray(p.nodes) ? p.nodes : []).map(obj).filter((n) => n.kind === 'terminal' && text(n.id))
    const sessions = terminals.map((n, i): Session => {
      const id = n.id as string
      const m = nodes[id] ?? {}
      const ev = open.get(id)
      const info = nowInfo[id] ?? {}
      const agent = agentName(text(n.agentId) ?? m.agentId)
      let state: SessionState
      let ask: Ask | null = null
      let line: string
      if (ev || m.state === 'waiting' || m.state === 'blocked') {
        state = 'needs'
        ask = ev ? askOf(ev) : 'needs'
        line = ev?.title || (m.state === 'blocked' ? 'Blocked: needs you' : 'Waiting for you')
      } else if (m.hibernated) {
        state = 'asleep'
        line = 'Asleep · wakes when opened'
      } else if (m.state === 'working') {
        state = 'working'
        line = [info.activity, info.tool].filter(Boolean).join(' · ') || 'Working'
      } else if (m.state === 'done') {
        state = 'done'
        line = info.prompt ? `Last: ${info.prompt}` : 'Finished its turn'
      } else {
        state = 'idle'
        line = agent ? 'Waiting for a prompt' : 'Terminal'
      }
      return {
        id,
        designator: `${codes[pi]}·${i + 1}`,
        title: text(n.title) || m.name || 'Untitled',
        agent,
        projectId: p.id as string,
        state,
        ask,
        pendingId: ev?.pendingId ?? null,
        line,
        since: typeof m.updatedAt === 'number' ? m.updatedAt : null,
        unread: unread.has(id) && state !== 'needs',
        stale: state === 'working' && stale,
        contextPercent: typeof info.contextPercent === 'number' ? info.contextPercent : null
      }
    })
    const k = obj(p.kanban)
    const kanban: Kanban | null = Array.isArray(k.columns)
      ? {
          columns: k.columns.map(obj).map((c) => ({ id: String(c.id), title: String(c.title ?? ''), color: String(c.color ?? '#8a978f') })),
          assignments: Object.fromEntries(
            (Array.isArray(k.assignments) ? k.assignments : []).map(obj).map((a) => [String(a.nodeId), String(a.columnId)])
          )
        }
      : null
    return { id: p.id as string, name: text(p.name) ?? 'Project', path: text(p.cwd) ?? '', sessions, kanban }
  })
  return { shelves: shelves.filter((s) => s.sessions.length > 0 || s.kanban), statusAt }
}

export function counts(snap: Snapshot): { all: number; needs: number; working: number } {
  const all = snap.shelves.flatMap((s) => s.sessions)
  return { all: all.length, needs: all.filter((s) => s.state === 'needs').length, working: all.filter((s) => s.state === 'working').length }
}
