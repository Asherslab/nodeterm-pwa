# Layout options

Three clickable mockups at real phone size (390×844), each with light and dark themes (the moon/sun
button, or `?theme=dark`). All content is synthetic. Open `option-{a,b,c}/index.html`. Jump to any
screen with `?screen=<id>` (`home`, `chat`, `term`, `board`, `pair-1`…`pair-4`, plus `sessions`/`mac`
in A/B, `chat-q`/`menu` in C). Sources live in `src/`. Rebuild with `python3 -I design/build.py`.

## One world, three organisations

The three options share one visual world and differ in how the app is organised: what leads, the
navigation model, and where answering happens. The world can be changed independently of the layout.

**The world: a sorting frame.** The app is a post-room frame of pigeonholes. The shell (header,
tab bar) is the frame's enamelled green; each session is a slot. Every session carries a brass
label plate with a short **designator** (`PAN·1`, `STG·1`). The plate is identical wherever that
session appears: list, chat header, board card, terminal title.

- **Signature move: the tab.** A session that needs you pushes a vermilion index tab out past the
  right edge of its slot, labelled with what it wants (`PLAN`, `ASK`, `ALLOW?`). The right edge of any
  list is the queue. A finished, unread turn gets an outlined `NEW` tab instead.
- **Colour quarantine:** vermilion appears only on tabs and on the answer surfaces (the plan,
  question and permission cards), so red on screen always means you are needed.
- **Duration is length:** a working session draws a hairline whose length is its time in that state.
  When the status is stale or unknown, the line is hatched instead of solid, so a guess never looks
  like a fact.
- Type: the system UI face for reading, a typewriter face only for labels and designators, and
  JetBrains Mono for the terminal and code.

## A · Inbox first

The home screen is **Waiting on you**: every approval, plan and question is answerable right there
(Allow / Approve / pick an option and Send) without opening the session. Below it sit the working
sessions and unread finished turns. Tabs: Inbox · Sessions · Board · Mac.

- **Best for** the stated top job, answering agents. Two of the three asks can be cleared from the
  home screen in one tap each.
- **Cost:** plans are long. On the home screen a plan is clipped, so you either approve from a summary
  or tap through to read it. Sessions that aren't waiting are one tab away.

## B · The rack

The home screen is the whole frame: every project as a shelf with its sessions, tabs sticking out on
the right, and a filter (All / Need you / Working) in the header. A tap opens the session with a
**Chat | Terminal** switch, Chat first. Tabs: Sessions · Board · Mac.

- **Best for** an overview: you see everything at once, and the tabs make the waiting ones pop out
  of a long list. It is the closest to how the desktop canvas thinks (projects → nodes).
- **Cost:** answering always takes one tap into the session, and with ten-plus sessions the list
  scrolls.

## C · Conversation first

The app opens **inside the most urgent conversation**. A strip of plates across the top lets you
flick between sessions (needs-you first, flagged; working ones spin). The terminal is a sheet pulled up
from under the chat, and the full list and the board are a menu sheet.

- **Best for** the second job, reading and prompting. It feels like a messaging app, and answering
  and reading happen in one place.
- **Cost:** the least overview. Ten sessions don't fit in the strip, and finding a quiet session means
  opening the menu. Opening the app straight into a conversation can feel presumptuous when nothing
  is waiting.

## Common to all three

- Pairing flow: four screens. Instructions → scan → compare the ten-digit code (the desktop's own
  wording) while the Mac's dialog waits → paired.
- Chat: transcript, tool chips, and the composer locked with the desktop's reason while an ask is
  open, mirroring `chat.status`.
- Terminal: a key bar with `esc`, `1 2 3`, `enter`, `tab`, `ctrl`, arrows and paste, enough to answer a
  TUI prompt by hand.
- Board: swipeable columns, cards keep their designator and tab.

## Mixing

The pieces are independent. Common mixes: **B's rack with A's inline answers** (asks expand in place
in the list), or **A's inbox with C's plate strip** inside a session for flicking to the next one
that's waiting.
