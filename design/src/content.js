// Shared synthetic content + components for the three layout mockups. Nothing here is real data.
const I = {
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
  rack: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 14.5h18M12 4v16"/>',
  board: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
  mac: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  term: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
  paste: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'
}
const ico = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`

const MAC = { name: 'Studio Mac', relay: 'relay.nodeterm.dev', hostId: 'q7Wd0Lr3xKfN2mVb9Tz1aE' }

// state: needs | working | done | idle | asleep ; ask: plan | ask | allow
const PROJECTS = [
  { id: 'pantry', name: 'pantry', path: '~/Git/pantry', sessions: [
    { d: 'PAN·1', t: 'Costco receipt parser', agent: 'Claude', state: 'needs', ask: 'plan', sub: 'Plan ready · 6 steps', age: '2m', col: 'prog' },
    { d: 'PAN·2', t: 'Offline op-log merge', agent: 'Codex', state: 'working', sub: 'Running tests · 214 passed', age: '12m', w: 40, col: 'prog' },
    { d: 'PAN·3', t: 'Shopping list by store', agent: 'Claude', state: 'done', sub: 'Split the list by store and aisle', age: '18m', unread: true, col: 'review' },
    { d: 'PAN·4', t: 'Woolworths price import', agent: 'Claude', state: 'idle', sub: 'Waiting for a prompt', age: '3h', col: 'backlog' }
  ] },
  { id: 'stage', name: 'stage-cues', path: '~/Git/stage-cues', sessions: [
    { d: 'STG·1', t: 'NDI source picker', agent: 'Claude', state: 'needs', ask: 'ask', sub: 'Asks: default camera?', age: '5m', col: 'prog' },
    { d: 'STG·2', t: 'PTZ preset sync', agent: 'Gemini', state: 'asleep', sub: 'Hibernated · resumes on open', age: '1d', col: 'backlog' }
  ] },
  { id: 'fan', name: 'fan-ctl', path: '~/Git/fan-ctl', sessions: [
    { d: 'FAN·1', t: 'PID loop tuning', agent: 'Claude', state: 'needs', ask: 'allow', sub: 'Wants to run pio run -t upload', age: '1m', col: 'prog' },
    { d: 'FAN·2', t: 'BOM cost check', agent: 'Codex', state: 'working', sub: 'Reading jlc-bom.csv', age: '3m', w: 10, col: 'prog' }
  ] },
  { id: 'ferry', name: 'ferry', path: '~/Git/ferry', sessions: [
    { d: 'FRY·1', t: 'Relay handshake tests', agent: 'Claude', state: 'working', sub: 'Context 64% · editing relay.test.ts', age: '27m', w: 90, col: 'prog' },
    { d: 'FRY·2', t: 'Service worker cache', agent: 'Claude', state: 'working', sub: 'Status unknown · last seen 4m ago', age: '4m', w: 14, stale: true, col: 'review' }
  ] }
]
const ALL = PROJECTS.flatMap((p) => p.sessions.map((s) => ({ ...s, project: p.name })))
const NEEDS = ALL.filter((s) => s.state === 'needs')
const TAB_LABEL = { plan: 'Plan', ask: 'Ask', allow: 'Allow?' }

function stateLine(s) {
  if (s.state === 'working') return `<span class="state working"><i class="dot"></i>${s.stale ? 'Working?' : 'Working'} · <span class="tnum">${s.age}</span></span>`
  if (s.state === 'done') return `<span class="state"><i class="dot"></i>Done · ${s.age}</span>`
  if (s.state === 'asleep') return `<span class="state asleep"><i class="dot"></i>Asleep</span>`
  if (s.state === 'idle') return `<span class="state idle"><i class="dot"></i>Idle · ${s.age}</span>`
  return `<span class="state">${s.age} ago</span>`
}
function tab(s) {
  if (s.state === 'needs') return `<span class="tab">${TAB_LABEL[s.ask]}</span>`
  if (s.unread) return `<span class="tab done">New</span>`
  return ''
}
function row(s, go = 'chat') {
  const needs = s.state === 'needs' || s.unread
  return `<button class="row${needs ? ' needs' : ''}" data-go="${go}" data-s="${s.d}">
    <span class="plate">${s.d}</span>
    <span class="title">${s.t}</span>
    ${needs ? '' : `<span class="meta">${stateLine(s)}<span>${s.agent}</span></span>`}
    <span class="sub">${needs ? `${s.agent} · ${s.sub}` : s.sub}</span>
    ${s.state === 'working' ? `<span class="dur${s.stale ? ' stale' : ''}" style="--w:${s.w}%"></span>` : ''}
    ${tab(s)}
  </button>`
}

// ---- answer surfaces --------------------------------------------------------------------
const PLAN = `<div class="ask" data-ask="plan">
  <header>${ico('chat', 'sm')}Plan to approve · PAN·1</header>
  <h3>Costco receipt parser</h3>
  <div class="body fade"><ol>
    <li>Read the PDF text layer with <code>pdfpig</code>; fall back to OCR only for scanned pages.</li>
    <li>Parse line items: item no., description, qty, unit price, <code>GST</code> flag.</li>
    <li>Match the printed total to the cent; flag the receipt if it doesn't.</li>
    <li>Write synthetic fixtures for the three layouts in <code>tests/fixtures</code>.</li>
    <li>Map items to ingredients by item no., then by fuzzy name.</li>
    <li>Run the parser tests and the costing tests.</li>
  </ol></div>
  <div class="actions">
    <button class="btn answer block" data-answer>Approve · keep current mode</button>
    <div class="actions two" style="padding:0">
      <button class="btn quiet" data-answer>Accept edits</button>
      <button class="btn quiet" data-answer>Ask before edits</button>
    </div>
    <button class="btn quiet block">Revise…</button>
  </div>
</div>`
const QUESTION = `<div class="ask" data-ask="ask">
  <header>${ico('chat', 'sm')}Question · STG·1</header>
  <h3>Which source should the picker select when the service starts?</h3>
  <div class="opts">
    <button class="chip" aria-pressed="false" data-pick>Last used</button>
    <button class="chip" aria-pressed="true" data-pick>Stage wide · PTZ 1</button>
    <button class="chip" aria-pressed="false" data-pick>Pulpit · PTZ 2</button>
    <button class="chip" aria-pressed="false" data-pick>Other…</button>
  </div>
  <div class="actions"><button class="btn answer block" data-answer>Send answer</button></div>
</div>`
const ALLOW = `<div class="ask" data-ask="allow">
  <header>${ico('lock', 'sm')}Permission · FAN·1</header>
  <h3>Run a command on the board?</h3>
  <div class="body"><div class="cmd">pio run -t upload --upload-port /dev/cu.usbmodem1101</div>
  Flashes the fan controller over USB. Claude can't undo this.</div>
  <div class="actions two"><button class="btn quiet" data-answer>Deny</button><button class="btn answer" data-answer>Allow once</button></div>
</div>`
const ASKS = { plan: PLAN, ask: QUESTION, allow: ALLOW }

const THREAD = `<div class="thread">
  <div class="msg-user">Parse the Costco receipts in <code>private/receipts</code>. Totals must match to the cent.</div>
  <div class="msg-ai">
    <div class="tools"><span class="tool"><b>Read</b> costco-2026-10-03.pdf</span><span class="tool"><b>Grep</b> "GST" src/</span><span class="tool"><b>Read</b> ReceiptLine.cs</span></div>
    <p style="margin-top:10px">The text layer is clean on all three receipts, so OCR is only a fallback. Each line carries an item number, which is a better join key than the description: Costco abbreviates names differently per store.</p>
    <p>Totals include a <code>GST</code> marker per line. One receipt has a member rebate line that subtracts from the total; I'll treat it as a negative line, not a discount.</p>
    <span class="when">Claude · 2 min ago · Opus · high</span>
  </div>
  ${PLAN}
</div>`

const TERM = `<span class="d">~/Git/pantry</span> <span class="b">feat/costco</span> <span class="d">$</span> claude
<span class="d">╭──────────────────────────────────────────╮</span>
<span class="d">│</span> <span class="w">✻ Claude Code</span>            <span class="d">plan mode</span>       <span class="d">│</span>
<span class="d">╰──────────────────────────────────────────╯</span>
<span class="w">●</span> <span class="w">Read</span>(private/receipts/costco-…pdf)
  <span class="d">⎿</span>  Read 3 pages
<span class="w">●</span> <span class="w">Grep</span>("GST", src/)
  <span class="d">⎿</span>  Found 7 lines in 3 files

<span class="w">●</span> The text layer is clean on all three
  receipts; item numbers are the join key.

<span class="d">╭─ </span><span class="w">Ready to code?</span><span class="d"> ─────────────────────────╮</span>
<span class="d">│</span> Costco receipt parser · 6 steps          <span class="d">│</span>
<span class="d">│</span>  1. Read PDF text layer (pdfpig)         <span class="d">│</span>
<span class="d">│</span>  2. Parse line items + GST flag          <span class="d">│</span>
<span class="d">│</span>  3. Match total to the cent              <span class="d">│</span>
<span class="d">│</span>  <span class="d">… 3 more</span>                                <span class="d">│</span>
<span class="d">│</span>                                          <span class="d">│</span>
<span class="d">│</span> Would you like to proceed?               <span class="d">│</span>
<span class="d">│</span> <span class="y">❯ 1. Yes, and auto-accept edits</span>          <span class="d">│</span>
<span class="d">│</span>   2. Yes, and manually approve edits     <span class="d">│</span>
<span class="d">│</span>   3. No, keep planning                   <span class="d">│</span>
<span class="d">╰──────────────────────────────────────────╯</span>

  <span class="d">⏸ plan mode on · 31% context</span>`

const KEYS = `<div class="keys"><button>esc</button><button>1</button><button>2</button><button>3</button><button>enter</button><button>tab</button><button>ctrl</button><button>↑</button><button>↓</button><button>paste</button></div>`

const COLS = [
  { id: 'backlog', t: 'Backlog', c: '#8a978f' },
  { id: 'prog', t: 'In progress', c: '#2f7d6e' },
  { id: 'review', t: 'Review', c: '#c9a452' },
  { id: 'done', t: 'Done', c: '#5b6b8c' }
]
function board(projectId = 'pantry', go = 'chat') {
  const p = PROJECTS.find((x) => x.id === projectId)
  const done = [{ d: 'PAN·0', t: 'Ingredient units', agent: 'Claude', state: 'idle', sub: '', col: 'done' }]
  const cards = [...p.sessions, ...done]
  return `<div class="board">${COLS.map((c) => {
    const cs = cards.filter((s) => s.col === c.id)
    return `<section class="col"><h3><i style="--c:${c.c}"></i>${c.t} <span>${cs.length}</span></h3>
      ${cs.map((s) => `<button class="card${s.state === 'needs' || s.unread ? ' needs' : ''}" data-go="${go}" data-s="${s.d}">
        <span class="plate">${s.d}</span><span class="title">${s.t}</span>
        <span class="sub">${s.state === 'needs' ? s.agent + ' · waiting on you' : stateLine(s)}${s.d === 'PAN·1' ? '<span class="label">parser</span>' : ''}${s.d === 'PAN·2' ? '<span class="label">sync</span>' : ''}</span>
        ${tab(s)}</button>`).join('')}
      ${c.id === 'backlog' ? '<button class="btn quiet" style="min-height:40px">' + ico('plus', 'sm') + 'New session</button>' : ''}
    </section>`
  }).join('')}</div><div class="dots"><i></i><i class="on"></i><i></i><i></i></div>`
}

// A deterministic QR-shaped code for the viewfinder (finder patterns + seeded modules).
function qrSvg() {
  const n = 25, cells = []
  let x = 0x9e3779b9
  const rnd = () => ((x ^= x << 13), (x ^= x >>> 17), (x ^= x << 5), (x >>> 0) / 4294967296)
  const finder = (cx, cy, i, j) => i >= cx && i < cx + 7 && j >= cy && j < cy + 7
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const f = [[0, 0], [n - 7, 0], [0, n - 7]].find(([a, b]) => finder(a, b, i, j))
    let on
    if (f) { const u = i - f[0], v = j - f[1]; on = u === 0 || v === 0 || u === 6 || v === 6 || (u >= 2 && u <= 4 && v >= 2 && v <= 4) }
    else on = rnd() > 0.52
    if (on) cells.push(`<rect x="${i}" y="${j}" width="1.02" height="1.02"/>`)
  }
  return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" style="width:58%;background:#e9efe9;border-radius:6px" fill="#0a0f0f" aria-label="Pairing code">${cells.join('')}</svg>`
}

// ---- pairing flow (four screens, shared by every option) ----------------------------------
const PAIRING = `
<section class="screen" id="pair-1"><div class="topbar"><h1>Pair a Mac</h1></div>
  <div class="pair scroll">
    <h2>Reach your Mac from anywhere.</h2>
    <p>Your phone talks to nodeterm on your Mac through an end-to-end encrypted relay. No Wi-Fi in common, no IP addresses.</p>
    <ol class="steps">
      <li><b>1</b><span>On the Mac, turn on <em>Settings → Phone → Reach this Mac from anywhere</em>.</span></li>
      <li><b>2</b><span>In a terminal there, run <code>pair-code</code>. It shows a code for this phone.</span></li>
      <li><b>3</b><span>Scan it here, then compare a ten-digit number on both screens.</span></li>
    </ol>
    <div class="grow"></div>
    <button class="btn primary block" data-go="pair-2">${ico('scan')}Scan the code</button>
    <button class="btn quiet block">${ico('paste')}Paste it instead</button>
  </div></section>
<section class="screen" id="pair-2"><div class="topbar"><button class="icon-btn" data-go="pair-1" data-back aria-label="Back">${ico('back')}</button><h1>Scan</h1></div>
  <div class="pair">
    <div class="viewfinder">${qrSvg()}<div class="corners"></div></div>
    <div class="mac-card"><span class="plate lg">MAC</span><strong>${MAC.name}</strong><span class="k">${MAC.relay}<br>host ${MAC.hostId}</span></div>
    <div class="grow"></div>
    <button class="btn primary block" data-go="pair-3">Connect to ${MAC.name}</button>
  </div></section>
<section class="screen" id="pair-3"><div class="topbar"><button class="icon-btn" data-go="pair-2" data-back aria-label="Back">${ico('back')}</button><h1>Compare</h1></div>
  <div class="pair">
    <h2>Does your Mac show this number?</h2>
    <div class="sas tnum">561 048 <span>8895</span></div>
    <p class="hint">Compare all ten digits with the dialog on ${MAC.name}. If they match, press <strong>Approve</strong> there. If the other device shows only six, it runs an older version: compare the first six.</p>
    <div class="grow"></div>
    <div class="waiting"><span class="state working"><i class="dot"></i></span>Waiting for approval on the Mac…</div>
    <button class="btn quiet block" data-go="pair-4">(mock) Mac approved</button>
    <button class="btn quiet block" data-go="pair-1" data-back>They don't match: cancel</button>
  </div></section>
<section class="screen" id="pair-4"><div class="topbar"><h1>Paired</h1></div>
  <div class="pair">
    <h2>${MAC.name} trusts this phone.</h2>
    <p>Next time it connects without asking. Removing a phone in the Mac's Phone settings removes this one too.</p>
    <div class="mac-card"><span class="plate lg">MAC</span><strong>${MAC.name}</strong><span class="k">4 projects · 10 sessions · 3 need you</span></div>
    <div class="grow"></div>
    <button class="btn primary block" data-go="home">Open</button>
  </div></section>`

const STATUS_BAR = `<div class="status-bar"><span class="tnum">9:41</span><span class="sys"><svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="23" height="11" rx="3" fill="none" stroke="currentColor" opacity=".5"/><rect x="2" y="2" width="17" height="8" rx="1.5"/><rect x="24.5" y="4" width="1.8" height="4" rx=".9" opacity=".5"/></svg></span></div>`

const THEME_BTN = `<button class="icon-btn" data-theme-toggle aria-label="Switch light or dark">${ico('moon')}</button>`

// ---- tiny router ---------------------------------------------------------------------------
function boot(home = 'home') {
  const root = document.documentElement
  const params = new URLSearchParams(location.search)
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches
  root.dataset.theme = params.get('theme') || (prefersDark ? 'dark' : 'light')
  const paint = () => document.querySelectorAll('[data-theme-toggle]').forEach((b) => (b.innerHTML = ico(root.dataset.theme === 'dark' ? 'sun' : 'moon')))
  paint()
  const show = (id, back) => {
    const next = document.getElementById(id === 'home' ? home : id)
    if (!next) return
    document.querySelectorAll('.screen.on').forEach((s) => s.classList.remove('on', 'back'))
    next.classList.add('on'); if (back) next.classList.add('back')
    next.querySelectorAll('.board').forEach((b) => {
      const dots = b.nextElementSibling?.querySelectorAll('i') ?? []
      const sync = () => dots.forEach((d, i) => d.classList.toggle('on', i === Math.round(b.scrollLeft / 312)))
      b.onscroll = sync; if (!b.dataset.init) { b.dataset.init = '1'; b.scrollLeft = 312 } sync()
    })
    document.querySelectorAll('[data-nav]').forEach((b) => b.setAttribute('aria-current', b.dataset.go === id ? 'page' : 'false'))
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a'); if (!t) return
    if (t.hasAttribute('data-theme-toggle')) { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; paint(); return }
    if (t.hasAttribute('data-pick')) { t.parentElement.querySelectorAll('[data-pick]').forEach((c) => c.setAttribute('aria-pressed', String(c === t))); return }
    if (t.hasAttribute('data-answer')) {
      const card = t.closest('.ask'); card.classList.add('sent')
      card.querySelector('header').innerHTML = ico('check', 'sm') + 'Answered · agent is working'
      card.querySelectorAll('.actions, .opts').forEach((a) => (a.style.display = 'none')); return
    }
    if (t.hasAttribute('data-seg')) { t.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === t))) }
    if (t.dataset.go) show(t.dataset.go, t.hasAttribute('data-back'))
  })
  show(params.get('screen') || home)
}
