# Ferry: a phone web app for nodeterm

A personal PWA client for a nodeterm desktop. It is installed on the phone's Home Screen and reaches
the Mac from any network through nodeterm's own end-to-end encrypted relay, speaking the protocol
nodeterm already serves to phones. "Ferry" is a working name. It is not affiliated with or styled
after the official nodeterm phone app.

- `docs/protocol.md`: how and why it works, the blockers, and the evidence.
- `docs/desktop-changes.md`: optional desktop changes (D1 Web Push, D2 a pairing QR in Settings).
- `design/`: the layout exploration. `PRODUCT.md` holds the product record, and
  `.impeccable/surfaces/` holds the chosen direction (Sorting Frame world, Rack layout).
- `ferry/`: the app **and** the Home Assistant add-on that serves it.

## How it fits together

```
iPhone (Ferry PWA) ──HTTPS──▶ Home Assistant add-on (this repo)   serves the app; proxies 2 token routes
        │                              └──▶ api.nodeterm.dev/v1/relay/{device,join}
        └──WSS, E2EE (NaCl box)──▶ relay.nodeterm.dev ◀── nodeterm on the Mac (standing phone host)
```

The add-on never sees relay traffic. Everything between the phone and the Mac is sealed under keys
only those two hold. The phone's key is a non-extractable WebCrypto key in IndexedDB. The Mac pins it
after you compare a ten-digit code in nodeterm's own approval dialog.

## Stack, and why

- **Preact + Vite + TypeScript.** A 3 KB runtime keeps the first paint fast on a phone over
  cellular. The app is ~97 KB of JS; xterm.js (~335 KB) and the QR decoder load only when a terminal
  or the scanner opens.
- **tweetnacl + WebCrypto** for the relay crypto. WebCrypto holds the X25519 device key so it can never
  be exported. tweetnacl supplies HSalsa20 and XSalsa20-Poly1305, which WebCrypto lacks. These are the
  same primitives nodeterm's own browser client (Live links) uses.
- **xterm.js** for the terminal. **jsQR** for scanning, because iOS Safari has no `BarcodeDetector`.
- **A hand-written service worker** (`ferry/build/service-worker.ts`) precaches the exact build
  output, giving an offline shell, and never caches `/api`. It is small enough to read in a minute.
- **Server: one Node file, standard library only** (`ferry/server/server.mjs`). It has no
  dependencies to audit or update.
- **Vitest** for the transport, parser and server tests.

## Security boundary of the add-on

`ferry/config.yaml` turns off every Home Assistant permission explicitly: no HA or Supervisor API, no
host network, PID or IPC, no mapped folders, no devices, not privileged, AppArmor on, no ingress. Nothing
is published on the host unless you set a port. `ferry/server/server.mjs`:

- serves only files from the build output: no dotfiles, no traversal, a strict CSP
  (`connect-src 'self' wss://relay.nodeterm.dev`), `frame-ancestors 'none'`;
- forwards **only** `POST /api/relay/device` and `POST /api/relay/join` to the fixed host
  `api.nodeterm.dev`. It rebuilds each body from an allowlist of fields with length caps, forwards no
  client header, cookie or query string, refuses redirects, caps reply size, and rate-limits per
  client. It is not an open proxy;
- holds no secret, writes nothing, and logs no bodies or tokens.

What it does see: the relay **bearer tokens** passing through (a device token, ~90 days, and
single-use join tokens). With those, someone could knock on your Mac's relay room, but they could
not get in. Getting in takes this phone's private key, and a different key raises a fresh approval
dialog on the Mac. `ferry/server/server.test.ts` pins all of the above.

## Deploying (Home Assistant add-on, no registry needed)

`config.yaml` has no `image:`, so Home Assistant builds `ferry/Dockerfile` on the HA machine itself.

1. Copy the `ferry/` folder (without `node_modules`/`dist`) into Home Assistant's local add-ons folder,
   `/addons/ferry` (the Samba or SSH add-on gives you access).
2. Settings → Add-ons → Add-on store → ⋮ → **Check for updates**. **Ferry** appears under *Local
   add-ons*. Install it (the build takes a few minutes on a Pi) and Start it.
3. In **Nginx Proxy Manager**, add a proxy host for the address you want (e.g.
   `ferry.your-domain`). Forward to `local-ferry` port `8099` over `http`, request a Let's Encrypt
   certificate, and force SSL. Do not enable "Websockets support": the relay socket goes straight to
   relay.nodeterm.dev.
4. On the iPhone, open that address in Safari, then **Share → Add to Home Screen**. Open it from the
   Home Screen before pairing: iOS keeps an installed app's storage, but may clear a tab's.

(Alternatively, push this repo to GitHub and add it as an add-on repository. `repository.yaml`
is ready.)

## Pairing

1. On the Mac, nodeterm needs **Settings → Phone → Reach this Mac from anywhere** turned on. Your fork
   runs as a development build, which keeps that relay host off unless nodeterm starts with
   `NODETERM_RELAY_URL=wss://relay.nodeterm.dev` in its environment (e.g.
   `NODETERM_RELAY_URL=wss://relay.nodeterm.dev npm start`).
2. Run `scripts/pair-code.sh` on the Mac (`brew install qrencode` for a scannable QR). It reads
   `~/.nodeterm/relay.json`, which holds public material only.
3. In Ferry: **Scan the code** (or paste it). The phone shows a ten-digit number, and nodeterm shows
   its approval dialog. If the numbers match, **Approve on the Mac**. From then on the phone reconnects
   without asking.

Removing any phone in nodeterm's Phone settings removes Ferry too, because nodeterm revokes all phone
pins at once.

## Verified against a real Mac (2026-10-28)

Paired a phone-sized Chrome against the owner's nodeterm (dev build with `NODETERM_RELAY_URL`) through
the dev server's proxy. The SAS matched the desktop dialog, approval pinned the key, and later loads
reconnected without asking (about 6 s from load to live). The rack listed the real sessions and
states; a chat transcript rendered (tables included); a terminal attached and detached. Nothing was
typed or answered.

Known limitation: tmux keeps a window at the size of its most recently active client, so while the Mac
is the active client a phone attach does not resize your pane, and lines wider than the phone are clipped
at the right edge. That is the deliberate trade-off: the phone never reflows your desktop terminal.

## Notifications

There are none while the app is closed, yet. nodeterm pushes only to the official app through APNs.
`docs/desktop-changes.md` D1 describes a small desktop change that would send Web Push directly from
the Mac. Until then, Ferry shows live state while it is open.

## Development

```sh
cd ferry
npm install --include=dev      # this machine sets NODE_ENV=production; --include=dev is required
npm test                       # transport, parser, server
npm run typecheck
npm run dev                    # http://localhost:5173; /api/relay is proxied by Vite in dev
# http://localhost:5173/?demo  — the real screens driven by a scripted Mac (dev builds only)
python3 -I ../scripts/make-icons.py   # regenerate the icons
```
