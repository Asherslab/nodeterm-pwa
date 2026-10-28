# How the PWA reaches the desktop: transport research

Status: research done 2026-10-28 against the user's fork at
the owner's nodeterm fork (branch `fix/browser-focus-custody`, HEAD `1e71b9f9`).
All file paths below are relative to that checkout unless they start with `docs/` of this repo.
Endpoint behaviour was probed read-only with `curl` (preflights, a bogus-token `/join`, a
bogus-token WebSocket upgrade); nothing was minted, registered or paired.

## Verdict

**Viable, with one required piece of infrastructure and one desktop change for notifications.**

- The browser can speak the relay protocol end to end. The relay accepts a WebSocket from any
  origin. The crypto is NaCl box, HSalsa20 and HKDF-SHA256, which tweetnacl and WebCrypto cover.
  Nodeterm already ships a browser relay client (the Live-links viewer, `src/shared/watch-link/`).
- The PWA can pair with the desktop **without the LAN**, the same way the official phone app does
  when it is off-LAN: it reads the desktop's public relay identity, mints its own relay device token,
  dials the relay, and the desktop shows its SAS approval dialog. After approval the desktop pins the
  PWA's key, and later connects go through without a dialog. Phone and Mac never need to share a
  network, and no IP address appears anywhere.
- **Blocker B1: the token API has no CORS.** `api.nodeterm.dev` answers no preflight and sends
  no `Access-Control-Allow-Origin`, so a page can send `POST /v1/relay/device` and
  `POST /v1/relay/join` but cannot read the reply (the tokens). **A small HTTPS proxy for those
  two routes is required.** The simplest form serves the PWA and the proxy from one origin, so no
  CORS is involved at all. This is a hosting decision for the user (§8).
- **Blocker B2: there are no push notifications without a desktop change.** The desktop pushes only
  through the nodeterm backend to APNs, for the native app's registrations. A PWA gets Web Push only
  if the desktop sends it itself. The proposal is in `docs/desktop-changes.md`. Until that lands, the PWA
  shows live state only while it is open.

## 1. Two dialects, and which one the PWA speaks

Nodeterm has two relay application protocols:

| | Legacy "phone dialect" | rpc.ts tunnel |
|---|---|---|
| Spoken by | the **standing phone host** (`src/main/remote/standing-host.ts` → `connectHostSession` in `host-service.ts`) and the interactive Pro host | Team Access / hosted relay (`src/core/relay/relay-host.ts`), Live links |
| Payload tags | `0x01` JSON RPC envelope `{kind:'req'\|'res'\|'notify'\|'keepalive'}`, `0x02` binary terminal frame (`framing.ts`) | `0x03` rpc.ts JSON, `0x04` pty-data binary |
| Trust | one-way, pin-once: the desktop human approves the phone's key by SAS | mutual SAS, `trust:confirm` over the tunnel |
| Verbs | `projects.list`, `pty.attach`, `chat.*`, `agent.answer`, `projects.setCardColumn`, … (§5) | `IPC.*` channel names (full `CorePlatform`) |

`docs/ios-protocol-migration.md` describes a planned move of the phone onto the rpc.ts tunnel, but
**that has not happened in this fork**. `standing-host.ts` still imports `connectHostSession`, and
the phone verbs (`chat.page`, `agent.answer`, the kanban verbs) exist only in `host-service.ts`. The
PWA therefore speaks the **legacy phone dialect** to the standing host: that is the protocol nodeterm
already serves to phones, as the brief asks. The transport layer is written behind one interface,
so a later migration swaps the framing and leaves the screens alone (residual R1).

The standing host runs only while **Settings → Phone → "Reach this Mac from anywhere"**
(`settings.phoneAccessEnabled`) is on, and only in a packaged build (`relayAllowed()`:
`app.isPackaged || NODETERM_RELAY_URL`). The user runs the fork with `electron-vite preview`, which
is probably unpackaged, so this gate decides whether the standing host runs at all. It could not be
confirmed from here: reading `~/.nodeterm` was refused, which is correct because `agent.json` holds
bearer tokens. **Open question O1** (§9).

## 2. Pairing without the LAN

### What the official app does

There are two paths, and the PWA uses the second:

1. **QR + LAN `/pair`** (`src/main/pairing-service.ts`). The desktop shows a QR containing
   `{v,host:<LAN IPv4>,port,user,token,pairPort,nodeterm,name,hostKey?,relay?,sshHostKeys?}`
   (`pairing-core.ts buildPairingPayload`). The phone POSTs `{token, publicKey: <ssh-ed25519 line>,
   deviceName, deviceId, priorDeviceToken?}` (optionally sealed as `{epk, box}` to `hostKey`) to
   `http://<LAN IP>:<random port>/pair`. The desktop appends the SSH key to `~/.ssh/authorized_keys`
   and mints the phone's relay device token for it. **A browser cannot use this path.** It is plain
   `http://` to a LAN IP from an `https://` page, which is mixed content and blocked. It answers no
   CORS (the handler 404s everything but `POST /pair`, so the preflight fails). It needs the phone on
   the Mac's LAN. And it hands out an SSH key, which a browser cannot use.
2. **Relay-only, off-LAN** (`src/main/remote/relay-advertise.ts` header, verbatim): *"While the
   standing phone host is UP, we now advertise the relay identity in ~/.nodeterm/relay.json. The phone
   reads it … then mints its own device token against the API (the free-tier TOFU mint). The file
   carries ONLY public material … relay ACCESS remains gated host-side by the pin-once SAS approval."*

`~/.nodeterm/relay.json` (written by `standing-host.ts connectOne`):

```json
{ "v": 1, "hostId": "<22 chars>", "hostPublicKeyB64": "<44 chars>", "relayEndpoint": "wss://relay.nodeterm.dev", "hostDeviceId": "<uuid>" }
```

`hostId` = `base64url(sha256(rawHostPublicKey)).slice(0,22)` (`src/core/relay/relay-id.ts`). The PWA
recomputes it and refuses a mismatch, as `decodeJoinCode` does for team codes.

### The PWA's pairing flow

1. **Get the identity onto the phone.** The phone cannot read `~/.nodeterm` without SSH, so the
   user carries it across, the same way they would scan a QR. This repo ships
   `scripts/pair-code.sh`. It reads `relay.json` and prints a QR code and a pasteable code
   (`ntpwa1:` + base64url JSON) with the same five fields. No secret is involved: the
   file is public material by nodeterm's own design. The trust basis is "this came off my own Mac's
   screen", the same basis as the QR's `hostKey`. An optional desktop change (D2) would show this
   code in Settings → Phone.
2. **Validate**: canonical padded base64 of 32 bytes for the key, not a low-order point (§4),
   `hostId` matches the key, `relayEndpoint` is `wss:`.
3. **Make the device identity**: an X25519 key pair (§4) and a random `deviceId` (UUID), both
   persisted.
4. **Mint a device token**: `POST /v1/relay/device {deviceId, hostDeviceId, hostPublicKeyB64, label}`
   → `{deviceToken, hostId, exp}`. The token lasts about 90 days. Body fields are exactly the four that
   `src/core/relay/join-token.ts mintDeviceToken` sends ("the free-tier body the production endpoint
   was verified against"). Free-tier mints are damped server-side (a few per day per host). Keep the
   token and never mint in a loop. Responses: 429 with `{scope:'ip'}` = per-IP limiter (30/min,
   shared by `/device`, `/join` and `/host-token`); 429 without a scope = the daily damper; 5xx =
   network.
5. **Mint a join token** (every connect): `POST /v1/relay/join {deviceToken}` →
   `{pairingToken, relayEndpoint}`. Responses: 401 = token bad or expired (re-mint once), 403 = device
   revoked (never re-mint; show "removed on the computer"), 429 = per-IP limiter. Tokens are single
   use and expire in about 120 s, and the socket does not reconnect on the same token.
6. **Dial** `relayEndpoint + "?token=" + encodeURIComponent(pairingToken)` and run the client
   handshake (§3).
7. **Approval.** The standing host's `onPeerReady` finds the PWA's key unpinned and sends the SAS
   dialog to the desktop renderer (`IPC.remoteHostPeerPending {sas, id, pub, standing:true}`). The PWA
   shows the same 10-digit SAS with nodeterm's compare hint (`src/shared/remote/sas.ts`). The human
   clicks Approve on the desktop, the key is persisted to `remote-approved-phones.json` (`phonePins`)
   **before** access is granted (#819), and the session starts serving. Until then every request is
   answered `res ok:false {message:"Awaiting host approval."}`. The PWA learns of approval by polling a
   cheap request (`host.info`) until it succeeds. Consent is held 120 s even if the socket drops
   (`core/phone-approval.ts`).
8. **Later connects**: steps 5–6 only. The pinned key is auto-approved silently.

This trust model is **one-way**: the desktop authenticates the PWA by SAS. The PWA authenticates
the desktop because it holds the host key the user carried over, and the ECDH only completes with
that key's owner. The PWA pins it and refuses any other.

**Removal**: Settings → Phone → Remove revokes **all** phone pins (`pairing-service.revokeDevice`,
`peer-revoke.ts`), so the PWA would re-pair by SAS after the user removes any phone. The PWA's
own device row on the backend can only be revoked with an entitlement (`/v1/relay/device/revoke`),
which the PWA does not hold. Revoking its pin on the desktop is what cuts it off.

## 3. The relay transport (what the browser must implement)

Source of truth: `src/core/relay/relay-socket.ts`, `src/core/relay/e2ee.ts`, `src/core/relay/framing.ts`;
`src/shared/watch-link/wire.ts` restates it browser-side. Byte-exact spec:
`docs/ios-protocol-migration.md` §2. The PWA re-implements it from that spec rather than copying the
fork's files: nodeterm is BUSL-1.1, and a wire protocol is not the code.

- **WebSocket**: `binaryType = 'arraybuffer'`. A **text** frame is a plaintext handshake control,
  and a **binary** frame is a sealed box. Queue sends until `open`.
- **Handshake (client role)**:
  1. `baseKey = HSalsa20(X25519(ourSecret, hostPub))`, which equals `nacl.box.before`. Refuse an
     all-zero X25519 output.
  2. Send text `{"type":"e2ee_hello","publicKeyB64":<our pub, std b64 padded>,"nonceB64":<16 random bytes>}`.
  3. Receive text `{"type":"e2ee_ready","nonceB64":<16 bytes>}` → `sessionKey =
     HKDF-SHA256(ikm=baseKey, salt=hostNonce‖clientNonce, info="nodeterm-relay-session-v2", L=32)`.
  4. Send box `[0x01]{"type":"e2ee_auth"}`; receive box `[0x01]{"type":"e2ee_authenticated"}` → ready.
  5. After ready, **ignore** any text control frame: no re-key, no close (§2.4 of the migration doc).
- **Box**: `nonce(24) ‖ nacl.box.after(plain, nonce, sessionKey)`. **Plain**: `[role:1][seqHi u32
  LE][seqLo u32 LE][tag:1][body]`, where the client role is 2 and the host role is 1. Drop a box carrying
  our own role (a reflection), and drop any seq ≤ the last accepted. The outbound seq starts at 0 per connection.
- **Legacy RPC envelope (tag 0x01, JSON)**:
  - client → host `{"kind":"req","id":"<string>","method":"…","params":{…}}`
  - host → client `{"kind":"res","id":"…","ok":true|false,"body":…}`; an error body is `{message, reason?}`
  - host → client `{"kind":"notify","method":"canvas:state","params":CanvasState}` (the canvas mirror)
  - `{"kind":"keepalive"}` both ways, about every 25 s; ignore inbound.
- **Terminal frames (tag 0x02)**: 16-byte header `[0x74][0x01][op][0][streamId u32 LE][seqHi u32
  LE][seqLo u32 LE]` + payload. Ops: Output 1, SnapshotStart 2, SnapshotChunk 3, SnapshotEnd 4,
  Resized 5, Error 6 (`{"exitCode":n}`), **Input 7** (client → host, UTF-8 bytes), **Resize 8**
  (client → host, `u16 LE cols, u16 LE rows`).

The host does no Origin check (probe: `Upgrade: websocket` to `wss://relay.nodeterm.dev/?token=bogus`
answered `101 Switching Protocols` with Origin `https://example.com`, `https://asherslab.github.io`,
`http://localhost:5173`, `null` and no Origin at all). A bad token is decided after the upgrade.

## 4. Crypto and key storage in the browser

| Need | Browser primitive |
|---|---|
| X25519 for the device identity | **WebCrypto `X25519`** (`generateKey` with `extractable:false`, `deriveBits`). Safari/iOS 17+, Chrome 133+, Firefox 130+. `deriveBits` itself throws on an all-zero result (the low-order check). |
| HSalsa20 (the step from X25519 output to `box.before`) | `tweetnacl` `lowlevel.crypto_core_hsalsa20`, as `e2ee.ts deriveSharedKey` does |
| XSalsa20-Poly1305 box | `tweetnacl` `box.after` / `box.open.after` |
| HKDF-SHA256 | WebCrypto `HKDF` (`src/shared/watch-link/hkdf.ts` does exactly this) |
| SHA-512 (SAS), SHA-256 (hostId) | WebCrypto `digest` or `nacl.hash` |
| Low-order host-key check | `nacl.scalarMult(0x5a×32, hostPub)` all zero ⇒ refuse (`isLowOrderPublicKey`) |

**The device secret key never leaves WebCrypto.** The key pair is generated as a non-extractable
`CryptoKey` and stored in IndexedDB, which stores the CryptoKey object itself (structured clone),
never its bytes. Script, XSS included, can *use* it while the page runs but can never read or
export it, so it cannot be copied off the device. The public key is exported raw for the hello.
Per-session `baseKey`/`sessionKey` live in JS memory only. Fallback where WebCrypto X25519 is missing:
a tweetnacl key pair whose secret bytes are encrypted under a non-extractable AES-GCM key in
IndexedDB. That is weaker (the bytes are visible to script after unwrap), so the app says so.

Persisted in IndexedDB: the device key, `deviceId`, the pinned host identity (`relay.json` fields),
`deviceToken` + `exp`. `deviceToken` is a bearer credential: with it someone can mint join tokens and
knock on the relay room, but they cannot get past the desktop without the device key (a different key raises a
new SAS dialog). Call `navigator.storage.persist()`. On iOS an installed (Home Screen) PWA is exempt
from Safari's 7-day storage eviction, but a tab is not, so **install before pairing**.

The SAS (v2): `h = SHA-512(baseKey)`; `a = BE_u32(h[0..4]) mod 1e6`; `b = BE_u32(h[4..8]) mod 1e4`;
`"NNN NNN NNNN"`. Vectors in `docs/ios-protocol-migration.md` §3.1 and `src/core/relay/e2ee.test.ts`
become this repo's tests.

## 5. What the phone dialect offers (`host-service.ts createHostHandlers`)

All verbs below are served only after approval. "Not served" verbs answer
`"<verb> is not served on this host."`. Unknown verbs answer `"Unknown method: <verb>"`.

| Area | Verb → reply | Notes |
|---|---|---|
| Feature detect | `host.info {}` → `{platform, verbs:[…]}` | `verbs` = `host.info, agent.key, inbox.ack, fs.browse, pty.capture` |
| Projects + live state | `projects.list {}` → `{output}` | `output` = `<workspace JSON>\n--NT-PROJECTS-SPLIT--\n<tmux session names, \n-joined>\n--NT-STATUS-SPLIT--\n<agent-status.json>` (`main/index.ts listProjectsOutput`). Workspace = `{version:2, projects:[{id,name,cwd,nodes:[…],kanban?:{columns,assignments,labels,meta}…}]}`. The status file = `MirrorFile` (`core/agent-status-mirror.ts`): `nodes[id].{state,agentId,sessionId,name,hibernated}`, `inbox.events[]` (`approval`/`question`/`done`, `title`, `detail`, `options`, `pendingId`, `resolved`), `inbox.nodes[id].{activity,tool,contextPercent,prompt}`, `usage`. The iOS app polls this every 30 s off-LAN. It is the **only** state feed: there are no status events. |
| Canvas | `notify canvas:state` (pushed on approval and on change), `req canvas:request` (re-push), `notify canvas:mutate` (layout-only, sanitized) | the active project's canvas only |
| Terminal | `pty.attach {nodeId, cols, rows, projectId?, resizedFrames?, launch?}` → `{streamId, fresh, scroll?, launched?, hostPlatform?, paneShell?}`, then `Snapshot*` frames, then `Output`. `pty.kill {streamId}` detaches (tmux survives). `pty.destroy {streamId}` ends the session and removes the node. `pty.scroll {streamId, dir:'up'\|'down', lines≤20}` scrolls tmux history. `pty.capture {streamId}` → `{text}` plain. Input/resize go as frames. | `pty.create` is refused. A new session = attach a new node id with `launch:{agentId, cwd?, accountId?, permissionMode?}` + `projects.registerNode {projectId, node:{id,title?,agentId?,accountId?}}` |
| Chat | `chat.page {nodeId, before?, maxBytes?}` → `{page: ChatPage}`, `chat.status {nodeId, catalog?}` → `{status: ChatStatus}`, `chat.send {nodeId, text}` → `{result, reason?}` | exact shapes and error strings: nodeterm `docs/mobile-chat-view.md` §3.1–3.2. Never auto-resend on `unconfirmed`. |
| Approvals | `agent.answer {nodeId, pendingId, answer}` → `{ok}` | `answer` = `{kind:'allow'}` / `{kind:'deny'}` / `{kind:'plan', mode:'restore'\|'acceptEdits'\|'manual'}` / `{kind:'plan-revise', message}` / `{kind:'question', answers:{[q]: string\|string[]}, freeText?}` / `{kind:'question-clarify'}` (`core/agents/permission-decision.ts parsePermissionAnswer`). Structured kinds need a structured ticket (hook script rev ≥ 5): `ChatStatus.structuredAnswers`. |
| Keyed answers | `agent.key {nodeId, key:'1'…'9'\|'escape'\|'enter' \| digits, expect:{ask:'approval'\|'question'\|'submit', states?}, pendingId?}` | for prompts without a structured ticket |
| Inbox | `inbox.ack {nodeId, eventId}` → `{ok}` | marks a finished turn read on the desktop |
| Kanban | `projects.ensureBoard {projectId}` → `{columns}`, `projects.setCardColumn {projectId, nodeId, columnId\|null}` → `{moved}`, `projects.editCardLabels {projectId, nodeId, add?, remove?, create?}` → `{edited, labels, cardLabelIds}` | board data itself comes from `projects.list` (`project.kanban`) |
| Node actions | `node.wake`, `node.refresh`, `node.rename {nodeId, title}` | renderer nudges; reply = delivered or not |
| Git | `git.status/diff/stage/unstage/commit/push/pull/history {cwd,…}` | jailed to project cwds |
| Files | `fs.list/read/readBinary/write {path}`, `fs.browse {path?}` | jailed; `fs.browse` = folder names under home |

## 6. Notifications

**Today**: agent events → `core/push-notify.ts` → `POST api.nodeterm.dev/v1/push/notify` (host-auth
session) → the backend fans out to **APNs** registrations of relay-paired native phones. The webhook
path is the same (`/v1/push/webhook`). A PWA has no APNs device token, and the backend has no Web
Push support, so **no existing path can reach a PWA.**

**Web Push for a PWA**: on iOS (16.4+) a web page gets push only once it is **installed to the
Home Screen**, and `Notification.requestPermission()` must be called from a user gesture. The PWA
then holds a `PushSubscription {endpoint (web.push.apple.com / fcm.googleapis.com / …), keys.p256dh,
keys.auth}`. Anything holding a VAPID key pair can POST an RFC 8291 (`aes128gcm`)-encrypted payload
to that endpoint. The push service sees only ciphertext and timing.

**What that implies**: the sender has to be the desktop, the only thing that knows when an agent
needs the user. Proposal **D1** (`docs/desktop-changes.md`): a new phone verb
`push.webSubscribe` that stores the subscription against the approved key, plus a Web Push sender
beside `push-notify.ts` that fires on the same inbox events. It goes from the desktop straight to
Apple or Google over HTTPS, with no nodeterm backend, works off-LAN, and stops when the pin is
revoked. Until D1 lands, the PWA polls `projects.list` while open and sets the app badge
(`navigator.setAppBadge`) from it. Nothing reaches the phone while the app is closed.

## 7. Platform behaviour that shapes the client

- **iOS suspends a backgrounded PWA**, and the WebSocket dies. On `visibilitychange → visible`:
  `/join` again (a fresh token every time), redo the handshake, re-attach open streams, re-poll. Expect a
  1–2 s reconnect each time the app is reopened.
- Reconnect backoff 1, 2, 4, 8, 15 s, as the desktop uses. A `/join` 429 waits ≥ 60 s.
- `projects.list` polling: every 5 s while the session list is visible and the app is foreground,
  every 30 s otherwise, and never in the background. While a Chat screen is open: `chat.status` every 2 s and a
  `chat.page` tail re-read while `working` (as the iOS app does).
- The terminal snapshot is a raw `tmux capture-pane` with LF endings, painted into an empty emulator.
  xterm.js needs `\n → \r\n` for the snapshot only, and live output is written as-is.

## 8. Blockers, with evidence

| # | Blocker | Evidence | Resolution |
|---|---|---|---|
| **B1** | `api.nodeterm.dev` has no CORS: preflight `OPTIONS` answers **404** with no `Access-Control-*` headers for `/v1/relay/device` and `/v1/relay/join` (origins tried: `https://nodeterm.dev`, `https://asherslab.github.io`, `http://localhost:5173`). A `POST` gets a real reply (`401 {"error":"bad_token"}` for a bogus token, even with `content-type: text/plain`) **without** `Access-Control-Allow-Origin`, so a browser cannot read it. | `curl -X OPTIONS … -H 'Origin: …'` → `HTTP/2 404`; `curl -X POST …/v1/relay/join` → `HTTP/2 401`, no ACAO | A proxy for exactly those two routes, on HTTPS. Best: **one origin serves the PWA and `/api/relay/{device,join}`**, so no CORS is needed. Candidates: Cloudflare Pages + a Pages Function (free), a Worker, or a box the user already runs. It sees `deviceToken`/`pairingToken` (bearer tokens for knocking on the relay room) but never keys or content (E2EE). **The user's call** (hosting). |
| **B2** | No push path for a non-APNs client | `core/push-notify.ts` only targets `/v1/push/notify`; the backend fans out to APNs (CLAUDE.md "Push webhook") | Desktop change **D1**; interim = foreground polling + badge |
| B3 | Pairing via LAN `/pair` is impossible from a browser | `http://<LAN IP>:<port>/pair` from an `https://` page is mixed content; the handler 404s `OPTIONS`; it needs the same LAN | Not needed: relay-only TOFU mint (§2), as the official app does off-LAN |
| B4 | The standing host might not run in the user's build | `relayAllowed()` = `app.isPackaged \|\| NODETERM_RELAY_URL`; the fork runs `electron-vite preview` | **Confirmed 2026-10-28**: the user's Settings → Phone says remote access is unavailable in development builds. Fix without code: launch nodeterm with `NODETERM_RELAY_URL=wss://relay.nodeterm.dev` in the environment of `npm start` |

## 9. Residual risks and open questions

- **R1 – dialect deletion.** `docs/ios-protocol-migration.md` plans to delete the legacy dialect once
  iOS moves to the rpc.ts tunnel. When upstream does that, the PWA's framing layer has to follow. It is
  isolated behind one module.
- **R2 – per-IP limiter behind a proxy.** `/device`, `/join` and `/host-token` share 30/min per IP. A proxy
  on shared egress IPs (Cloudflare) may share that budget with other tenants. The probability is low, but a
  `throttled` reply is handled (60 s wait) and shown.
- **R3 – Remove means all phones.** The desktop cannot revoke one phone's relay pin. Removing any phone
  forces the PWA to re-approve.
- **R4 – no forward secrecy** (inherited, nodeterm docs): a stolen device key decrypts recorded sessions.
- **O1** ~~Does the standing host run in this build?~~ No: it is a dev build, see B4.
- **O2** ~~Hosting and proxy choice~~ Decided: a Home Assistant **add-on** (the meal-planner pattern) serves the PWA and the two-route proxy from one origin behind Nginx Proxy Manager. CORS cannot be added from the fork: the API is nodeterm's backend (nodeterm-server), not desktop code.
- **O3** Is D1 (Web Push from the desktop) wanted, or is foreground-only enough?
