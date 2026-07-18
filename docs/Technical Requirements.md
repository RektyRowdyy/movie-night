# Movie Night Picker — Technical Requirements

## 1. Summary
A single-purpose, installable PWA that delivers a one-link movie-night invite. A host (Maya) shortlists three movies; a guest (Sam) opens the link, browses, and picks one. The host is notified via push the moment a pick is made. No accounts, no guest install required.

Reference design: `Movie Night Picker.dc.html` (visual/interaction spec — screens, copy, states, animation timing all defined there).

## 2. Platforms & Delivery
- **Type:** Progressive Web App, installable (Add to Home Screen) via Web App Manifest + Service Worker.
- **Guest path:** no install required — full flow works in mobile browser from a single URL.
- **Host path:** install recommended (required for push notifications on iOS Safari; optional but same requirement in practice on Android/Chrome).
- **Target viewports:** 375–430px (primary, mobile), plus a centered desktop column ≥960px for invite + picker. No tablet-specific layout required.
- **Browsers:** latest 2 versions of Safari iOS, Chrome Android, Chrome/Edge/Safari desktop.

## 3. Core User Flows

### 3.1 Guest flow
1. **Invite** (`/i/:inviteId`) — personal note, occasion, date/time, place. Single CTA reveals the shortlist.
2. **Picker** — three ticket cards (poster, title, year, runtime, one-line hook, mood tag). Tapping a card opens detail; it must NOT commit a choice.
3. **Detail** (sheet on mobile / full page on desktop) — poster, meta, genre tags, director, synopsis, rating, external trailer link (opens YouTube in new tab/target), and the commit action ("Punch my ticket").
4. **Commit** — plays a short (~1s) confirmation animation, then transitions to Confirmation. Must have an instant (no-animation) path when `prefers-reduced-motion: reduce`.
5. **Confirmation** — shows the pick, event details, and that the host has been notified. Exactly **one** re-pick is allowed post-commit; after that the pick is locked.
6. **Re-open after answering** — guest returning to the link sees "Already answered" state, not the picker.
7. **Expired** — once the event datetime has passed, invite becomes read-only regardless of answered state, showing an expired message.

### 3.2 Host flow
1. **Create invite** — host selects/enters 3 movies + occasion/date/time/place + guest name. (Out of scope for this design pass to fully spec the authoring UI; assume a minimal form or config file for v1.)
2. **Host view** (`/host/:inviteId`) — status card: Waiting (not opened / opened not answered) or Answered (shows pick + timestamp, other two shown de-emphasized).
3. **Push opt-in** — host is prompted to enable notifications on invite creation or first host-view visit; graceful fallback (poll/show status in-app) if declined or unsupported.
4. **Push notification** — delivered the moment the guest commits; deep-links to host view.

## 4. Data Model (minimum viable)

```
Invite {
  id: string
  hostName: string
  guestName: string
  note: string                 // free text invite copy
  eventAt: ISODateTime
  location: string
  createdAt: ISODateTime
  expiresAt: ISODateTime       // derived: eventAt (+ grace window, e.g. +4h)
  movies: [MovieRef, MovieRef, MovieRef]   // ordered, exactly 3
  status: "waiting" | "answered"
  pickedMovieId: string | null
  answeredAt: ISODateTime | null
  swapsUsed: 0 | 1
  openedAt: ISODateTime | null  // first guest open, for "opened not answered" host copy
}

Movie {
  id: string
  title: string
  year: number
  runtimeMinutes: number
  genres: string[]              // tag chips
  moodTag: string                // e.g. "EPIC · SEAFARING"
  hook: string                   // one-line, picker card
  synopsis: string                // 2–4 sentences, detail view
  director: string
  rating: number | null
  trailerUrl: string             // external YouTube URL
  posterTreatment: { bg: string, fg: string }  // or posterImageUrl once real art exists
}
```

- Invites are single-use per guest link; no multi-guest voting in v1.
- `status`/`pickedMovieId` transition is the single source of truth for both the "already answered" guest state and the host "answered" state — must be consistent across both views (same read).

## 5. State Matrix (must all be reachable and tested)

| State | Guest sees | Host sees |
|---|---|---|
| Not yet opened | Invite screen | Waiting — "not opened yet" |
| Opened, not answered | Picker / detail | Waiting — "opened, no answer yet" |
| Answered (before event) | Confirmation (or re-open → "already answered") | Answered — pick + timestamp |
| Re-pick used | Confirmation, no further swap offered | Answered (updates to new pick) |
| Expired (event time passed) | Expired screen, regardless of answered/unanswered | Same data, no live "waiting" framing — event has passed |
| Push permission — granted | n/a (guest never sees push UI) | Confirms enabled |
| Push permission — declined/unsupported | n/a | Fallback copy: pick will show in-app on reopen |

## 6. Push Notifications
- **Host-only.** Guest never registers for or receives push.
- Web Push API + Service Worker (`push` event) + Notification API for display.
- Requires host permission grant (`Notification.requestPermission()`), triggered by explicit host action, not on load.
- Payload: short title + body per the mocked copy ("Sam punched their ticket 🎬 — It's Sheep Detectives for Friday…"), tapping deep-links to `/host/:inviteId`.
- Fallback when denied/unsupported: host view polls or refetches on focus/visibility-change so the answered state still appears without push.
- Backend needs a push subscription store keyed to the host per invite, and a trigger on the guest's commit write.

## 7. Offline / PWA Requirements
- **Service Worker:** precache app shell (HTML/CSS/JS/fonts/icons) so invite, picker, detail, and confirmation screens render fully offline once loaded.
- **Explicit exception:** trailer links (external YouTube) require network and should not be treated as a PWA failure when offline — show/allow the normal "can't reach" browser behavior for that one outbound link.
- **Web App Manifest:** name, short_name, icons (192/512 + maskable), theme_color/background_color matching the lobby palette (`#241410` background, `#c4362a` theme), display: `standalone`, start_url scoped per invite or to a generic landing if no invite id.
- **Launch/splash screen:** per the design's splash mock (marquee bulbs + wordmark on `#170c08`→`#3c2018`); iOS uses manifest+meta splash generation or static splash images per device size.
- **App icon:** per the design's icon concept (red ticket-booth icon, cream ticket window, marquee dots) — needs export at standard PWA sizes (48/72/96/128/144/152/192/384/512) plus a maskable-safe variant (icon content within the safe circle).
- Local commit/re-pick state should not require network round-trip to render the confirmation optimistically, but must sync to backend to update host state.

## 8. Accessibility
- Contrast: cream-on-ink and ink-on-cream body text pass **AA** at their sizes; verify the red CTA (`#c4362a`) against its cream label meets AA for the button's actual (large/bold) text size.
- Real visible **focus states** on every interactive element (cards, buttons, links) — do not rely on hover-only affordances.
- Layout must not break at **200% text zoom**: ticket cards, sheet, and confirm ticket need to reflow (stack/wrap) rather than clip or overlap at large text sizes.
- Respect `prefers-reduced-motion: reduce`: skip the punch animation, sheet slide-up, and marquee bulb pulsing in favor of instant/static states.
- All tap targets ≥44×44px; commit action reachable one-handed in the bottom thumb zone.
- Trailer link must be announced as external/opens-new-tab to assistive tech (e.g. `aria-label="Watch the trailer, opens YouTube in a new tab"`).

## 9. Content / Copy Ownership
Microcopy (invite note, empty states, confirmation, notification text, commit wording "Punch my ticket") is authored in the reference design and should be treated as production copy, not placeholder — carry it into implementation verbatim unless product/legal review changes it.

## 10. Out of Scope (v1)
- Host authoring UI for building a new invite (movie search/selection, uploading real posters).
- Multi-guest / group voting.
- Real poster artwork and licensed movie data (current content is invented placeholder metadata).
- Account system, guest login, or invite history.
- Analytics/telemetry (flag for a follow-up decision if needed).

## 11. Open Decisions for Engineering
- Backend/hosting choice for invite storage + push subscription store (Firebase, Supabase, custom API — no preference set by design).
- Exact expiry grace window after `eventAt` (design assumes a few hours grace before "expired" shows, TBD).
- Whether invite IDs are guessable/short (shareable) vs. opaque tokens (more private) — affects link format.
