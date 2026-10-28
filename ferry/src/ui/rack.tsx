// The Rack: every project shelf with its slots; needs-you sessions push a tab out past the right edge.
import { connection, ago, href, useLink, useSnapshot, type Route } from '../state'
import { counts, type Session } from '../relay/projects'
import { Icon } from './icons'

const TAB_LABEL = { plan: 'Plan', ask: 'Ask', allow: 'Allow?', needs: 'You' } as const

export function StateLine({ s, short }: { s: Session; short?: boolean }) {
  if (s.state === 'working' && short) return <span class="state working"><i class="dot" />{s.stale ? 'Working?' : 'Working'}</span>
  if (s.state === 'working')
    return (
      <span class="state working">
        <i class="dot" />
        {s.stale ? 'Working?' : 'Working'}
        {s.since ? <> · <span class="tnum">{ago(s.since)}</span></> : null}
      </span>
    )
  if (s.state === 'done') return <span class="state"><i class="dot" />Done{s.since ? ` · ${ago(s.since)}` : ''}</span>
  if (s.state === 'asleep') return <span class="state asleep"><i class="dot" />Asleep</span>
  return <span class="state idle"><i class="dot" />Idle</span>
}

/** Working time as length: a full rule is 30 minutes. */
const durWidth = (since: number | null) => (since ? Math.min(100, Math.max(4, ((Date.now() - since) / 1_800_000) * 100)) : 4)

export function Row({ s }: { s: Session }) {
  const flagged = s.state === 'needs' || s.unread
  return (
    <a class={`row${flagged ? ' needs' : ''}`} href={href.session(s.id)}>
      <span class="plate">{s.designator}</span>
      <span class="title">{s.title}</span>
      {flagged ? null : (
        <span class="meta">
          <StateLine s={s} short />
        </span>
      )}
      <span class="sub">{s.agent ? `${s.agent} · ${s.line}` : s.line}</span>
      {s.state === 'working' ? (
        <span class={`dur${s.stale ? ' stale' : ''}`} style={{ '--w': `${durWidth(s.since)}%` }}>
          {s.since ? <span class="dur-t tnum">{ago(s.since)}</span> : null}
        </span>
      ) : null}
      {s.state === 'needs' ? <span class="tab">{TAB_LABEL[s.ask ?? 'needs']}</span> : s.unread ? <span class="tab done">New</span> : null}
    </a>
  )
}

export function TabBar({ on, needs }: { on: 'rack' | 'board' | 'mac'; needs: number }) {
  return (
    <nav class="tabbar">
      <a href={href.rack()} aria-current={on === 'rack' ? 'page' : undefined}>
        <Icon name="rack" />
        Sessions
        {needs ? <span class="count">{needs}</span> : null}
      </a>
      <a href={href.board()} aria-current={on === 'board' ? 'page' : undefined}>
        <Icon name="board" />
        Board
      </a>
      <a href={href.mac()} aria-current={on === 'mac' ? 'page' : undefined}>
        <Icon name="mac" />
        Mac
      </a>
    </nav>
  )
}

/** One line under the header whenever the link is anything but live: state is never shown as current
 *  when it is not. */
export function LinkBanner() {
  const link = useLink()
  if (link.kind === 'live' || link.kind === 'loading') return null
  const text =
    link.kind === 'connecting'
      ? link.step === 'token'
        ? 'Getting a relay pass…'
        : link.step === 'relay'
          ? 'Reaching the Mac through the relay…'
          : 'Checking this phone is approved…'
      : link.kind === 'offline'
        ? link.reason
        : link.kind === 'denied'
          ? link.reason
          : link.kind === 'approval'
            ? 'Waiting for approval on the Mac.'
            : ''
  return (
    <div class={`banner ${link.kind}`} role="status">
      {link.kind === 'connecting' ? <span class="state working"><i class="dot" /></span> : null}
      <span>{text}</span>
      {link.kind === 'offline' || link.kind === 'denied' ? (
        <button class="banner-act" onClick={() => connection.resume()}>
          <Icon name="retry" small />
          Retry
        </button>
      ) : null}
    </div>
  )
}

export function Rack({ route }: { route: Extract<Route, { name: 'rack' }> }) {
  const { snap, at, error } = useSnapshot()
  const link = useLink()
  const c = snap ? counts(snap) : { all: 0, needs: 0, working: 0 }
  const keep = (s: Session) => route.filter === 'all' || (route.filter === 'needs' ? s.state === 'needs' : s.state === 'working')
  const shelves = (snap?.shelves ?? []).map((sh) => ({ ...sh, sessions: sh.sessions.filter(keep) })).filter((sh) => sh.sessions.length)
  const sub =
    link.kind !== 'live'
      ? at ? `Last seen ${ago(at) || 'just now'} ago` : 'Not connected'
      : `Live · ${c.all} session${c.all === 1 ? '' : 's'} in ${snap?.shelves.length ?? 0} projects`

  return (
    <section class="screen on">
      <header class="topbar">
        <h1>
          {connection.host?.label ?? 'Mac'}
          <small>
            <span class={`link-state${link.kind === 'live' ? '' : ' off'}`}>
              <i />
              {sub}
            </span>
          </small>
        </h1>
      </header>
      <div class="filters">
        <div class="seg" role="tablist">
          {(['all', 'needs', 'working'] as const).map((f) => (
            <a role="tab" href={href.rack(f)} aria-selected={route.filter === f}>
              {f === 'all' ? 'All' : f === 'needs' ? 'Need you' : 'Working'} <span>{f === 'all' ? c.all : f === 'needs' ? c.needs : c.working}</span>
            </a>
          ))}
        </div>
      </div>
      <LinkBanner />
      <div class="scroll rack-scroll">
        {!snap ? (
          <Empty title={error ? "Couldn't load the sessions." : 'Loading sessions…'} body={error ?? undefined} />
        ) : shelves.length === 0 ? (
          <Empty
            title={route.filter === 'needs' ? 'Nothing is waiting on you.' : route.filter === 'working' ? 'No agent is working right now.' : 'No sessions on this Mac yet.'}
          />
        ) : (
          shelves.map((sh) => (
            <>
              <div class="shelf">
                <h2>{sh.name}</h2>
                <span class="path">{sh.path.replace(/^\/Users\/[^/]+/, '~')}</span>
                <span class="grow" />
                {sh.kanban ? <a class="more" href={href.board(sh.id)}>Board</a> : null}
              </div>
              <div class="slots">
                {sh.sessions.map((s) => (
                  <Row key={s.id} s={s} />
                ))}
              </div>
            </>
          ))
        )}
      </div>
      <TabBar on="rack" needs={c.needs} />
    </section>
  )
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div class="empty">
      <p class="empty-title">{title}</p>
      {body ? <p>{body}</p> : null}
    </div>
  )
}
