import { findSession, href, useSnapshot } from '../state'
import { Icon } from './icons'
import { Chat } from './chat'
import { useEffect, useState } from 'preact/hooks'
import type { Session } from '../relay/projects'
import { LinkBanner, Empty } from './rack'

export function SessionScreen({ id, mode }: { id: string; mode: 'chat' | 'term' }) {
  const { snap } = useSnapshot()
  const s = findSession(snap, id)
  const project = snap?.shelves.find((sh) => sh.id === s?.projectId)
  const sub = s ? [s.agent ?? 'Shell', project?.name, s.state === 'needs' ? 'waiting on you' : s.state === 'working' ? 'working' : null].filter(Boolean).join(' · ') : ''
  return (
    <section class="screen on">
      <header class="topbar sess-head">
        <div class="line">
          <a class="icon-btn" href={href.rack()} aria-label="Back to sessions">
            <Icon name="back" />
          </a>
          {s ? <span class="plate lg">{s.designator}</span> : null}
          <h1>
            {s?.title ?? 'Session'}
            <small>{sub}</small>
          </h1>
        </div>
        <div class="seg" role="tablist">
          <a role="tab" href={href.session(id, 'chat')} aria-selected={mode === 'chat'}>
            <Icon name="chat" small />
            Chat
          </a>
          <a role="tab" href={href.session(id, 'term')} aria-selected={mode === 'term'}>
            <Icon name="term" small />
            Terminal
          </a>
        </div>
      </header>
      <LinkBanner />
      {!s ? (
        <div class="scroll" style={{ flex: 1 }}>
          <Empty title={snap ? 'This session is no longer on the Mac.' : 'Loading…'} />
        </div>
      ) : mode === 'chat' ? (
        <Chat session={s} />
      ) : (
        <LazyTerminal session={s} />
      )}
    </section>
  )
}

/** xterm.js is most of the bundle; it loads the first time a terminal opens. */
function LazyTerminal({ session }: { session: Session }) {
  const [T, setT] = useState<null | ((p: { session: Session }) => preact.JSX.Element)>(null)
  useEffect(() => {
    void import('./terminal').then((m) => setT(() => m.Terminal))
  }, [])
  return T ? <T session={session} /> : <div class="term-note">Loading the terminal…</div>
}
