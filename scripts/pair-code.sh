#!/bin/sh
# Print this Mac's pairing code for the Ferry web app, as a QR code (when qrencode is installed) and as
# text to paste. The code is nodeterm's own public relay identity (~/.nodeterm/relay.json, written while
# Settings -> Phone -> "Reach this Mac from anywhere" is on) plus this Mac's name. It holds no secret:
# whoever scans it still has to be approved on this Mac by comparing a ten-digit code.
set -eu
FILE="${NODETERM_RELAY_JSON:-$HOME/.nodeterm/relay.json}"
if [ ! -f "$FILE" ]; then
  echo "No $FILE yet." >&2
  echo "Turn on nodeterm Settings -> Phone -> \"Reach this Mac from anywhere\" (a dev build also needs" >&2
  echo "NODETERM_RELAY_URL=wss://relay.nodeterm.dev in the environment it starts with), then run this again." >&2
  exit 1
fi
LABEL="$(scutil --get ComputerName 2>/dev/null || hostname)"
CODE="$(LABEL="$LABEL" python3 -I - "$FILE" <<'PY'
import base64, json, os, sys
with open(sys.argv[1]) as f:
    ad = json.load(f)
keep = {k: ad[k] for k in ('v', 'hostId', 'hostPublicKeyB64', 'relayEndpoint', 'hostDeviceId')}
keep['label'] = os.environ['LABEL'][:60]
raw = json.dumps(keep, separators=(',', ':')).encode()
print('ntpwa1:' + base64.urlsafe_b64encode(raw).decode().rstrip('='))
PY
)"
if command -v qrencode >/dev/null 2>&1; then
  printf '%s' "$CODE" | qrencode -t ansiutf8 -m 2
else
  echo "(Install qrencode for a scannable QR: brew install qrencode)"
fi
echo
echo "$CODE"
