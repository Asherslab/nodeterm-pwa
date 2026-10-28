// The Terminal side of a session: xterm.js attached to the node's tmux session over `pty.attach`.
// The attach answers with a streamId, then the host sends the current screen as a snapshot (raw tmux
// capture, LF line endings, painted into an empty emulator) and then live output. Input and resize go
// back as OP.Input / OP.Resize frames. History scroll belongs to tmux: a vertical swipe sends
// `pty.scroll`, unless the host said this pane has no tmux in front (`scroll:'local'`).
import { useEffect, useRef, useState } from 'preact/hooks'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { connection } from '../state'
import { RpcError } from '../relay/rpc'
import type { Session } from '../relay/projects'

const KEYS: { label: string; seq: string }[] = [
  { label: 'esc', seq: '\x1b' },
  { label: '1', seq: '1' },
  { label: '2', seq: '2' },
  { label: '3', seq: '3' },
  { label: 'enter', seq: '\r' },
  { label: 'tab', seq: '\t' },
  { label: '⇧tab', seq: '\x1b[Z' },
  { label: '↑', seq: '\x1b[A' },
  { label: '↓', seq: '\x1b[B' },
  { label: '←', seq: '\x1b[D' },
  { label: '→', seq: '\x1b[C' },
  { label: '^C', seq: '\x03' }
]

export function Terminal({ session }: { session: Session }) {
  const host = useRef<HTMLDivElement>(null)
  const stream = useRef<number | null>(null)
  const [note, setNote] = useState<string | null>('Attaching…')
  const [ctrl, setCtrl] = useState(false)
  const ctrlRef = useRef(false)
  ctrlRef.current = ctrl

  useEffect(() => {
    const rpc = connection.rpc
    const el = host.current
    if (!rpc || !el) return
    const dark = getComputedStyle(document.documentElement)
    const term = new XTerm({
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: 12,
      cursorBlink: true,
      scrollback: 0, // history lives in tmux
      theme: { background: dark.getPropertyValue('--term-bg').trim() || '#12191a', foreground: '#d7e2dc', cursor: '#d7e2dc', selectionBackground: '#2f7d6e80' }
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(el)
    fit.fit()
    let cancelled = false
    let localScroll = false

    term.onData((d) => {
      const id = stream.current
      if (id === null) return
      let data = d
      if (ctrlRef.current && d.length === 1 && /[a-z@[\\\]^_]/i.test(d)) {
        data = String.fromCharCode(d.toUpperCase().charCodeAt(0) & 0x1f)
        setCtrl(false)
      }
      rpc.input(id, data)
    })
    term.onResize(({ cols, rows }) => stream.current !== null && rpc.resize(stream.current, cols, rows))

    void rpc
      .request<{ streamId: number; fresh: boolean; scroll?: 'local' }>('pty.attach', { nodeId: session.id, cols: term.cols, rows: term.rows, projectId: session.projectId }, 20_000)
      .then((r) => {
        if (cancelled) return void rpc.request('pty.kill', { streamId: r.streamId }).catch(() => {})
        stream.current = r.streamId
        localScroll = r.scroll === 'local'
        setNote(r.fresh ? 'This session was not running, so the Mac started a new shell for it.' : null)
        rpc.bindStream(r.streamId, {
          onSnapshot: (text) => term.write(text.replace(/\r?\n/g, '\r\n')),
          onOutput: (d) => term.write(d),
          onExit: (code) => {
            stream.current = null
            setNote(code === -1 ? 'Disconnected from the Mac.' : 'The session ended.')
          }
        })
      })
      .catch((e) => setNote(e instanceof RpcError ? e.message : "Couldn't attach to this session."))

    // Vertical swipes scroll tmux history (the emulator itself has none).
    let lastY: number | null = null
    let acc = 0
    const onStart = (e: TouchEvent) => ((lastY = e.touches[0]?.clientY ?? null), (acc = 0))
    const onMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY
      if (lastY === null || y === undefined || stream.current === null || localScroll) return
      acc += y - lastY
      lastY = y
      const lines = Math.trunc(acc / 18)
      if (lines !== 0) {
        acc -= lines * 18
        void rpc.request('pty.scroll', { streamId: stream.current, dir: lines > 0 ? 'up' : 'down', lines: Math.min(20, Math.abs(lines)) }).catch(() => {})
      }
      e.preventDefault()
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    const ro = new ResizeObserver(() => fit.fit())
    ro.observe(el)

    return () => {
      cancelled = true
      ro.disconnect()
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      const id = stream.current
      stream.current = null
      if (id !== null) {
        rpc.unbindStream(id)
        void rpc.request('pty.kill', { streamId: id }).catch(() => {}) // detach only: tmux keeps running
      }
      term.dispose()
    }
  }, [session.id])

  const press = (seq: string) => stream.current !== null && connection.rpc?.input(stream.current, seq)

  return (
    <>
      {note ? <div class="term-note">{note}</div> : null}
      <div class="term" ref={host} />
      <div class="keys" role="toolbar" aria-label="Terminal keys">
        <button class={ctrl ? 'on' : ''} aria-pressed={ctrl} onClick={() => setCtrl(!ctrl)}>ctrl</button>
        {KEYS.map((k) => (
          <button onClick={() => press(k.seq)}>{k.label}</button>
        ))}
      </div>
    </>
  )
}
