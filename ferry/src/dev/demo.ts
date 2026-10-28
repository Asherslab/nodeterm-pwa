// Development only (`npm run dev`, then /?demo): a scripted Mac answering the real verbs with
// synthetic content, so the screens can be seen and tested without a paired desktop. Never bundled
// into a production build (main.tsx imports it behind import.meta.env.DEV).
import { connection } from '../state'
import type { RelayRpc, StreamHandlers } from '../relay/rpc'

const NOW = Date.now()
const min = (m: number) => NOW - m * 60_000

const workspace = {
  version: 2,
  projects: [
    { id: 'pantry', name: 'pantry', cwd: '/Users/me/Git/pantry', nodes: [
      { id: 'pan1', kind: 'terminal', title: 'Costco receipt parser', agentId: 'claude' },
      { id: 'pan2', kind: 'terminal', title: 'Offline op-log merge', agentId: 'codex' },
      { id: 'pan3', kind: 'terminal', title: 'Shopping list by store', agentId: 'claude' },
      { id: 'pan4', kind: 'terminal', title: 'Woolworths price import', agentId: 'claude' }
    ], kanban: {
      columns: [{ id: 'backlog', title: 'Backlog', color: '#8a978f' }, { id: 'prog', title: 'In progress', color: '#2f7d6e' }, { id: 'review', title: 'Review', color: '#c9a452' }, { id: 'done', title: 'Done', color: '#5b6b8c' }],
      assignments: [{ nodeId: 'pan1', columnId: 'prog' }, { nodeId: 'pan2', columnId: 'prog' }, { nodeId: 'pan3', columnId: 'review' }, { nodeId: 'pan4', columnId: 'backlog' }]
    } },
    { id: 'stage', name: 'stage-cues', cwd: '/Users/me/Git/stage-cues', nodes: [
      { id: 'stg1', kind: 'terminal', title: 'NDI source picker', agentId: 'claude' },
      { id: 'stg2', kind: 'terminal', title: 'PTZ preset sync', agentId: 'gemini' }
    ] },
    { id: 'fan', name: 'fan-ctl', cwd: '/Users/me/Git/fan-ctl', nodes: [
      { id: 'fan1', kind: 'terminal', title: 'PID loop tuning', agentId: 'claude' },
      { id: 'fan2', kind: 'terminal', title: 'BOM cost check', agentId: 'codex' }
    ] }
  ]
}
const answered = new Set<string>()
const statusFile = () => ({
  v: 1,
  updatedAt: Date.now(),
  nodes: {
    pan1: { state: answered.has('pan1') ? 'working' : 'waiting', updatedAt: min(2) },
    pan2: { state: 'working', updatedAt: min(12) },
    pan3: { state: 'done', updatedAt: min(18) },
    stg1: { state: answered.has('stg1') ? 'working' : 'waiting', updatedAt: min(5) },
    stg2: { hibernated: true, updatedAt: min(1440) },
    fan1: { state: answered.has('fan1') ? 'working' : 'waiting', updatedAt: min(1) },
    fan2: { state: 'working', updatedAt: min(3) }
  },
  inbox: {
    events: [
      { id: '1-1', ts: min(2), nodeId: 'pan1', kind: 'approval', title: 'Plan ready · 6 steps', pendingId: 'p-pan1', resolved: answered.has('pan1') },
      { id: '1-2', ts: min(5), nodeId: 'stg1', kind: 'question', title: 'Asks: default camera?', pendingId: 'p-stg1', resolved: answered.has('stg1') },
      { id: '1-3', ts: min(1), nodeId: 'fan1', kind: 'approval', title: 'Wants to run pio run -t upload', pendingId: 'p-fan1', resolved: answered.has('fan1') },
      { id: '1-4', ts: min(18), nodeId: 'pan3', kind: 'done', title: 'Finished' }
    ],
    nodes: { pan2: { activity: 'Running tests', tool: '214 passed' }, fan2: { activity: 'Reading jlc-bom.csv' } }
  }
})

const PLAN = `## Costco receipt parser

1. Read the PDF text layer with \`pdfpig\`; fall back to OCR only for scanned pages.
2. Parse line items: item no., description, qty, unit price, \`GST\` flag.
3. Match the printed total to the cent; flag the receipt if it doesn't.
4. Write synthetic fixtures for the three layouts in \`tests/fixtures\`.
5. Map items to ingredients by item no., then by fuzzy name.
6. Run the parser tests and the costing tests.`

const pages: Record<string, unknown> = {
  pan1: { version: 1, found: true, olderCursor: null, model: 'Opus', messages: [
    { role: 'user', at: min(9), parts: [{ kind: 'text', text: 'Parse the Costco receipts in `private/receipts`. Totals must match to the cent.' }] },
    { role: 'assistant', at: min(2), parts: [
      { kind: 'tool', name: 'Read', arg: 'private/receipts/costco-2026-10-03.pdf' },
      { kind: 'tool', name: 'Grep', arg: '"GST" src/' },
      { kind: 'text', text: 'The text layer is clean on all three receipts, so OCR is only a fallback. Each line carries an **item number**, which is a better join key than the description: Costco abbreviates names differently per store.\n\nOne receipt has a member rebate line that subtracts from the total; I\'ll treat it as a negative line, not a discount.' },
      { kind: 'tool', name: 'ExitPlanMode', arg: 'plan', body: PLAN }
    ] }
  ] },
  stg1: { version: 1, found: true, olderCursor: null, messages: [
    { role: 'user', at: min(12), parts: [{ kind: 'text', text: 'Add a source picker to the operator page: list the NDI sources and switch the program feed.' }] },
    { role: 'assistant', at: min(5), parts: [
      { kind: 'tool', name: 'Bash', arg: 'ndi-list --timeout 2' },
      { kind: 'text', text: 'Found three sources: `PTZ 1 (Stage)`, `PTZ 2 (Pulpit)` and `WIRECAST (Program)`. One decision before I wire the startup path:' },
      { kind: 'tool', name: 'AskUserQuestion', arg: '', questions: [{ question: 'Which source should the picker select when the service starts?', multiSelect: false, options: [{ label: 'Last used' }, { label: 'Stage wide · PTZ 1' }, { label: 'Pulpit · PTZ 2' }] }] }
    ] }
  ] },
  fan1: { version: 1, found: true, olderCursor: null, messages: [
    { role: 'assistant', at: min(1), parts: [{ kind: 'text', text: 'Gains look right in the simulator. Flashing to check them on the real fan.' }, { kind: 'tool', name: 'Bash', arg: 'pio run -t upload --upload-port /dev/cu.usbmodem1101' }] }
  ] }
}
const HELD: Record<string, { pendingId: string; toolName: string; questions?: string[] }> = {
  pan1: { pendingId: 'p-pan1', toolName: 'ExitPlanMode' },
  stg1: { pendingId: 'p-stg1', toolName: 'AskUserQuestion', questions: ['Which source should the picker select when the service starts?'] },
  fan1: { pendingId: 'p-fan1', toolName: 'Bash' }
}

const SCREEN = `\x1b[2m~/Git/pantry\x1b[0m \x1b[34mfeat/costco\x1b[0m $ claude
\x1b[1m● Read\x1b[0m(private/receipts/costco-2026-10-03.pdf)
  ⎿  Read 3 pages

\x1b[1m●\x1b[0m The text layer is clean; item numbers are the join key.

 \x1b[1mReady to code?\x1b[0m
 Would you like to proceed?
 \x1b[33m❯ 1. Yes, and auto-accept edits\x1b[0m
   2. Yes, and manually approve edits
   3. No, keep planning
`

export function startDemo(): void {
  const handlers = new Map<number, StreamHandlers>()
  const rpc = {
    async request(method: string, params: Record<string, unknown>) {
      await new Promise((r) => setTimeout(r, 120))
      const id = String(params.nodeId ?? '')
      switch (method) {
        case 'host.info': return { platform: 'darwin', verbs: [] }
        case 'projects.list': return { output: `${JSON.stringify(workspace)}\n--NT-PROJECTS-SPLIT--\n\n--NT-STATUS-SPLIT--\n${JSON.stringify(statusFile())}` }
        case 'chat.page': return { page: pages[id] ?? { version: 1, found: true, olderCursor: null, messages: [{ role: 'assistant', at: min(3), parts: [{ kind: 'text', text: 'Working on it.' }] }] } }
        case 'chat.status': {
          const held = answered.has(id) ? null : HELD[id] ?? null
          const st = (statusFile().nodes as Record<string, { state?: string }>)[id]?.state ?? null
          return { status: { version: 1, state: st === 'waiting' ? 'waiting' : st, held, hibernated: id === 'stg2', paused: false, dropped: false, sessionEnded: false, structuredAnswers: true, hostRefuses: !!held } }
        }
        case 'agent.answer': answered.add(id); return { ok: true }
        case 'chat.send': return { result: 'sent' }
        case 'projects.setCardColumn': {
          const a = workspace.projects[0]!.kanban!.assignments.find((x) => x.nodeId === params.nodeId)
          if (a) a.columnId = String(params.columnId)
          return { moved: true }
        }
        case 'pty.attach': setTimeout(() => (handlers.get(1)?.onSnapshot(SCREEN)), 50); return { streamId: 1, fresh: false }
        default: return {}
      }
    },
    bindStream: (sid: number, h: StreamHandlers) => void handlers.set(sid, h),
    unbindStream: (sid: number) => void handlers.delete(sid),
    input: () => true,
    resize: () => true,
    on: () => () => {},
    notify: () => true
  } as unknown as RelayRpc
  connection.demo(rpc, { hostId: 'demo', hostPublicKeyB64: 'pOCSkrZRwni5dyxWn1+puxPZBrRqtoyd+dwrRAn4ogk=', relayEndpoint: 'wss://relay.nodeterm.dev', hostDeviceId: 'demo', label: 'Studio Mac' })
}
