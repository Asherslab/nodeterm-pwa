import { describe, expect, it } from 'vitest'
import { counts, parseProjects, shelfCodes, STALE_AFTER_MS } from './projects'

const NOW = 1_800_000_000_000
const workspace = {
  version: 2,
  projects: [
    {
      id: 'p1', name: 'pantry', cwd: '/Users/me/Git/pantry',
      nodes: [
        { id: 'a', kind: 'terminal', title: 'Costco receipt parser', agentId: 'claude' },
        { id: 'b', kind: 'terminal', title: 'Offline op-log merge', agentId: 'codex' },
        { id: 'c', kind: 'terminal', title: 'Shopping list', agentId: 'claude' },
        { id: 'd', kind: 'terminal', title: 'Price import', agentId: 'claude' },
        { id: 's', kind: 'sticky', title: 'notes' }
      ],
      kanban: { columns: [{ id: 'todo', title: 'To do', color: '#888' }], assignments: [{ nodeId: 'a', columnId: 'todo' }] }
    },
    { id: 'p2', name: 'pancake', nodes: [{ id: 'e', kind: 'terminal', title: 'x', agentId: 'gemini' }] },
    { id: 'p3', name: 'closed', closed: true, nodes: [{ id: 'f', kind: 'terminal', title: 'y' }] }
  ]
}
const status = {
  v: 1,
  updatedAt: NOW - 1000,
  nodes: {
    a: { state: 'waiting', agentId: 'claude', updatedAt: NOW - 60_000 },
    b: { state: 'working', updatedAt: NOW - 720_000 },
    c: { state: 'done', updatedAt: NOW - 5000 },
    e: { hibernated: true, updatedAt: NOW }
  },
  inbox: {
    events: [
      { id: '1-1', ts: NOW - 60_000, nodeId: 'a', kind: 'approval', title: 'Plan ready: 6 steps', pendingId: 'pend-a' },
      { id: '1-2', ts: NOW - 5000, nodeId: 'c', kind: 'done', title: 'Finished' },
      { id: '1-3', ts: NOW - 9000, nodeId: 'd', kind: 'question', title: 'Old', resolved: true }
    ],
    nodes: { b: { activity: 'Running tests', tool: 'Bash', contextPercent: 41 } }
  }
}
const blob = (ws: unknown, st: unknown) =>
  `${JSON.stringify(ws)}\n--NT-PROJECTS-SPLIT--\nnt-a\nnt-b\n--NT-STATUS-SPLIT--\n${st === '' ? '' : JSON.stringify(st)}`

describe('parseProjects', () => {
  const snap = parseProjects(blob(workspace, status), NOW)
  const [pantry, pancake] = snap.shelves
  const by = (id: string) => snap.shelves.flatMap((s) => s.sessions).find((s) => s.id === id)!

  it('builds shelves of terminal nodes, skipping closed projects and non-terminals', () => {
    expect(snap.shelves.map((s) => s.name)).toEqual(['pantry', 'pancake'])
    expect(pantry!.sessions.map((s) => s.designator)).toEqual(['PAN·1', 'PAN·2', 'PAN·3', 'PAN·4'])
    expect(pancake!.sessions[0]!.designator).toBe('PAC·1')
    expect(pantry!.kanban).toEqual({ columns: [{ id: 'todo', title: 'To do', color: '#888' }], assignments: { a: 'todo' } })
  })

  it('derives honest states', () => {
    expect(by('a')).toMatchObject({ state: 'needs', ask: 'plan', pendingId: 'pend-a', line: 'Plan ready: 6 steps', agent: 'Claude' })
    expect(by('b')).toMatchObject({ state: 'working', line: 'Running tests · Bash', since: NOW - 720_000, contextPercent: 41, stale: false })
    expect(by('c')).toMatchObject({ state: 'done', unread: true })
    expect(by('d')).toMatchObject({ state: 'idle', unread: false })
    expect(by('e')).toMatchObject({ state: 'asleep', agent: 'Gemini' })
    expect(counts(snap)).toEqual({ all: 5, needs: 1, working: 1 })
  })

  it('marks working as stale when the status file is old, and survives empty sections', () => {
    const old = parseProjects(blob(workspace, { ...status, updatedAt: NOW - STALE_AFTER_MS - 1 }), NOW)
    expect(old.shelves[0]!.sessions[1]!.stale).toBe(true)
    const bare = parseProjects(blob(workspace, ''), NOW)
    expect(bare.statusAt).toBeNull()
    expect(bare.shelves[0]!.sessions.every((s) => s.state === 'idle')).toBe(true)
    expect(parseProjects('').shelves).toEqual([])
  })
})

describe('shelfCodes', () => {
  it('keeps codes unique', () => {
    expect(shelfCodes(['pantry', 'pancake', 'pan', 'fan-ctl', ''])).toEqual(['PAN', 'PAC', 'PA2', 'FAN', 'PRJ'])
  })
})
