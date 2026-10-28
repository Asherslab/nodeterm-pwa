# Proposed desktop-side changes (for the nodeterm fork)

These are proposals only. Nothing here has been implemented in the fork. Each one is additive and small,
so it stays merge-friendly with upstream (fork rule: CLAUDE.local.md). The PWA works without
either of them; D1 adds notifications while the app is closed, and D2 makes pairing a scan instead
of a script.

---

## D1 — Web Push to an approved PWA (`push.webSubscribe`)

### Why

Agent events reach phones only through `core/push-notify.ts` → `api.nodeterm.dev/v1/push/notify` →
APNs, for native app registrations. A PWA has no APNs token, so it hears nothing while closed. A Web
Push subscription can be delivered by anyone holding a VAPID key, and the desktop is the one place
that knows when an agent needs the user. So the desktop sends the push itself, straight to the browser's push
service, with no nodeterm backend involved and no LAN needed.

### Wire (phone dialect, `src/main/remote/host-service.ts createHostHandlers`)

Two new verbs, served only after approval (the existing `connectHostSession` gate), and added to
`RELAY_PARITY_VERBS` so `host.info` advertises them:

```
push.webSubscribe   { subscription: { endpoint: string, keys: { p256dh: string, auth: string } },
                      label?: string, kinds?: ('approval'|'question'|'done')[] }
                 →  { ok: true, vapidPublicKey: string }  |  ok:false { message }
push.webUnsubscribe { endpoint: string }  →  { ok: boolean }
push.webTest        {}                    →  { sent: boolean }      // one test notification
```

Validation at the verb (untrusted input):
- `endpoint`: `https:` URL, ≤ 1024 chars, host in an allowlist:
  `web.push.apple.com`, `*.push.apple.com`, `fcm.googleapis.com`, `updates.push.services.mozilla.com`,
  `*.notify.windows.com`. Anything else is refused, which stops the desktop from being used to make
  requests to arbitrary hosts (SSRF).
- `p256dh`: base64url of a 65-byte uncompressed P-256 point. `auth`: base64url of 16 bytes.
- At most 4 subscriptions per pinned key and 8 in total. A new one with the same endpoint replaces the old.

### Storage

`<userData>/web-push-subscriptions.json` (0600, atomic write, `updateApprovedDevices`-style
serialized RMW): `{ v:1, vapid: { publicKey, privateKeyEnc }, subs: [{ endpoint, p256dh, auth,
peerKeyB64, label, kinds, createdAt, lastOkAt?, failures }] }`. The VAPID private key is generated once
(P-256) and kept with `safeStorage` like the host key (`host-identity.ts`). Each subscription is
**bound to the box public key of the session that registered it** (`session.peerPublicKeyB64()`).

### Sending

A sink beside `push-notify.ts`, fed by the **same inbox events** after the same filters (muted
nodes, de-dupe by `eventId`):

- Payload (JSON, ≤ 3 KB): `{ v:1, kind, eventId, nodeId, projectId?, title, body, ts }`, with title and body
  produced by the same sanitizer as the APNs path. No transcript text beyond the existing push
  title/body.
- RFC 8291 `aes128gcm` content encryption + RFC 8292 VAPID JWT (`aud` = endpoint origin, `exp` ≤ 12 h,
  `sub` = `mailto:` a placeholder the user sets, or `https://localhost`). Node's `crypto` has
  ECDH P-256, HKDF and AES-128-GCM, so no dependency is needed. The `web-push` npm package is the alternative.
- Headers: `TTL: 3600`, `Urgency: high` for approval/question and `normal` for done, and a `Topic` from
  the eventId (≤ 32 chars, base64url) so a newer push replaces an older one for the same event.
- Responses: 201/202 ok; **404/410 ⇒ delete the subscription**; 429 ⇒ honour `Retry-After`; other
  4xx ⇒ count a failure and delete after 5 consecutive.
- Rate: at most 30 pushes/min per subscription, coalescing by node.

### Revocation

`peer-revoke.ts`: every revoke that unpins a phone key also deletes the subscriptions bound to it
(Remove = all phones = all subscriptions). A push must never outlive the pin.

### Surfaces

Settings → Phone lists "Web app notifications: N devices" with Remove. Server Edition: N/A (no phone
host). Tests: verb validation (allowlist, key lengths), encryption against the RFC 8291 test vector
(§5 of the RFC), VAPID JWT shape, deletion on 410, deletion on revoke.

### What the PWA does with it

On "Enable notifications" (a user gesture): `Notification.requestPermission()` →
`pushManager.subscribe({userVisibleOnly:true, applicationServerKey: vapidPublicKey})`. It needs the
key first, so it calls `push.webSubscribe` with no subscription to fetch it, or the desktop
answers `vapidPublicKey` from `host.info`. Then it sends the subscription. The service worker
shows the notification, and a tap opens `/#/node/<nodeId>`. The **actual answer** still goes through
the app (a relay connection is needed to answer). Notification action buttons (Allow/Deny) are left
out on purpose: answering from a lock screen without the SAS-pinned session is exactly what the
desktop's push-webhook rules avoid.

---

## D2 — Show a "web app pairing code" in Settings → Phone (optional)

### Why

Today the PWA's pairing input is produced by `scripts/pair-code.sh` in this repo, which reads
`~/.nodeterm/relay.json` and renders a QR in the terminal. Showing the same code in the desktop's own
Phone settings would make pairing a scan.

### Change

In the Phone settings section, while the standing host is up, add a collapsed "Pair a web app"
row that renders a QR of:

```
ntpwa1:<base64url(JSON.stringify({ v:1, hostId, hostPublicKeyB64, relayEndpoint, hostDeviceId, label: <computer name> }))>
```

That is the existing `RelayAdvertisement` plus `label`. **No new secret**: `relay-advertise.ts` already
documents these fields as public material. Copy: "Scan with your nodeterm web app. You'll be asked to
approve it here by comparing a code." No other behaviour changes: approval is the existing
standing-host SAS dialog.
