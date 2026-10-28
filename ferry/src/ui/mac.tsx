import { connection, useLink, useSnapshot, useTheme } from '../state'
import { counts } from '../relay/projects'
import { Icon } from './icons'
import { useState } from 'preact/hooks'
import { APP_VERSION, applyUpdate, checkForUpdate, useUpdateReady } from '../update'
import { StatusBanners, TabBar } from './rack'

const short = (b64: string) => `${b64.slice(0, 4)}…${b64.slice(-5)}`

export function MacScreen() {
  const link = useLink()
  const { snap } = useSnapshot()
  const [theme, setTheme] = useTheme()
  const host = connection.host
  const linkText =
    link.kind === 'live' ? 'Live, end-to-end encrypted' : link.kind === 'offline' ? 'Offline' : link.kind === 'denied' ? 'Not connected' : 'Connecting…'
  return (
    <section class="screen on">
      <header class="topbar">
        <h1>
          Mac<small>Connection and pairing</small>
        </h1>
      </header>
      <StatusBanners />
      <div class="scroll mac-sheet">
        <div class="mac-card">
          <span class="plate lg">MAC</span>
          <strong>{host?.label ?? 'Mac'}</strong>
          <span class="k">{host ? new URL(host.relayEndpoint).host : ''}</span>
        </div>
        <dl class="facts">
          <div>
            <dt>Link</dt>
            <dd>
              <span class={`live-dot${link.kind === 'live' ? '' : ' off'}`}><i />{linkText}</span>
            </dd>
          </div>
          {link.kind === 'live' && link.sas ? (
            <div>
              <dt>Session code</dt>
              <dd class="tnum">{link.sas}</dd>
            </div>
          ) : null}
          {host ? (
            <div>
              <dt>Mac key</dt>
              <dd><code>{short(host.hostPublicKeyB64)}</code></dd>
            </div>
          ) : null}
          <div>
            <dt>Notifications</dt>
            <dd>Need a Mac update (D1)</dd>
          </div>
          <div>
            <dt>App version</dt>
            <dd class="tnum">{APP_VERSION}</dd>
          </div>
          <div>
            <dt>Updates</dt>
            <dd><UpdateCheck /></dd>
          </div>
          <div>
            <dt>Appearance</dt>
            <dd>
              <select aria-label="Appearance" value={theme} onChange={(e) => setTheme((e.target as HTMLSelectElement).value as 'system')}>
                <option value="system">Match the phone</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </dd>
          </div>
        </dl>
        <button class="btn quiet block" onClick={() => connection.resume()}>
          <Icon name="retry" small />
          Reconnect
        </button>
        <button
          class="btn quiet block danger"
          onClick={() => {
            if (confirm(`Forget ${host?.label ?? 'this Mac'}? You'll pair again and approve it on the Mac.`)) void connection.forget()
          }}
        >
          Forget this Mac
        </button>
        <p class="fine">
          Removing a phone in the Mac's Phone settings removes this app too. Nothing about your Mac passes through this app's
          server: it only hands out relay passes.
        </p>
      </div>
      <TabBar on="mac" needs={snap ? counts(snap).needs : 0} />
    </section>
  )
}

function UpdateCheck() {
  const ready = useUpdateReady()
  const [state, setState] = useState<'idle' | 'checking' | 'latest' | 'updating'>('idle')
  if (ready || state === 'updating')
    return (
      <button class="link-btn" disabled={state === 'updating'} onClick={() => (setState('updating'), void applyUpdate())}>
        {state === 'updating' ? 'Updating…' : 'Reload to update'}
      </button>
    )
  return (
    <button
      class="link-btn"
      disabled={state === 'checking'}
      onClick={async () => {
        setState('checking')
        setState((await checkForUpdate()) ? 'idle' : 'latest')
      }}
    >
      {state === 'checking' ? 'Checking…' : state === 'latest' ? 'Up to date · check again' : 'Check for updates'}
    </button>
  )
}
