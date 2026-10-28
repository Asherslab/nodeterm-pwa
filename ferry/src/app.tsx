import { connection, useLink, useRoute } from './state'
import { Rack } from './ui/rack'
import { SessionScreen } from './ui/session'
import { BoardScreen } from './ui/board'
import { MacScreen } from './ui/mac'
import { PairScreen } from './ui/pair'

export function App() {
  const link = useLink()
  const route = useRoute()
  if (link.kind === 'loading') return <div class="app splash" aria-busy="true" />
  // Until the Mac has approved this device once, everything is the pairing flow.
  if (link.kind === 'unpaired' || !connection.approved) {
    return (
      <div class="app">
        <PairScreen />
      </div>
    )
  }
  return (
    <div class="app">
      {route.name === 'session' ? (
        <SessionScreen key={`${route.id}/${route.mode}`} id={route.id} mode={route.mode} />
      ) : route.name === 'board' ? (
        <BoardScreen projectId={route.projectId} />
      ) : route.name === 'mac' ? (
        <MacScreen />
      ) : (
        <Rack route={route} />
      )}
    </div>
  )
}
