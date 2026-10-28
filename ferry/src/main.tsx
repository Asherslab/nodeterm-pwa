import { render } from 'preact'
import './world.css'
import './app.css'
import { App } from './app'
import { applyTheme, connection } from './state'
import { registerUpdates } from './update'

applyTheme()
render(<App />, document.getElementById('root')!)
if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) void import('./dev/demo').then((m) => m.startDemo())
else void connection.start()

if (import.meta.env.PROD) registerUpdates()
