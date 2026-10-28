// A project's kanban board: columns from project.kanban, one card per session, swipe between columns.
// Moving a card is `projects.setCardColumn`; a project with no board can be given the default one
// (`projects.ensureBoard`, idempotent on the Mac).
import { useState } from 'preact/hooks'
import { connection, href, refreshProjects, useSnapshot } from '../state'
import { counts } from '../relay/projects'
import { Icon } from './icons'
import { Empty, StatusBanners, StateLine, TabBar } from './rack'

const UNGROUPED = { id: '', title: 'Ungrouped', color: '#8a978f' }

export function BoardScreen({ projectId }: { projectId: string | null }) {
  const { snap } = useSnapshot()
  const shelves = snap?.shelves ?? []
  const shelf = shelves.find((s) => s.id === projectId) ?? shelves.find((s) => s.kanban) ?? shelves[0] ?? null
  const [moving, setMoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function move(nodeId: string, columnId: string) {
    if (!shelf || !connection.rpc) return
    setMoving(null)
    try {
      const r = await connection.rpc.request<{ moved: boolean }>('projects.setCardColumn', { projectId: shelf.id, nodeId, columnId: columnId || null })
      setError(r.moved ? null : "The Mac didn't move that card. The board may have changed.")
    } catch (e) {
      setError((e as Error).message)
    }
    void refreshProjects()
  }

  async function ensure() {
    if (!shelf || !connection.rpc) return
    await connection.rpc.request('projects.ensureBoard', { projectId: shelf.id }).catch((e) => setError((e as Error).message))
    void refreshProjects()
  }

  const columns = shelf?.kanban ? [...(shelf.sessions.some((s) => !shelf.kanban!.assignments[s.id]) ? [UNGROUPED] : []), ...shelf.kanban.columns] : []
  return (
    <section class="screen on">
      <header class="topbar">
        <h1>
          Board
          <small>{shelf?.kanban ? `${shelf.kanban.columns.length} columns · swipe across` : shelf?.name ?? ''}</small>
        </h1>
        {shelves.length > 1 ? (
          <select class="project-pick" aria-label="Project" value={shelf?.id} onChange={(e) => (location.hash = href.board((e.target as HTMLSelectElement).value))}>
            {shelves.map((s) => (
              <option value={s.id}>{s.name}</option>
            ))}
          </select>
        ) : null}
      </header>
      <StatusBanners />
      {error ? <div class="send-note refused">{error}</div> : null}
      {!shelf ? (
        <div class="scroll" style={{ flex: 1 }}><Empty title="No projects yet." /></div>
      ) : !shelf.kanban ? (
        <div class="scroll" style={{ flex: 1 }}>
          <Empty title="This project has no board yet." />
          <div style={{ padding: '0 24px' }}>
            <button class="btn primary block" onClick={() => void ensure()}>Add the default board</button>
          </div>
        </div>
      ) : (
        <div class="board">
          {columns.map((c) => {
            const cards = shelf.sessions.filter((s) => (shelf.kanban!.assignments[s.id] ?? '') === c.id)
            return (
              <section class="col">
                <h3>
                  <i style={{ '--c': c.color }} />
                  {c.title} <span>{cards.length}</span>
                </h3>
                {cards.map((s) => (
                  <div class={`card${s.state === 'needs' || s.unread ? ' needs' : ''}`}>
                    <span class="plate">{s.designator}</span>
                    <a class="title" href={href.session(s.id)}>{s.title}</a>
                    <span class="sub">
                      {s.state === 'needs' ? `${s.agent ?? 'Agent'} · waiting on you` : <StateLine s={s} />}
                      <button class="card-move" aria-expanded={moving === s.id} onClick={() => setMoving(moving === s.id ? null : s.id)}>
                        Move <Icon name="down" small />
                      </button>
                    </span>
                    {moving === s.id ? (
                      <div class="move-to">
                        {shelf.kanban!.columns.filter((x) => x.id !== c.id).map((x) => (
                          <button class="chip" onClick={() => void move(s.id, x.id)}>{x.title}</button>
                        ))}
                      </div>
                    ) : null}
                    {s.state === 'needs' ? <span class="tab">{s.ask === 'plan' ? 'Plan' : s.ask === 'ask' ? 'Ask' : 'Allow?'}</span> : s.unread ? <span class="tab done">New</span> : null}
                  </div>
                ))}
              </section>
            )
          })}
        </div>
      )}
      <TabBar on="board" needs={snap ? counts(snap).needs : 0} />
    </section>
  )
}
