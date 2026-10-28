# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(An installable PWA used almost only on the owner's iPhone, at 390×844 and in standalone display mode.
Mobile web, not native.)

## Stack

Delegated: Vite + TypeScript + Preact (a small runtime for a phone), xterm.js for the terminal,
tweetnacl + WebCrypto for the relay crypto, Vitest for tests. The backend is a Home Assistant
**add-on** (one container, the meal-planner pattern in `../AshersLab.MealPlanner/mealplanner/`). It
serves the built PWA and a two-route token proxy, and is reached at its own HTTPS address through
Nginx Proxy Manager (no ingress). The reasons are in docs/protocol.md §8 (B1).

## Users

One person: the owner of a nodeterm desktop, a Mac running many AI coding agents (Claude, Codex, …)
across several projects. They pick up the phone away from the desk, on cellular or another Wi-Fi,
mostly to **answer agents** (approve a plan, answer a question, unblock a session that needs them)
and to **read the chat and send a follow-up prompt**. Typing into a raw terminal and triaging the
kanban board happen less often, but must be possible.

## Product Purpose

A personal phone client for the owner's own nodeterm desktop, replacing the official native phone
app, which the owner does not like. It talks to the desktop over the protocol nodeterm already serves to
phones (the E2EE relay, the standing phone host's verbs). It works from any network with no LAN and no
fixed IP. Success: the owner notices an agent waiting, understands what it wants, and answers it in a
few seconds with one hand.

## Positioning

It is not a remote desktop and not a terminal emulator with extras. It is an inbox of agents that
need you, with the conversation one tap away and the terminal behind that. Everything it shows comes
straight from the desktop over an end-to-end encrypted relay. No third party (including its own
add-on backend) can read it.

## Operating Context

- One hand, often standing or walking, a glance at a time. Sessions last seconds to a few minutes.
- The desktop holds 3–10 projects with 1–15 agent nodes each. Node states: **working**, **needs you**
  (approval / question / plan; `waiting`/`blocked` in the protocol), **done** (finished turn, maybe
  unread), idle/unknown, hibernated.
- Pairing happens once: the owner carries the desktop's relay identity to the phone (a QR or code from
  a script), then compares a 10-digit code with the desktop's approval dialog and approves there.
- Live state arrives by polling (`projects.list`, `chat.status`) while the app is open. Notifications
  while closed need a desktop change (D1, docs/desktop-changes.md) and may not exist at first.
- On iOS the app is suspended in the background and reconnects (1–2 s) every time it is reopened.

## Capabilities and Constraints

- Verbs available: see docs/protocol.md §5. Chat (`chat.page/status/send`), approvals
  (`agent.answer`: allow/deny, plan approve with a mode or revise, question answers), keyed answers,
  terminal attach/input/scroll, kanban column moves and labels, node rename/wake, git, files.
- A new session is started by an attach with `launch` + `projects.registerNode`. `pty.create` is refused.
- Never auto-resend a chat message whose outcome is `unconfirmed`. The composer is locked unless the
  desktop says the agent is idle.
- Must not copy the official app's name or branding. The working name is **undecided** (the mockups use
  a placeholder).
- **The add-on must not expose the owner's environment**: no Home Assistant API or Supervisor
  access, no host network, no mapped folders, not privileged. The proxy forwards exactly two fixed
  upstream routes with schema-checked bodies, drops client headers, cookies and query strings, logs
  no tokens, and is never an open proxy. It serves only static files from the build.

## Brand Commitments

None yet, beyond not resembling the official nodeterm phone app.

## Evidence on Hand

No real screenshots or transcripts are used. Mockups use authored, synthetic project and session
content, labelled as such.

## Product Principles

1. **Needs-you first.** Anything waiting on the owner outranks everything else on every screen.
2. **Answer where you read.** A plan or question is answered inline, in context, without switching modes.
3. **Honest state.** Never show a guess as fact: unknown, stale, reconnecting and unconfirmed each get a
   distinct, visible state.
4. **One hand, one glance.** Primary actions sit in the thumb zone; nothing important needs two hands.
5. **The desktop decides.** The phone asks; the desktop gates. The UI mirrors the desktop's refusals
   instead of hiding them.

## Accessibility & Inclusion

WCAG 2.2 AA contrast in both themes, Dynamic Type-friendly sizing (rem), 44pt touch targets, and
state that is never carried by colour alone (working/needs-you/done also differ in shape or label).
