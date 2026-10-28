// The Chat side of a session (nodeterm docs/mobile-chat-view.md §3–§5): the transcript, the answer
// card for whatever the agent holds, and a composer the desktop gates. Rules kept from that spec:
//   - the composer is unlocked only when the host does not refuse, nothing is held, and the state is
//     done or unknown; any unknown state or a status of an unknown version is locked;
//   - 'refused' keeps the draft and says why; 'unconfirmed' keeps the draft marked "may not have been
//     sent" and is NEVER resent automatically;
//   - structured answers only for a held ticket that accepts them; otherwise "answer in the terminal".
import { useEffect, useRef, useState } from 'preact/hooks'
import { connection, href, refreshProjects } from '../state'
import { RpcError } from '../relay/rpc'
import type { Session } from '../relay/projects'
import { Markdown } from './markdown'
import { Icon } from './icons'

interface ChatQuestion { question: string; header?: string; multiSelect: boolean; options: { label: string; description?: string }[] }
type Part =
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool'; name: string; arg: string; result?: string; body?: string; questions?: ChatQuestion[]; summary?: { filePath?: string; added?: number; removed?: number } }
interface Message { role: 'user' | 'assistant'; parts: Part[]; key?: number; at?: number }
interface ChatPage { version: number; messages: Message[]; found: boolean; olderCursor: number | null; model?: string; effort?: string }
interface ChatStatus {
  version?: number
  state: 'working' | 'waiting' | 'blocked' | 'done' | null | string
  held: { pendingId: string; toolName: string; questions?: string[] } | null
  hibernated: boolean
  paused: boolean
  dropped: boolean
  sessionEnded: boolean
  structuredAnswers: boolean
  hostRefuses?: boolean
  refusal?: 'working' | 'dialog'
}

const REASONS: Record<string, string> = {
  working: 'The agent is working. Wait for it to finish.',
  dialog: 'The agent is waiting on a prompt. Answer it first.',
  asleep: 'The session is asleep. Open it on the Mac or wake it.',
  paused: 'The session is paused on the Mac.',
  dropped: "The agent isn't attached to this terminal.",
  exited: "The agent isn't running in this terminal.",
  busy: 'Still sending your previous message.',
  late: "The Mac's window answered too late, so nothing was typed.",
  unavailable: "The Mac's nodeterm window didn't answer, so nothing was typed.",
  failed: 'The terminal refused the paste.'
}

const PLAN_TOOL = 'ExitPlanMode'
const QUESTION_TOOL = 'AskUserQuestion'

function lockReason(st: ChatStatus | null): string | null {
  if (!st) return 'Checking whether the agent can take a message…'
  if (st.version !== undefined && st.version !== 1) return 'Update this app: the Mac speaks a newer chat format.'
  if (st.held) return 'Answer the request above to continue.'
  if (st.hostRefuses) return st.refusal === 'dialog' ? REASONS.dialog! : REASONS.working!
  if (st.hibernated) return REASONS.asleep!
  if (st.sessionEnded) return REASONS.exited!
  if (st.state === 'done' || st.state === null) return null
  if (st.state === 'working') return REASONS.working!
  return REASONS.dialog!
}

function lastTool(page: ChatPage | null, name: string) {
  for (const m of [...(page?.messages ?? [])].reverse())
    for (const p of [...m.parts].reverse()) if (p.kind === 'tool' && p.name === name) return p
  return null
}

const rel = (at?: number) => {
  if (!at) return ''
  const m = Math.round((Date.now() - at) / 60_000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`
}

export function Chat({ session }: { session: Session }) {
  const [page, setPage] = useState<ChatPage | null>(null)
  const [status, setStatus] = useState<ChatStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sendNote, setSendNote] = useState<{ kind: 'refused' | 'unconfirmed' | 'sent'; text: string } | null>(null)
  const [sending, setSending] = useState(false)
  // What was answered stays in the thread until the transcript itself moves on (finish review #6).
  const [receipt, setReceipt] = useState<{ pendingId: string; text: string; at: number } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const nodeId = session.id

  async function load() {
    const rpc = connection.rpc
    if (!rpc) return
    const [p, s] = await Promise.allSettled([
      rpc.request<{ page: ChatPage }>('chat.page', { nodeId }, 20_000),
      rpc.request<{ status: ChatStatus }>('chat.status', { nodeId })
    ])
    if (p.status === 'fulfilled') {
      setPage(p.value.page)
      setError(null)
    } else setError((p.reason as Error).message)
    if (s.status === 'fulfilled') setStatus(s.value.status)
  }

  useEffect(() => {
    void load()
    const t = setInterval(() => document.visibilityState === 'visible' && void load(), 2000)
    return () => clearInterval(t)
  }, [nodeId])

  const count = page?.messages.length ?? 0
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [count, status?.held?.pendingId])

  async function answer(body: Record<string, unknown>, label: string) {
    if (!status?.held || !connection.rpc) return false
    const pendingId = status.held.pendingId
    try {
      const r = await connection.rpc.request<{ ok: boolean }>('agent.answer', { nodeId, pendingId, answer: body })
      if (r.ok) setReceipt({ pendingId, text: label, at: Date.now() })
      void load()
      void refreshProjects()
      return r.ok
    } catch {
      return false
    }
  }

  async function send() {
    const text = draft.trim()
    if (!text || !connection.rpc || sending) return
    setSending(true)
    setSendNote(null)
    try {
      const r = await connection.rpc.request<{ result: string; reason?: string }>('chat.send', { nodeId, text: draft }, 30_000)
      if (r.result === 'sent') {
        setDraft('')
        setSendNote(null)
      } else if (r.result === 'refused') {
        setSendNote({ kind: 'refused', text: `Not sent. ${REASONS[r.reason ?? ''] ?? ''}`.trim() })
      } else if (r.result === 'pasted-not-submitted') {
        setSendNote({ kind: 'unconfirmed', text: 'Typed into the terminal but not submitted. Check the Terminal tab.' })
      } else {
        // 'unconfirmed' or anything newer: it may or may not have been typed. Never resend on our own.
        setSendNote({ kind: 'unconfirmed', text: "The Mac couldn't confirm this was sent. Check the chat before sending again." })
      }
    } catch (e) {
      setSendNote(
        e instanceof RpcError && e.code === 'refused'
          ? { kind: 'refused', text: `Not sent. ${e.message}` }
          : { kind: 'unconfirmed', text: 'The connection dropped while sending. Check the chat before sending again.' }
      )
    } finally {
      setSending(false)
      void load()
    }
  }

  const lock = lockReason(status)
  const held = status?.held ?? null

  return (
    <>
      <div class="scroll chat-scroll" ref={scroller}>
        <div class="thread">
          {error && !page ? <p class="chat-note">{error}</p> : null}
          {page && !page.found ? <p class="chat-note">No conversation on the Mac for this session yet.</p> : null}
          {page?.olderCursor !== null && page?.messages.length ? <p class="chat-note">Earlier messages are on the Mac.</p> : null}
          {page?.messages.map((m, i) => <Msg key={m.key ?? i} m={m} last={i === page.messages.length - 1} model={page.model} />)}
          {receipt && held?.pendingId !== receipt.pendingId ? (
            <div class="receipt"><Icon name="check" small /><span><b>{receipt.text}</b> · {rel(receipt.at)}</span></div>
          ) : null}
          {held ? <AskCard held={held} page={page} structured={status!.structuredAnswers} designator={session.designator} onAnswer={answer} nodeId={nodeId} /> : null}
          {status?.state === 'working' && !held ? (
            <div class="working-row">
              <span class="state working"><i class="dot" /></span>
              {session.agent ?? 'The agent'} is working…
            </div>
          ) : null}
        </div>
      </div>
      {sendNote ? <div class={`send-note ${sendNote.kind}`}>{sendNote.text}</div> : null}
      <div class="composer">
        {lock ? (
          <div class="lock">
            <Icon name="lock" small />
            {lock}
          </div>
        ) : (
          <textarea
            class="field"
            rows={1}
            placeholder={`Message ${session.agent ?? 'the agent'}`}
            value={draft}
            onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
            maxLength={64000}
          />
        )}
        <button class="send" disabled={!!lock || !draft.trim() || sending} aria-label="Send" onClick={() => void send()}>
          <Icon name="send" />
        </button>
      </div>
    </>
  )
}

function Msg({ m, last, model }: { m: Message; last: boolean; model?: string }) {
  if (m.role === 'user') {
    const text = m.parts.filter((p) => p.kind === 'text').map((p) => (p as { text: string }).text).join('\n')
    return text.trim() ? <div class="msg-user">{text}</div> : null
  }
  const tools = m.parts.filter((p): p is Extract<Part, { kind: 'tool' }> => p.kind === 'tool' && p.name !== PLAN_TOOL && p.name !== QUESTION_TOOL)
  const texts = m.parts.filter((p) => p.kind === 'text') as { text: string }[]
  return (
    <div class="msg-ai">
      {tools.length ? (
        <div class="tools">
          {tools.map((t) => (
            <span class="tool">
              <b>{t.name}</b> <span class="arg">{t.summary?.filePath?.split('/').pop() ?? t.arg.slice(0, 80)}</span>
              {t.summary?.added || t.summary?.removed ? <span class="diff"> +{t.summary.added ?? 0} −{t.summary.removed ?? 0}</span> : null}
            </span>
          ))}
        </div>
      ) : null}
      {texts.map((t) => <Markdown text={t.text} />)}
      {last && m.at ? <span class="when">{rel(m.at)}{model ? ` · ${model}` : ''}</span> : null}
    </div>
  )
}

function AskCard(props: {
  held: NonNullable<ChatStatus['held']>
  page: ChatPage | null
  structured: boolean
  designator: string
  nodeId: string
  onAnswer: (a: Record<string, unknown>, label: string) => Promise<boolean>
}) {
  const { held, page, structured } = props
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle')
  const [revise, setRevise] = useState<string | null>(null)
  const [picks, setPicks] = useState<Record<string, string[]>>({})
  const go = async (a: Record<string, unknown>, label: string) => {
    setState('sending')
    setState((await props.onAnswer(a, label)) ? 'done' : 'failed')
  }
  const busy = state === 'sending'
  const say = (t: string) => (busy ? 'Sending…' : t)
  const terminalOnly = (
    <div class="body">
      This request can only be answered in the terminal (the Mac's hook script is older than structured answers).
      <div class="actions" style={{ padding: '10px 0 0' }}>
        <a class="btn quiet block" href={href.session(props.nodeId, 'term')}>Answer in the terminal</a>
      </div>
    </div>
  )
  if (state === 'done') return null
  const failed = state === 'failed' ? <p class="ask-fail">The Mac didn't accept that answer. It may already be answered: check the terminal.</p> : null

  if (held.toolName === PLAN_TOOL) {
    const plan = lastTool(page, PLAN_TOOL)
    return (
      <div class="ask">
        <h3>Approve this plan?</h3>
        <div class="body"><Markdown text={plan?.body ?? plan?.arg ?? 'The plan is in the terminal.'} /></div>
        {failed}
        {!structured ? terminalOnly : revise !== null ? (
          <div class="actions">
            <textarea class="field revise" rows={3} placeholder="What should change?" value={revise} onInput={(e) => setRevise((e.target as HTMLTextAreaElement).value)} />
            <div class="actions two" style={{ padding: 0 }}>
              <button class="btn quiet" onClick={() => setRevise(null)}>Back</button>
              <button class="btn answer" disabled={!revise.trim() || state === 'sending'} onClick={() => void go({ kind: 'plan-revise', message: revise.slice(0, 8000) }, 'Sent a revision')}>{say('Send revision')}</button>
            </div>
          </div>
        ) : (
          <div class="actions">
            <button class="btn answer block" disabled={busy} onClick={() => void go({ kind: 'plan', mode: 'restore' }, 'Approved · keep current mode')}>{say('Approve · keep current mode')}</button>
            <div class="actions two" style={{ padding: 0 }}>
              <button class="btn quiet" disabled={busy} onClick={() => void go({ kind: 'plan', mode: 'acceptEdits' }, 'Approved · accept edits')}>Accept edits</button>
              <button class="btn quiet" disabled={busy} onClick={() => void go({ kind: 'plan', mode: 'manual' }, 'Approved · ask before edits')}>Ask before edits</button>
            </div>
            <button class="btn quiet block" onClick={() => setRevise('')}>Revise…</button>
          </div>
        )}
      </div>
    )
  }

  if (held.toolName === QUESTION_TOOL) {
    const tool = lastTool(page, QUESTION_TOOL)
    const qs = (tool?.questions ?? []).filter((q) => !held.questions || held.questions.includes(q.question))
    const complete = qs.length > 0 && qs.every((q) => (picks[q.question] ?? []).length > 0)
    return (
      <div class="ask">
        {!structured || qs.length === 0 ? (
          <>
            {tool?.body ? <div class="body"><Markdown text={tool.body} /></div> : null}
            {terminalOnly}
          </>
        ) : (
          <>
            {qs.map((q) => (
              <>
                <h3>{q.question}</h3>
                <div class="opts" role="group" aria-label={q.question}>
                  {q.options.map((o) => {
                    const on = (picks[q.question] ?? []).includes(o.label)
                    return (
                      <button
                        class="chip"
                        aria-pressed={on}
                        title={o.description}
                        onClick={() =>
                          setPicks((p) => {
                            const cur = p[q.question] ?? []
                            const next = q.multiSelect ? (on ? cur.filter((x) => x !== o.label) : [...cur, o.label]) : [o.label]
                            return { ...p, [q.question]: next }
                          })
                        }
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </>
            ))}
            {failed}
            <div class="actions">
              <button
                class="btn answer block"
                disabled={!complete || busy}
                onClick={() =>
                  void go(
                    {
                      kind: 'question',
                      answers: Object.fromEntries(qs.map((q) => [q.question, q.multiSelect ? picks[q.question]! : picks[q.question]![0]!]))
                    },
                    `Answered: ${qs.map((q) => (picks[q.question] ?? []).join(', ')).join(' / ')}`
                  )
                }
              >
                {say('Send answer')}
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  const tool = lastTool(page, held.toolName)
  return (
    <div class="ask">
      <h3>Allow {held.toolName}?</h3>
      {tool?.arg ? <div class="body"><div class="cmd">{tool.arg}</div></div> : null}
      {failed}
      <div class="actions two">
        <button class="btn quiet" disabled={busy} onClick={() => void go({ kind: 'deny' }, 'Denied')}>Deny</button>
        <button class="btn answer" disabled={busy} onClick={() => void go({ kind: 'allow' }, 'Allowed once')}>{say('Allow once')}</button>
      </div>
    </div>
  )
}
