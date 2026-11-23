# Implementation Plan: Keep Notes (Web)

## 1. Document Info
- **Project:** Keep Notes (Web)
- **Version:** 1.1 (derived from architecture v0.6, design review Section 7.13, requirements v0.8)
- **Date:** 2026-11-16
- **Status:** Completed. Planning v1.1 approved by the user on 2026-11-16 ("mark it completed"). Open items are recorded in Section 6. Implementation starts only after per-task approval, beginning with B-01.
- **MVP Scope:** All features marked MVP in requirements Section 4. FR-14 to FR-21 are out of scope (architecture Section 12).
- **Write scope:** Implementation tasks write only under `client/**` and `server/**`, per the `implementation` registry entry. Any change outside those paths needs a separate human decision.

## 2. Phase Assignment Strategy
- **Backend:** configuration, database schema, error model, validation, service rules (archive, overflow, delete relinking, idempotent retries, `updatedAt`), API routes, middleware, startup
- **Frontend:** React components, hooks, drafts and autosave, load reconciliation, search and color filter, responsive layout, accessibility
- **Testing:** palette and contrast unit test, Supertest integration tests, Playwright timing, end-to-end, and accessibility checks
- Every task has one primary phase. Each implementation task includes the unit tests for its own behavior. Code review and verification are separate registry phases (`code-review`, `verify`), gated in Section 7 rather than listed as tasks.

## 3. Entry Criteria and Exit Gates

### Backend Phase
- **Entry:** Architecture v0.6 and design-review Section 7.13 accepted; planning approved by the user.
- **Exit:** B-01 to B-13 complete; unit tests pass; server starts and binds to `127.0.0.1`.

### Frontend Phase
- **Entry:** F-01, F-02, F-03, F-09, and F-10 have no API dependency and may start first. Tasks that call the API start after B-11.
- **Exit:** F-01 to F-17 complete; Vitest passes; `npm run build` succeeds.

### Testing Phase
- **Entry:** Backend and frontend exit gates met.
- **Exit:** T-01 to T-06 pass; test evidence is recorded for the verify phase.

## 4. Task Breakdown by Phase

### Backend Phase (B-01 to B-13)

#### B-01: Configuration and environment
- Create `server/src/config.ts` reading `PORT`, `DB_PATH`, `CLIENT_URL`, and `NODE_ENV`. Add `server/.env.example` with placeholder values only. Add `server/.gitignore` entries for `.env` and the default database file.
- Depends: none
- Traces: NFR-04; Architecture Sections 9, 10
- Check: config loads from `.env`; no `HOST` setting exists; `.env` and the database file are not tracked by git

#### B-02: Database schema and connection
- `server/src/db/database.ts`: create the tables and index from Architecture Section 7 with `better-sqlite3`. Set `PRAGMA foreign_keys = ON` on every connection. Create the schema on startup if it is missing. No migrations (A-09).
- Depends: B-01
- Traces: FR-12, NFR-10; Architecture Section 7
- Check: schema matches Section 7; startup is repeatable without error; foreign keys are on

#### B-03: Error model
- `errors/AppError.ts` and `errors/errorHandler.ts` produce the Section 6 format for `VALIDATION_ERROR`, `NOTE_ARCHIVED`, `NOT_FOUND`, and `INTERNAL_ERROR`. Malformed JSON and oversized bodies map to 400 `VALIDATION_ERROR`. Unexpected errors are logged on the server only.
- Depends: none
- Traces: NFR-12; Architecture Sections 6, 9
- Check: each code returns its documented status; a 500 body exposes no stack or internals (unit test)

#### B-04: Input validation and server palette
- `server/src/constants/palette.ts` holds the 8 palette values (A-01). `server/src/validation/noteValidation.ts` (hand-written, A-02) enforces: `title` 0 to 200 and `body` 0 to 10,000 code points; `color` from the palette; `checklistItems` 0 to 50 items with text 0 to 80 code points; UUID `id`; `isPinned` and `isArchived` booleans on PATCH only; unknown fields rejected; `archived` query exactly `true` or `false`.
- Depends: B-03
- Traces: FR-07, FR-11, NFR-12; Architecture Section 6 Validation, N-04, N-10
- Check: each rule has a passing and a failing unit test; a multi-code-point emoji is counted by code point

#### B-05: Notes repository
- `server/src/db/notesRepository.ts`: prepared statements with bound parameters only. Read notes with checklist items in one query for a list. Insert, update, and delete helpers, plus a transaction helper.
- Depends: B-02
- Traces: NFR-03, FR-03; Architecture Section 7
- Check: no SQL built by string concatenation; the list query loads checklist items for all returned notes in one query

#### B-06: Note create, read, list, and update rules
- `server/src/services/notesService.ts`: create sets timestamps, white color, unpinned, and unarchived. List orders by `is_pinned DESC, updated_at DESC, id`. PATCH is atomic. Archive forces `isPinned: false`. A PATCH that only sets `isArchived: false` unarchives. Other edits to an archived note return 400 `NOTE_ARCHIVED`. `updatedAt` changes only when a stored field value changes.
- Depends: B-04, B-05
- Traces: FR-01, FR-03, FR-06, FR-10, FR-13, D-04; Architecture Section 6 Rules
- Check: unit tests cover archive, unarchive, combined `isArchived: false` with other changes (400 `VALIDATION_ERROR`), a no-op save that leaves `updatedAt` unchanged, and ordering with an `id` tie-breaker

#### B-07: Repeated POST idempotency
- POST with an existing `id` returns the stored note with 200 when the content matches. Matching uses N-11 normalization: omitted `color` is `white`, and checklist order is significant. Different content returns 400 `VALIDATION_ERROR` and changes nothing.
- Depends: B-06
- Traces: N-01, N-11, M-04; Architecture Sections 6 and 8 (New notes)
- Check: identical retry returns 200; different content returns 400 and the stored note is unchanged

#### B-08: Overflow creation
- `POST /api/notes/:id/overflow` with body `{ id, text, isChecked }`. Checks run in this order (P-02 and R3-01): (1) if `original.continuedInId` equals `id`, identical content returns 200 with the stored pair and changes nothing; different content returns 400. (2) If `id` belongs to another note, return 400. (3) If `original.continuedInId` is set to another ID, return 400. (4) Otherwise check the 50-item, archived, and tail-of-chain rules, then create the note and update the original in one transaction, returning 201. The title is `Continued from [title]`, truncated so the full title is at most 200 characters; an empty title gives `Continued from Untitled`.
- Depends: B-05, B-06
- Traces: FR-11, D-02, D-03, M-01, M-02, M-03, O-03, P-02, R3-01; Architecture Sections 6 and 13 (A-04, A-08)
- Check: a retry after a lost 201 returns 200 (R3-01); a 200-character title truncates correctly; 49 items, archived original, and a non-tail original return their documented errors

#### B-09: Delete with overflow relinking
- Delete runs in one transaction. Neighbour links update first, then the note is removed (N-08): middle, head, tail, and standalone cases as written in Architecture Section 6. Relinking changes only link fields, so neighbours' `updatedAt` is unchanged (D-05). `ON DELETE SET NULL` is a backstop only.
- Depends: B-06
- Traces: FR-05, N-08, D-05
- Check: unit tests for each neighbour case; a missing `id` returns 404 `NOT_FOUND`

#### B-10: Checklist replacement and item limit
- A PATCH with `checklistItems` deletes the existing rows and inserts the new list in one transaction (P-08). A list above 50 items returns 400. Checked items keep their array position.
- Depends: B-06
- Traces: FR-11, M-06, P-08; Architecture Section 7
- Check: replacement never violates `UNIQUE (note_id, position)`; a 51-item PATCH returns 400 and changes nothing

#### B-11: API routes
- `server/src/routes/notesRoutes.ts` wires the six endpoints in Architecture Section 6: GET list (`archived` required), GET by id, POST, PATCH, DELETE (204), and POST overflow.
- Depends: B-07, B-08, B-09, B-10
- Traces: NFR-12; Architecture Section 6 Endpoints
- Check: each endpoint returns its documented success and error statuses (route unit tests with services stubbed; full coverage in T-02)

#### B-12: Express middleware
- In `app.ts`: JSON body limit 100 KB; CORS that allows only the `CLIENT_URL` origin, with methods GET, POST, PATCH, DELETE, and OPTIONS and header `Content-Type`; OPTIONS answered with 204; `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'`. Use small in-house middleware, with no new dependency (N-07).
- Depends: B-03
- Traces: N-07, NFR-03; Architecture Section 9
- Check: unit tests for the preflight status, allowed origin and headers, and security headers

#### B-13: Application startup
- `app.ts` exports the Express app without calling listen. `server.ts` initializes the database and listens on `127.0.0.1` at `PORT`. No `HOST` setting (P-09).
- Depends: B-02, B-11, B-12
- Traces: P-09, FR-12; Architecture Sections 9, 10
- Check: server starts, creates the schema, and binds to `127.0.0.1` only



### Frontend Phase (F-01 to F-17)

#### F-01: Project scaffold
- Vite, React, TypeScript, and Tailwind CSS in `client/`. Create `client/tests/unit` and `client/tests/e2e`. Configure Vitest. Add `client/.gitignore` for `node_modules` and `.env`.
- Depends: none (dependency installation needs approval)
- Traces: NFR-10, NFR-11; Architecture Sections 3, 10
- Check: `npm run build` and the dev server start; Vitest runs

#### F-02: Palette
- `client/src/lib/palette.ts`: the 8 preset colors (white, red, orange, yellow, green, teal, blue, purple; A-01). Each color has a note background and a checked-item muted text color.
- Depends: F-01
- Traces: FR-07, FR-11, N-09; Architecture Sections 8, 10, 13 (A-01)
- Check: exports 8 colors including white; each has a muted text value (verified in T-01)

#### F-03: Shared limits and time utilities
- `client/src/lib/limits.ts`: title 200, body 10,000, item text 80, 50 items per note. `client/src/lib/time.ts`: formats UTC ISO timestamps in the user's local time zone. Truncation counts code points.
- Depends: F-01
- Traces: FR-11, NFR-10; Architecture Sections 8, 10
- Check: unit tests for code-point truncation to 80 and UTC-to-local formatting

#### F-04: API client
- `client/src/api/notesApi.ts`: typed functions for the six endpoints. Parses `error.code`. Separates network failure, 400, 404, and 5xx.
- Depends: F-01; B-11 contract
- Traces: FR-12; Architecture Sections 6, 8
- Check: unit tests with a mocked `fetch` for each status class and a network failure

#### F-05: Draft store
- `client/src/hooks/useDrafts.ts`: drafts in `localStorage` keyed by note ID. Each draft records `draftedAt` and a `rejected` flag. Overflow drafts are keyed by the original note ID and the new UUID. A draft is cleared only on a matching 200 or 201. Discard and Copy actions (Copy places plain text on the clipboard).
- Depends: F-04
- Traces: FR-12, N-03, P-02, P-07, A-13; Architecture Section 8
- Check: a draft survives reload; a rejected draft is not replayed; Copy writes plain text

#### F-06: Autosave
- `client/src/hooks/useAutoSave.ts`: triggers on blur, after a 2-second pause, and on the `online` event. One request in flight per note; the latest state is sent next. 400 marks the draft rejected and stops retrying. 404 removes the note from the view, discards the draft, and shows the note-removed message. 500 or network failure keeps the draft and retries.
- Depends: F-04, F-05, F-09
- Traces: FR-04, FR-12, M-05, M-06, N-03; Architecture Sections 5, 8
- Check: unit tests with fake timers for serialization, retry, 400, and 404

#### F-07: Load reconciliation
- On load, a non-rejected draft is compared with the server copy's `updatedAt`. If the server copy is newer than `draftedAt`, ask the user to confirm before applying. Otherwise apply and save. A rejected draft is checked with `GET /api/notes/:id` and removed on 404 (R3-02).
- Depends: F-04, F-05, F-06
- Traces: FR-12, P-07, R3-02, A-07; Architecture Section 8
- Check: unit tests cover the newer-server confirmation, the apply-and-save path, and rejected-draft removal on 404

#### F-08: Notes state
- `client/src/hooks/useNotes.ts`: fetches `archived=false` and `archived=true`. Splits the views. Applies the trimmed search (FR-08) and color filter (FR-09) over the listed notes. Stores the query and selected colors in `sessionStorage`.
- Depends: F-02, F-04
- Traces: FR-03, FR-06, FR-08, FR-09; Architecture Section 8
- Check: unit tests: a whitespace-only query applies no search; a note matches on any selected color; state restores from `sessionStorage`

#### F-09: Toast and shared messages
- `client/src/components/Toast.tsx` with `aria-live="polite"`. Messages: checklist truncation, note removed, rejected save (with Discard and Copy actions), and the shared save-failed message "Could not save. Your changes are still shown here; try again." (R3-03).
- Depends: F-01
- Traces: FR-11, FR-12, N-03, R3-03; Architecture Section 8
- Check: each message renders with its exact wording; action buttons invoke their callbacks

#### F-10: ConfirmDialog
- `client/src/components/ConfirmDialog.tsx`: traps focus, closes on Escape, and calls its confirm handler only on confirm.
- Depends: F-01
- Traces: FR-05; Architecture Section 8
- Check: unit tests for focus trap, Escape, and confirm-only behavior

#### F-11: NoteCard
- In-place expanded view. Inline title and body editing through `useAutoSave`. Color picker from the palette. Pin and unpin, archive and unarchive, and delete through `ConfirmDialog`. Archived notes are read-only. Plain-text rendering with no `dangerouslySetInnerHTML`. Non-text actions send immediately and revert on failure with the save-failed toast (P-01).
- Depends: F-02, F-06, F-09, F-10
- Traces: FR-02, FR-04, FR-05, FR-06, FR-07, FR-10, NFR-03, NFR-05, P-01; Architecture Section 8
- Check: unit tests: archived notes have edit controls disabled; a failed pin reverts the UI and shows the toast; text is rendered as plain text

#### F-12: ChecklistEditor
- Add, edit, remove, check, and uncheck items. Checked items keep their position and use the muted style. Text over 80 characters is cut on save with the truncation message. At 50 items, a 51st add sends the overflow request with a client UUID and an overflow draft. When `continuedInId` is set, the add control is replaced by the "Continue in new note" link.
- Depends: F-03, F-05, F-06, F-11
- Traces: FR-11, D-02, N-02, P-02; Architecture Section 8
- Check: unit tests for the 50-item limit, truncation message, and link replacement

#### F-13: Overflow chain links
- An overflow note shows a link back to `continuedFromId`. "Continue in new note" opens the `continuedInId` note. A chain member that is archived opens read-only (D-04).
- Depends: F-12
- Traces: FR-11, P-03, D-04
- Check: unit tests confirm each link resolves to the correct note ID

#### F-14: SearchBar and ColorFilter
- Search input and color selection, each with a clear control. Both update the `useNotes` state.
- Depends: F-08
- Traces: FR-08, FR-09, NFR-06, NFR-07
- Check: labeled, keyboard operable controls; state updates the view

#### F-15: EmptyState
- Empty message when a view has no notes. When search or color filter matches nothing, show a message and a control that clears both.
- Depends: F-14
- Traces: FR-22
- Check: unit tests for both messages and for the clear control resetting search and colors

#### F-16: NoteList, creation, and App layout
- `NoteList` with Active and Archived tabs. A create-note control that generates the UUID with `crypto.randomUUID()` (P-06). `App.tsx` wires the components. Server order is shown as received (pinned first, then most recently updated).
- Depends: F-11, F-13, F-15
- Traces: FR-01, FR-03, FR-06, NFR-06; Architecture Section 8
- Check: both tabs render their views; a new note is created with a UUID and white color

#### F-17: Responsive layout and accessibility pass
- Tailwind breakpoints; no fixed widths that force horizontal scrolling. Native buttons and inputs. Every icon-only control has an `aria-label`.
- Depends: F-16
- Traces: NFR-06, NFR-07, NFR-09; Architecture Section 8
- Check: unit tests for accessible names; layout is verified in T-06



### Testing Phase (T-01 to T-06)

#### T-01: Palette contrast and client-server palette match
- Check that each of the 8 colors has a checked-item muted text color with at least 4.5:1 contrast (FR-11). Check that the client palette matches the server palette.
- Depends: F-02, B-02
- Traces: FR-07, FR-11, A-01
- Check: contrast values recorded; palettes match

#### T-02: Supertest integration suite
- Cover create, read, list, update, delete, repeated-POST idempotency, overflow chain, delete relinking, checklist replacement and 50-item limit, error model, security headers, and CORS.
- Depends: B-13
- Traces: FR-01 to FR-07, FR-11, FR-13, FR-22 (server side), NFR-04, NFR-12; Architecture Sections 6, 9
- Check: all tests pass; each N-11 and P-02 rule has a case

#### T-03: Client filter timing check (Vitest)
- Measure client-side search and filter for 500 notes (NFR-02 uses 300 ms as a supporting check).
- Depends: F-08, F-14
- Traces: FR-08, FR-09, NFR-02
- Check: result recorded with the machine description (P-04)

#### T-04: Playwright timing checks (NFR-01, NFR-02)
- Measure list load and search timings in Chromium against the target dataset. Record machine details.
- Depends: F-16, B-13
- Traces: NFR-01, NFR-02, P-04 (NFR-08 is browser compatibility, not timing; see Section 6)
- Check: timings recorded in the verification report input; no unexplained regressions

#### T-05: Playwright end-to-end flows
- Create, edit, autosave, pin, archive, color, delete with confirmation, overflow chain, draft recovery after reload, and offline reconnect.
- Depends: F-16, T-02
- Traces: FR-01 to FR-07, FR-08, FR-09, FR-11, FR-12, FR-22, NFR-03
- Check: all flows pass in Chromium

#### T-06: Accessibility and responsive checks
- Keyboard-only operation, accessible names, focus trap, and layout at narrow and wide viewports without horizontal scrolling.
- Depends: F-17, T-05
- Traces: NFR-06, NFR-07, NFR-09
- Check: checks pass; any browser not installed is recorded as a gap, not a pass


## 5. Critical Dependencies

Wave order (backend and frontend run in parallel once their own prerequisites are met):
- Wave 1 (backend): B-01, B-02, B-03, B-04
- Wave 1 (frontend): F-01, F-02, F-03, F-09, F-10
- Wave 2 (backend): B-05, B-12 -> B-06, B-07 -> B-08, B-09, B-10 -> B-11 -> B-13
- Wave 2 (frontend): F-04 (needs B-11 contract) -> F-05 -> F-06 -> F-07, F-08 -> F-11 -> F-12 -> F-13 -> F-14 -> F-15 -> F-16 -> F-17
- Testing: T-01 after F-02 and B-02; T-02 after B-13; T-03 after F-08 and F-14; T-04 after F-16 and B-13; T-05 after F-16 and T-02; T-06 after F-17 and T-05

Cross-phase dependencies:
- F-04 needs the B-11 route contract before the real API is used. Mocked `fetch` covers F-04 until B-11 is in place.
- F-16 needs B-13 for end-to-end runs; unit work does not.

## 6. Blockers and Risks

Blockers: none. All design-review findings (R3-01 to R3-03, P-02, P-07, and earlier items) are closed in [design-review.md](./design-review.md) Section 7.13, and architecture v0.6 reflects them.

Risks and conditions:
- Independence caveat (accepted by the user as is): the Round 3 re-check was done in the same session that edited architecture v0.6. No separate design-review pass is required.
- Installs: dependency installation is `ask` in the registry. Vite, Vitest, Playwright, and browser downloads each need explicit approval before running.
- Browsers (decided by the user): Chromium only. Firefox and Edge are not verified and are recorded as gaps in the verification report, not passes.
- Timing: NFR-01 and NFR-02 results depend on the test machine. Record hardware and browser details with each result (P-04).
- Traceability (resolved): architecture v0.7 maps NFR-08 to browser compatibility (Chromium for the MVP gate) and NFR-01 and NFR-02 to Playwright timing checks, matching requirements v0.8. Architecture v0.7 still needs human approval before planning completion.
- Git ignore (decided by the user): `server/.gitignore` covers `.env` and the SQLite database file (B-01). `client/.gitignore` covers `node_modules` and `.env` (F-01). The root `.gitignore` is not changed.
- Secure context: `crypto.randomUUID()` needs `localhost` or HTTPS (P-06). The dev setup must use `localhost`.

## 7. Phase Exit Verification

### Backend Exit Gate
- B-01 to B-13 complete, each approved per task (`requiresApprovalPerTask: true`)
- Supertest integration tests pass (T-02 scope for the backend)
- Server binds to `127.0.0.1`; CORS allows only `CLIENT_URL`; security headers present
- No test failures

### Frontend Exit Gate
- F-01 to F-17 complete, each approved per task
- Vitest unit tests pass
- `npm run build` succeeds with no compilation errors

### Testing Exit Gate
- T-01 to T-06 complete; Playwright runs recorded with machine details
- All unit and integration tests pass
- Verification report saved to `docs/verification-report.md` (verify phase, currently locked)
- Code review report saved to `docs/code-review-report.md` (code-review phase, currently locked)

### Registry Gates
- Implementation: `requiresApprovalPerTask: true`; propose one task at a time and wait for approval.
- Code-review and verify: `locked`; the user must unlock each phase after implementation is approved.
- PR: `locked`; `canMergePR: false`. Remote PR creation is blocked while `allowNetworkAccess` and `allowGitPush` restrict it.

## 8. Notes
- Task durations and story points are not estimated in this plan.
- Database path, environment variables, and `.env` are not committed (NFR-04).
- The palette in `client/src/lib/palette.ts` and `server/src/constants/palette.ts` must match (verified by T-01).
- All timestamps are ISO 8601 UTC; the client displays them in the local time zone.
- Requirements traceability is listed below.

### Requirements Traceability (requirements v0.8)

| Requirement | Tasks |
|---|---|
| FR-01 Create note | B-06, B-07, F-16, T-05 |
| FR-02 Read note in place | F-11, T-05 |
| FR-03 Active and archived views | B-06, F-08, F-16 |
| FR-04 Inline edit and autosave | F-06, F-11, T-05 |
| FR-05 Delete with confirmation | B-09, F-10, F-11, T-05 |
| FR-06 Pin and order | B-06, F-08, F-11, F-16, T-05 |
| FR-07 Color from palette | B-04, F-02, F-11, T-01, T-05 |
| FR-08 Search (trimmed) | F-08, F-14, T-03, T-05 |
| FR-09 Color filter | F-08, F-14, T-03, T-05 |
| FR-10 Archive and unarchive | B-06, F-11, F-16, T-05 |
| FR-11 Checklist, contrast, and overflow | B-08, B-10, F-02, F-03, F-12, F-13, T-01, T-02, T-05 |
| FR-12 Persistence and draft recovery | B-02, F-04, F-05, F-06, F-07, T-05 |
| FR-13 updatedAt on change | B-06, T-02 |
| FR-22 Empty and no-match states | F-15, T-05 |
| NFR-01 List load under 1 s | T-02, T-04 |
| NFR-02 Search under 300 ms | T-03, T-04 |
| NFR-03 Plain-text storage and display | B-04, F-11, T-02, T-05 |
| NFR-04 No committed secrets | B-01, T-02 |
| NFR-05 Inline editing | F-11, T-05 |
| NFR-06 Keyboard operation | F-14, F-17, T-06 |
| NFR-07 Accessible names | F-14, F-17, T-06 |
| NFR-08 Browser compatibility (Chrome, Firefox, Edge) | T-05 (Chromium only; Firefox and Edge not verified, see Section 6) |
| NFR-09 Responsive layout | F-17, T-06 |
| NFR-10 Required stack | F-01, B-01 |
| NFR-11 Vitest and Playwright/Supertest | F-01, T-02 to T-05 |
| NFR-12 Error model (400, 404, 500) | B-03, B-11, T-02 |

