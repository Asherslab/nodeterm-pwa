// Pairing: instructions → scan or paste the code → compare the ten-digit code while the Mac's dialog
// waits → approved. The code is the Mac's public relay identity (relay.paircode.ts); approval happens
// ON THE MAC, by the human comparing the same SAS there.
import { useEffect, useRef, useState } from 'preact/hooks'
import { connection, useLink } from '../state'
import { decodePairCode } from '../relay/paircode'
import { Icon } from './icons'
import { UpdateBanner } from './rack'

const SAS_HINT = 'Compare all ten digits. If the other device shows only six, it runs an older version: compare the first six.'

export function PairScreen() {
  const link = useLink()
  const [step, setStep] = useState<'intro' | 'scan' | 'paste'>('intro')
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')

  async function accept(code: string) {
    setError(null)
    try {
      const host = await decodePairCode(code)
      await connection.pair(host)
    } catch (e) {
      setError((e as Error).message)
      setStep('paste')
    }
  }

  if (link.kind === 'approval' || (link.kind === 'connecting' && connection.host)) {
    return (
      <section class="screen on">
        <header class="topbar"><h1>Compare</h1></header>
        <div class="pair scroll">
          <h2>Does your Mac show this number?</h2>
          {link.kind === 'approval' ? (
            <div class="sas tnum" aria-label={`Code ${link.sas}`}>
              {link.sas.slice(0, 7)} <span>{link.sas.slice(8)}</span>
            </div>
          ) : (
            <div class="sas pending">··· ··· ····</div>
          )}
          <p class="hint">
            {SAS_HINT} If it matches, press <strong>Approve</strong> on {connection.host?.label ?? 'the Mac'}.
          </p>
          <div class="grow" />
          <div class="waiting">
            <span class="state working"><i class="dot" /></span>
            {link.kind === 'approval' ? 'Waiting for approval on the Mac…' : 'Reaching the Mac…'}
          </div>
          <button class="btn quiet block" onClick={() => void connection.forget()}>They don't match: cancel</button>
        </div>
      </section>
    )
  }

  if (link.kind === 'denied' && connection.host) {
    return (
      <section class="screen on">
        <header class="topbar"><h1>Not paired</h1></header>
        <div class="pair">
          <h2>{link.reason}</h2>
          <div class="grow" />
          <button class="btn primary block" onClick={() => connection.resume()}>Try again</button>
          <button class="btn quiet block" onClick={() => void connection.forget()}>Start over with a new code</button>
        </div>
      </section>
    )
  }

  if (step === 'scan') return <Scan onCode={(c) => void accept(c)} onCancel={() => setStep('intro')} onError={(m) => (setError(m), setStep('paste'))} />

  return (
    <section class="screen on">
      <header class="topbar">
        {step === 'paste' ? (
          <button class="icon-btn" aria-label="Back" onClick={() => setStep('intro')}><Icon name="back" /></button>
        ) : null}
        <h1>{step === 'paste' ? 'Paste the code' : 'Pair a Mac'}</h1>
      </header>
      <UpdateBanner />
      <div class="pair scroll">
        {step === 'intro' ? (
          <>
            <h2>Reach your Mac from anywhere.</h2>
            <p>This app talks to nodeterm on your Mac through an end-to-end encrypted relay. No shared Wi-Fi, no IP addresses.</p>
            <ol class="steps">
              <li><b>1</b><span>On the Mac, turn on <em>Settings → Phone → Reach this Mac from anywhere</em>.</span></li>
              <li><b>2</b><span>In a terminal there, run <code>scripts/pair-code.sh</code> from this app's repo. It shows a QR code.</span></li>
              <li><b>3</b><span>Scan it here, then compare a ten-digit number on both screens.</span></li>
            </ol>
            {isStandalone() ? null : (
              <p class="fine">Add this app to your Home Screen first (Share → Add to Home Screen): iOS keeps an installed app's pairing, but may clear a browser tab's.</p>
            )}
          </>
        ) : (
          <>
            <p>Paste the code that starts with <code>ntpwa1:</code>, or the contents of <code>~/.nodeterm/relay.json</code>.</p>
            <textarea class="field code-input" rows={5} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} autocapitalize="off" autocorrect="off" spellcheck={false} />
          </>
        )}
        {error ? <p class="pair-error" role="alert">{error}</p> : null}
        <div class="grow" />
        {step === 'intro' ? (
          <>
            <button class="btn primary block" onClick={() => setStep('scan')}><Icon name="scan" />Scan the code</button>
            <button class="btn quiet block" onClick={() => setStep('paste')}><Icon name="paste" />Paste it instead</button>
          </>
        ) : (
          <button class="btn primary block" disabled={!text.trim()} onClick={() => void accept(text)}>Connect</button>
        )}
      </div>
    </section>
  )
}

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

function Scan({ onCode, onCancel, onError }: { onCode(c: string): void; onCancel(): void; onError(m: string): void }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    let stream: MediaStream | null = null
    let raf = 0
    let done = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const decoder = import('jsqr').then((m) => m.default)
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (s) => {
        const jsQR = await decoder
        stream = s
        const v = video.current!
        v.srcObject = s
        void v.play()
        const tick = () => {
          if (done) return
          if (v.readyState >= 2 && v.videoWidth) {
            canvas.width = v.videoWidth
            canvas.height = v.videoHeight
            ctx.drawImage(v, 0, 0)
            const hit = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' })
            if (hit?.data) {
              done = true
              onCode(hit.data)
              return
            }
          }
          raf = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch(() => onError("The camera isn't available. Paste the code instead."))
    if (!navigator.mediaDevices) onError("The camera isn't available here. Paste the code instead.")
    return () => {
      done = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])
  return (
    <section class="screen on">
      <header class="topbar">
        <button class="icon-btn" aria-label="Back" onClick={onCancel}><Icon name="back" /></button>
        <h1>Scan</h1>
      </header>
      <div class="pair">
        <div class="viewfinder">
          <video ref={video} playsInline muted />
          <div class="corners" />
        </div>
        <p class="hint">Point the camera at the code in the Mac's terminal.</p>
      </div>
    </section>
  )
}
