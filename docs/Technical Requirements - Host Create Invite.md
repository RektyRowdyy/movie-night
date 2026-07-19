# Movie Night Picker — Host "Create an Invite" (Authoring UI)

> Addendum to `Technical Requirements.md`. This promotes the item previously listed as **out of scope (§10)** and §3.2.1 ("assume a minimal form or config file for v1") into a fully specified feature. Reference design: the **"MAYA BUILDS IT FIRST"** interactive phone in `Movie Night Picker.dc.html`.

## 1. Summary
A host-only, mobile-first authoring flow that lets a host build a complete Movie Night invite — the note, the When / Where / Bring details, and exactly three movies — then produces one shareable guest link. Output of this flow is a single `Invite` record (per the existing §4 data model) plus its three `Movie` records; it is the write-side that every read-side state in §5 depends on.

## 2. Entry & Access
- **Route:** `/create` (new invite) and `/create/:inviteId` (resume/edit an existing draft or sent invite).
- **Host-only.** No guest ever reaches this route; it is not linked from the guest invite/picker/confirmation screens.
- No account required for v1, but the created invite must be re-openable by the host (see §8 Persistence) — the host link is the credential.
- Desktop: same three-step flow rendered in the centered column (≥960px) per the existing invite/picker desktop treatment; no separate layout required.

## 3. Flow — Three Steps + Sent
Single-screen wizard with a 3-segment progress indicator. Forward nav is a single primary CTA; every step after the first has a **Back** control. State is retained when moving between steps (no data loss on Back).

### 3.1 Step 1 — The Details
Fields, all editable, seeded with sensible defaults for the demo:
| Field | Input | Maps to | Rules |
|---|---|---|---|
| From (you) | text | `Invite.hostName` | required, non-empty |
| Inviting | text | `Invite.guestName` | required, non-empty |
| Your note | textarea | `Invite.note` | required; free text, multi-line preserved |
| When — Date | `<input type="date">` | `Invite.eventAt` (date part) | required; drives `expiresAt` |
| Time | `<input type="time">` | `Invite.eventAt` (time part) | required |
| Where | text | `Invite.location` | required |
| Bring | text | `Invite.bring` *(new field — see §7)* | optional; default "Just yourself" |

- `eventAt` is composed from Date + Time in the host's local timezone; store as ISO 8601 with offset. `expiresAt` derives per existing §11 grace-window decision.
- CTA "Next — Add the movies" is disabled until required fields validate.

### 3.2 Step 2 — The Shortlist (exactly 3 movies)
- Three ordered slots. A **filled** slot shows a mini poster (bg/fg treatment), title, and `year · runtime · genre`; tapping opens the editor. An **empty** slot shows a dashed "＋ Add movie N" affordance; tapping opens the editor.
- A running "N of 3 added" counter. **Review CTA is enabled only when all three are filled** (a filled slot = non-empty title, minimum bar); otherwise show "Add N more to continue".
- **Movie editor** — a bottom sheet (mobile) / modal (desktop), header tinted with the movie's poster colour. Fields map to the `Movie` model (§4 of base spec):
  - Title *(required)*, Year, Runtime (free text e.g. "1h 32m"), Rating (nullable), Genre, **Mood tag** (shown on the ticket), **One-line hook** (picker card), Director, Synopsis (textarea), **Trailer search** term (used to build the external YouTube URL), **Poster colour** (choice from a curated preset palette → `posterTreatment.bg`/`.fg`).
  - Edits apply live (no separate save inside the sheet); "Done" dismisses. Order of the three slots is preserved as the ordered `movies` array.

### 3.3 Step 3 — Review
- Read-only preview: the invite card (note, host signature) + the dashed When/Where/Bring stub with the **formatted** event datetime (e.g. "Fri · Feb 13 · 8:00 PM"), and the three tickets in order.
- Back returns to editing with all state intact. Primary CTA "Send the invite" commits the record.

### 3.4 Sent
- On commit: persist the `Invite` + `Movie[]`, set `status: "waiting"`, generate the guest link, and show it with a **Copy** action (uses `navigator.clipboard`, with a visible "Copied ✓" confirmation; graceful no-op if the API is unavailable).
- Present the host **push opt-in** entry point here (per base §6 — permission requested on explicit host action, never on load) plus "Saved — edit anytime" and "Build another".

## 4. Link Generation
- Guest link format resolved by base §11 (guessable-short vs. opaque token). The design mock shows a human-readable slug (`movienight.link/<host>-<weekday>`) for illustration only — production should follow the §11 decision; if opaque, the displayed string is cosmetic and the real token is what's copied.
- Copying must copy the fully-qualified URL (`https://…`), not the display slug.

## 5. Validation & Edge Cases
- Cannot reach Review without: 3 filled movies + all required Step-1 fields.
- Each movie requires at minimum a **title**; recommend also requiring hook + poster colour so picker/detail render without gaps.
- Event date in the past: warn on Send (the invite would immediately read as **Expired** per base §5); allow override or block per product call.
- Editing an already-**answered** invite: define policy — v1 recommendation is to lock the three movies once a guest has picked (changing the shortlist would invalidate `pickedMovieId`); the note/where/bring may remain editable. Coordinate with base §4 note that `status`/`pickedMovieId` is the single source of truth.
- Duplicate/near-empty movies allowed structurally but discouraged via inline hints.

## 6. State Model (authoring-local)
Client draft state prior to commit:
```
CreateDraft {
  step: 1 | 2 | 3 | 4
  editing: 0 | 1 | 2 | null      // which movie slot the editor is on
  hostName, guestName, note: string
  date: "YYYY-MM-DD", time: "HH:mm"
  location, bring: string
  movies: [MovieDraft, MovieDraft, MovieDraft]  // ordered, exactly 3
}
MovieDraft {
  title, year, runtime, genre, moodTag, hook, director, synopsis: string
  rating: string | null
  trailerq: string              // search term → trailerUrl on commit
  posterBg, posterFg: string    // → posterTreatment
}
```
- On Send, `CreateDraft` maps to the base §4 `Invite` + `Movie[]` (compose `eventAt` from date+time; build `trailerUrl` from `trailerq`; set `status:"waiting"`, `pickedMovieId:null`, `swapsUsed:0`, timestamps).

## 7. Data Model Change
- **New field `Invite.bring: string`** (default "Just yourself"). Base §4 currently lacks it; the guest Invite screen already renders a BRING row, so persist it rather than hardcoding. Non-breaking additive change.

## 8. Persistence & Backend
- On Send: single write creating the invite + movies + initial `status:"waiting"`; returns the guest link/token and a host handle for `/host/:inviteId`.
- Draft autosave (optional v1, recommended): persist `CreateDraft` locally (or server draft) so a refresh mid-authoring doesn't lose work; formal drafts can follow.
- No new push infrastructure — reuses base §6 host subscription store; the opt-in shown on the Sent screen registers the host subscription keyed to this invite.

## 9. Accessibility
- Every field has a persistent visible label (not placeholder-only) and a real focus state; the poster-colour swatches are keyboard-focusable buttons with an accessible name per colour and a clear selected state (not colour-alone — use a ring/checkmark).
- Editor sheet is a focus-trapped dialog with a labelled Close/Done and Escape-to-dismiss; focus returns to the originating slot.
- Progress indicator announces "Step N of 3, <title>" to assistive tech.
- Respect `prefers-reduced-motion` for the sheet slide-up and Sent-screen rises (instant states).
- Tap targets ≥44×44px; primary CTA reachable in the bottom thumb zone; layout reflows (no clip) at 200% text zoom.
- Native date/time controls used for correctness and platform pickers.

## 10. Content / Copy
- Seed copy (default note, field placeholders, "Punch my ticket" downstream, Sent-screen microcopy) carried from the reference design as production copy per base §9. Placeholders ("Your place, an address…", "The line that sells it") are guidance, not stored values.

## 11. Out of Scope (this pass)
- Movie **search / metadata lookup** and real poster **image** upload (still §10 of base) — v1 authoring is manual text + preset poster colours only.
- Multi-guest / group invites; more or fewer than three movies.
- Rich text in the note; scheduling/reminders beyond the single event datetime.
