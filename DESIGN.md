---
name: Ferry
description: A phone inbox of the agents on one Mac, built as a post-room sorting frame where whatever needs you pushes a vermilion tab out past the edge.
colors:
  frame: "#1f4a44"
  frame-raised: "#2a5d56"
  frame-ink: "#eaf2ee"
  frame-ink-muted: "#c6d8d1"
  ground: "#e6eae4"
  slot: "#f7f8f4"
  slot-recessed: "#eef1ec"
  ink: "#161c1a"
  ink-secondary: "#4a5652"
  ink-tertiary: "#5c6864"
  rule: "#c9d1cb"
  rule-strong: "#9eaaa4"
  brass: "#c9a452"
  brass-ink: "#1f1a0e"
  tab: "#c93a22"
  tab-ink: "#ffffff"
  work: "#276b5e"
  term-bg: "#12191a"
  term-ink: "#d7e2dc"
  live: "#7fd3b8"
  frame-dark: "#0e2421"
  frame-raised-dark: "#173632"
  frame-ink-dark: "#e3eeea"
  frame-ink-muted-dark: "#8fa9a1"
  ground-dark: "#0f1514"
  slot-dark: "#172120"
  slot-recessed-dark: "#1d2927"
  ink-dark: "#e7eeea"
  ink-secondary-dark: "#a3b3ad"
  ink-tertiary-dark: "#82938d"
  rule-dark: "#2a3734"
  rule-strong-dark: "#43534f"
  brass-dark: "#b8954a"
  brass-ink-dark: "#17130a"
  tab-dark: "#f0573b"
  tab-ink-dark: "#1a0905"
  work-dark: "#5fc2ae"
  term-bg-dark: "#0a0f0f"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.25
  title-ask:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  body-small:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.3
  tab-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
  label:
    fontFamily: "'Courier Prime', ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  plate:
    fontFamily: "'Courier Prime', ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
  code:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  terminal:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.42
rounded:
  plate: "3px"
  label: "5px"
  key: "8px"
  segment: "10px"
  control: "12px"
  slot: "14px"
  surface: "16px"
  viewfinder: "20px"
  pill: "22px"
spacing:
  hairline: "1px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  slot-inset: "14px"
  gutter: "16px"
  shelf: "18px"
  pair: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.slot}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
    typography: "{typography.title}"
  button-answer:
    backgroundColor: "{colors.tab}"
    textColor: "{colors.tab-ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-quiet:
    backgroundColor: "{colors.slot-recessed}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  plate:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.brass-ink}"
    typography: "{typography.plate}"
    rounded: "{rounded.plate}"
    padding: "5px 6px 4px"
  tab:
    backgroundColor: "{colors.tab}"
    textColor: "{colors.tab-ink}"
    typography: "{typography.tab-label}"
    padding: "0 9px 0 10px"
    height: "26px"
    width: "58px"
  tab-done:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.tab-label}"
    height: "26px"
  slot-row:
    backgroundColor: "{colors.slot}"
    textColor: "{colors.ink}"
    padding: "12px 14px"
    height: "64px"
  slots:
    backgroundColor: "{colors.slot}"
    rounded: "{rounded.slot}"
  ask-card:
    backgroundColor: "{colors.slot}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
  segmented:
    backgroundColor: "{colors.frame-raised}"
    textColor: "{colors.frame-ink-muted}"
    rounded: "{rounded.segment}"
    padding: "3px"
  segmented-selected:
    backgroundColor: "{colors.frame-ink}"
    textColor: "{colors.frame}"
    rounded: "{rounded.key}"
    height: "38px"
  chip:
    backgroundColor: "{colors.slot}"
    textColor: "{colors.ink}"
    rounded: "18px"
    padding: "0 12px"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.slot}"
    rounded: "18px"
  composer-field:
    backgroundColor: "{colors.slot}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 16px"
    height: "44px"
  topbar:
    backgroundColor: "{colors.frame}"
    textColor: "{colors.frame-ink}"
    padding: "8px 16px 12px"
    height: "52px"
  tabbar:
    backgroundColor: "{colors.frame}"
    textColor: "{colors.frame-ink-muted}"
    height: "48px"
---

# Design System: Ferry

## Overview

**Creative North Star: "The Sorting Frame"**

Ferry is a post-room frame of pigeonholes held in one hand. The shell (header, filter, tab bar) is the frame itself, enamelled green; the pale steel-grey ground behind it holds rounded groups of slots, one per session, built from hairlines and a single soft shadow. Every session carries a brass label-holder plate stamped with a typewriter designator (`PAN·1`), and the same plate appears wherever that session does: rack row, session header, board card. Anything that needs the owner pushes a vermilion index tab out past the right edge of its slot, so the right edge of any list is the queue.

The world is quiet so the tab can be loud. Colour is functional, not decorative: green means the frame and live work, brass means identity, vermilion means "you are needed", and the greys carry everything else. State is never colour alone: working has a spinning open ring and a growing rule, idle a dashed ring, asleep a square, done an outlined `NEW` tab, needs-you a filled tab with a word (`PLAN`, `ASK`, `ALLOW?`). Guesses are hatched, never solid.

Density is phone-native and one-handed: a fixed 390-wide column, 16px gutters, 64px rows, 44px controls, and the tab bar in the thumb zone. Both themes are first-class; dark is a deeper enamel with a brighter vermilion, not an inversion.

**Key Characteristics:**
- Enamelled frame-green shell around a pale steel-grey ground.
- Slot groups made of hairline rules and one soft shadow, never borders on every side.
- Brass designator plates in Courier Prime, flat, identical everywhere.
- The vermilion tab pushed past the slot's right edge, with a folded-under corner and a slide-out.
- Working time drawn as rule length; stale time drawn hatched.
- System UI for reading, Courier Prime for labels, JetBrains Mono for code and the terminal.

## Colors

A cool green-grey world with one warm metal (brass) for identity and one hot signal (vermilion) held in quarantine. All values below are the light theme; each has a `-dark` twin in the frontmatter, swapped by `:root[data-theme='dark']` (the app resolves system, light or dark into that attribute and also rewrites the `theme-color` meta to the frame green of the active theme).

### Primary
- **Enamel Frame Green** (`frame`): the shell. Top bar, filter strip, tab bar, splash. It is the frame the slots sit in, never a fill inside the ground.
- **Raised Enamel** (`frame-raised`): the recessed track of a segmented control on the frame, the pressed state of a frame icon button, the board's project picker.
- **Frame Ink / Frame Ink Muted** (`frame-ink`, `frame-ink-muted`): text and icons on the frame; muted for inactive tabs, subtitles and unselected segments. The selected segment inverts to a frame-ink chip with frame-green text.

### Secondary
- **Brass** (`brass`, with `brass-ink`): designator plates, the pairing step numbers, the inset ring around the ten-digit pairing code, and (mixed 25% into slot) the wash behind an "unconfirmed" send note. Brass is identity and caution-without-alarm.

### Tertiary
- **Signal Vermilion** (`tab`, with `tab-ink`): needs-you tabs, the tab-bar count notch, the answer button, and the 1.5px inset border of the answer card. Light-theme tab text is white; dark-theme tab text is near-black on a brighter vermilion.
- **Vermilion Wash** (`--tab-wash` in the stylesheet, #fbe9e4 / dark #3a1c16): still defined but no longer used by any rule, so it is left out of the tokens. Refusals and failures are not vermilion: they are ink at weight 600, on slot where they need a ground.
- **Working Green** (`work`): live work. The spinning state ring, the duration rule and its time label, the "working" line in chat, text links (`Board`, `Retry`, `Move`), the focus ring (`--focus` carries the same value in each theme), and the selection tint (30%).

### Neutral
- **Steel Ground** (`ground`): the page behind everything, and the composer bar.
- **Slot** (`slot`): every card surface: slot groups, the ask card, board cards, fact sheets, user bubbles, chips at rest.
- **Recessed Slot** (`slot-recessed`): pressed rows, quiet buttons, inline code chips, label chips, status banners.
- **Ink / Ink Secondary / Ink Tertiary** (`ink`, `ink-secondary`, `ink-tertiary`): titles, sublines, and timestamps/paths respectively. Ink also fills the primary button, the send button and selected chips.
- **Rule / Rule Strong** (`rule`, `rule-strong`): hairlines between rows and inset outlines; the strong rule outlines fields, chips, the `NEW` tab, the dotted duration track and the scrollbar thumb.
- **Terminal Night** (`term-bg`, `term-ink`): the terminal and every multi-line code block, including inside the ask card. The terminal keeps its own fixed ANSI palette (green `#7fd3b8`, amber `#e8c46a`, red `#ff8a73`, blue `#8db7ff`, dim `#74857f`).
- **Live Signal** (`live`): the dot beside the Mac name when the link is live. It is one value in both themes because it always sits on the frame, which stays dark green (5.6:1 on light frame, 9.2:1 on dark). Off-link, the dot becomes a hollow frame-ink-muted ring. The pairing viewfinder corners and the terminal's green repeat the same hex as literals.

### Named Rules
**The Quarantine Rule.** Vermilion means "you are needed" and nothing else. It appears on needs-you tabs, the tab-bar count, and the answer card with its answer button. If a red thing on screen cannot be answered or opened to answer, it should not be red. Errors and refusals are ink at weight 600.

**The Enamel Edge Rule.** Frame green belongs to the shell only. Content never sits on green and the ground never turns green; the frame encloses, the slots hold.

**The Brass Is Identity Rule.** Brass marks who something is (a designator, a pairing step, the pairing code), never what state it is in.

## Typography

**Body Font:** the system UI face (`-apple-system`, SF Pro Text, `system-ui`)
**Label Font:** Courier Prime, 400 and 700 (self-hosted)
**Code Font:** JetBrains Mono, 400 and 600 (self-hosted)

**Character:** The phone's own face does all the reading, so nothing fights Dynamic Type or the OS. A typewriter face stamps the labels the way a post room would, and a real coding mono carries anything that came out of a machine.

### Hierarchy
- **Display** (700, 28px, 1.15, -0.02em): pairing screen headings only.
- **Headline** (700, 20px, 1.15, -0.01em): the top bar's Mac or session name, with a 500 12px muted subtitle line under it.
- **Title** (600, 15px, 1.25): slot row titles (14px on board cards); 17px 700 for the ask card's question and empty-state titles.
- **Body** (400, 15px, 1.4; 1.5 in chat): agent prose, user bubbles, pairing copy. Sublines are 13px in `ink-secondary`, single-line with ellipsis.
- **Tab Label** (700, 11px, 0.06em, uppercase, system UI): the words on a tab. The one place uppercase system type appears.
- **Label** (Courier Prime 700, 13px, 0.08em, uppercase): project shelf names and board column heads. Paths beside them are Courier Prime 400 12px in `ink-tertiary`.
- **Plate** (Courier Prime 700, 12px, 0.04em; 14px on the large plate): designators.
- **Code** (JetBrains Mono 400, 12.5–13px): inline code, tool chips, keys and fingerprints on the Mac sheet; 12px/1.42 in the terminal; 600 38px for the ten-digit pairing code. Only the loaded weights (400, 600) are used.

### Named Rules
**The Three Voices Rule.** System UI reads, Courier Prime labels, JetBrains Mono quotes the machine. Courier Prime never sets a sentence; JetBrains Mono never sets UI chrome.

**The Tabular Time Rule.** Every count and duration uses tabular figures so a ticking timer never jitters.

## Layout

A single phone column (designed at 390×844, standalone). Each screen is a full-bleed flex column: frame header, optional banner, one scrolling region, and a frame tab bar or composer pinned at the bottom. There are no breakpoints.

- **Gutters:** 16px on both sides for shelves and slot groups; 24px on pairing screens.
- **Shelves:** a Courier Prime label row (18px above, 6px below) followed by one rounded slot group; projects stack vertically.
- **Rows:** a three-column grid (plate, title/subline, meta) with 12px column gap, 12px × 14px padding and a 64px minimum height. A flagged row reserves 70px on the right for its tab. A working row adds a full-width duration rule beneath the title column.
- **Board:** horizontal, scroll-snapped 300px columns with 12px gaps, swiped one-handed; cards move by a per-card Move menu, not drag.
- **Safe areas:** the top bar pads `env(safe-area-inset-top) + 8px`; the tab bar, composer and terminal key bar pad `max(8–10px, env(safe-area-inset-bottom))`. The body is `100dvh`, overflow hidden, overscroll none, tap highlight off.
- **Touch targets:** 44px is the floor for every control: buttons, icon buttons, chips, the composer field and send button, terminal keys, the Retry and Move text actions (padded to 44px tall), the board project picker and the Mac sheet's select. Segments are 38px inside a 3px-padded track, so the tappable band is 44px. Tab-bar items and fact rows are 48px; slot rows 64px.
- **Motion:** screens slide in 14px over 260ms on `cubic-bezier(.16, 1, .3, 1)` (reversed when going back). Under `prefers-reduced-motion` the screen slide, the tab slide-out and the working ring's spin all stop.

## Elevation & Depth

Depth is one soft, low shadow under every slot-coloured surface plus hairlines inside it. Surfaces never stack more than one level: the ground, then a slot group, ask card, board card or fact sheet. Inner structure is drawn with 1px `rule` dividers and 1–1.5px inset outlines, not with further shadows. The only object that casts its own shadow is the tab, because it is physically pushed out over the edge.

### Shadow Vocabulary
- **Slot shadow** (`0 6px 18px -8px rgb(22 28 26 / 0.35)`; dark `0 8px 22px -10px rgb(0 0 0 / 0.7)`): every slot group, card and sheet.
- **Tab cast** (`0 3px 8px -3px rgb(0 0 0 / .45)`): the needs-you tab only.
- **Inset outlines** (`inset 0 0 0 1px rule`, `inset 0 0 0 1.5px tab | brass | rule-strong`): quiet buttons, chips, bubbles, tool chips, fields; the ask card's vermilion ring; the pairing code's brass ring; the outlined `NEW` tab.

### Named Rules
**The One Shadow Rule.** A surface either sits on the ground with the slot shadow or it sits inside one with hairlines. Nothing floats over a slot except the tab.

## Shapes

Softly rounded, slightly squarer the smaller and more "stamped" a thing is. Plates are near-square metal (3px). Keys and tool chips are 8px, buttons and cards 12px, slot groups and sheets 14px, the ask card and user bubbles 16px (the bubble's tail corner is 4px), the camera viewfinder 20px. Fields, chips and the send button are pills or circles. The tab is asymmetric (6px on its leading corners, 3px on its trailing ones) because it is an index tab, and the tab-bar count copies that silhouette at 4px/2px. Icons are a single drawn set on a 24-unit grid, 1.75 stroke, round caps and joins, 22px (18px small).

## Components

### Buttons
Solid, flat, full-width-friendly slabs.
- **Shape:** gently rounded (12px), 44px tall, 16px horizontal padding, 600 15px.
- **Primary:** ink fill with slot-coloured text. For neutral commits (add the default board).
- **Answer:** vermilion fill with tab ink. Only inside an ask card. Disabled answers fade to a 35% vermilion tint with ink text, still readable.
- **Quiet:** recessed slot fill with a 1px rule inset. Secondary answers (Deny, Accept edits, Revise…, Answer in the terminal) and Mac-sheet actions.
- **Disabled:** 45% opacity.

### Chips
- **Style:** slot fill, 1px strong-rule inset, rounded 18px, 44px tall, 500 14px.
- **State:** selected inverts to ink fill and slot text with no outline. Used for question options and the board's Move-to choices.

### Cards / Containers
- **Slot group:** slot fill, 14px corners, slot shadow, rows separated by 1px rules; rows press to recessed slot.
- **Ask card:** slot fill, 16px corners, slot shadow plus a 1.5px vermilion inset ring; 17px bold question, body capped at 46vh and scrollable, actions in a grid (two-up for paired options). Once answered it calms to a 1px strong-rule ring and a receipt line replaces it.
- **Board card:** slot fill, 12px corners, slot shadow, plate + title + state line + Move; keeps its tab.
- **Fact sheet (Mac):** slot group of 48px definition rows.

### Inputs / Fields
- **Composer field:** pill (22px), slot fill, 1px strong-rule inset, 16px text so iOS never zooms; focus draws a 2px working-green inset. When the agent is not idle the field is replaced by a lock icon and the desktop's reason.
- **Send:** a 44px ink circle with an up-arrow; 35% opacity when locked.
- **Focus (global):** 2px working-green outline, 2px offset, 6px radius.

### Navigation
- **Top bar:** frame green, 20px bold name with a 12px muted status line (live dot or hollow ring + "Live · 8 sessions in 3 projects" / "Last seen …").
- **Segmented filter:** a raised-enamel track (10px, 3px padding) of 38px, 8px-cornered segments (a 44px band), 600 13px with tabular counts; the selected segment is a frame-ink chip with frame-green text. Used for All / Need you / Working and Chat / Terminal.
- **Tab bar:** frame green, three 48px items (icon over 11px label). The current item brightens to frame ink and gets a 28×3px frame-ink notch hanging from the top edge. Sessions carries the vermilion count notch.

### The Tab (signature)
A needs-you session's tab is absolutely placed at the vertical centre of its slot and pushed 7px past the right edge (`right: -7px`), 26px tall, at least 58px wide, vermilion with tab ink, 11px bold uppercase word. Its trailing bottom corner shows a **fold**: a 4px triangle of vermilion darkened 55% toward black, as if the tab were tucked under the slot. It arrives by **sliding out** from 34px inside the slot, fading from 0, over 420ms on `cubic-bezier(.16, 1, .3, 1)`; under reduced motion it is simply present. A finished, unread turn gets a `NEW` tab in the same position, transparent with a 1.5px strong-rule outline, no fold and no shadow.
- **In the session header** the same tab sits inline at the end of the title line, static: no offset, no fold, no slide.
- **In the tab bar** it shrinks to the count notch over the Sessions icon: 10px bold tabular number, 15px tall, 18px minimum, with the tab's asymmetric 4px/2px corners.

### Designator Plate
Flat brass (no gradient, no bevel, no shadow), Courier Prime 700 12px with brass ink, 3px corners, 5/6/4px padding. Aligned to the top of its row. The large variant (14px, 6/8/5px padding) appears in the session header and as the `MAC` plate on the Mac sheet.

### Duration Rule
A working row draws a 2px working-green rule under its title whose length is time in state (a full rule is 30 minutes, minimum 4%), over a dotted strong-rule track. The elapsed time sits at the rule's end in 500 11px working green, tabular, on a slot-coloured knock-out. When the status is stale the rule turns into a 4px hatch of 135° `ink-tertiary` stripes (2px on, 3px off) and the state reads "Working?".

### State Line
An 8px ring in the state's colour: open and spinning (1.1s linear; static under reduced motion) for working, dashed for idle, a 2px-cornered square for asleep, a plain ring for done; followed by a 500 12px word.

### Banners and Notes
One full-width line under the header whenever the link is not live (recessed slot, 1px rule below, working-green Retry at 44px). A denied link and a refused send switch to slot with ink text at weight 600; an unconfirmed send uses the brass wash. A failed answer or failed pairing is an ink 600 line, never vermilion. (The base `.pair-error` rule in app.css still names `var(--tab)`, but `.pair .pair-error` always overrides it with ink 600, so no vermilion renders; the dead declaration is leftover, not a rule.)

## Do's and Don'ts

### Do:
- **Do** put the tab at the right edge, pushed 7px past the slot, with its fold and its 420ms slide-out, wherever a session needs the owner in a list.
- **Do** keep the designator plate identical (brass, Courier Prime 700, 3px) in every place a session appears.
- **Do** draw working time as rule length with the time label at the rule's end, and hatch it the moment it is stale.
- **Do** give every state a shape or word as well as a colour.
- **Do** hold every control at 44px (segments may be 38px only inside the 3px-padded track) and rows at 64px.
- **Do** pad the shell with `env(safe-area-inset-top)` and the bottom bars with `max(…, env(safe-area-inset-bottom))`.
- **Do** use one slot shadow per surface and hairline rules inside it.
- **Do** define every colour for both themes and check AA in both, including muted text on the ground (ink-tertiary 4.77:1, working green 5.15:1 in light).

### Don't:
- **Don't** use vermilion for errors, refusals, warnings, destructive actions or decoration; it means "answer me". Errors are ink at weight 600.
- **Don't** put a red count badge on a grey list; the tab is the badge.
- **Don't** set sentences in Courier Prime or chrome in JetBrains Mono.
- **Don't** give brass plates gradients, bevels or shadows.
- **Don't** stack shadows or float anything over a slot except the tab.
- **Don't** put content on frame green or turn the ground green.
- **Don't** draw a stale or unknown state solid.
