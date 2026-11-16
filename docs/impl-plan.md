# Implementation Plan: Google Keep Notes (Web)

## 1. Document Info
- **Project:** Google Keep Notes (Web)
- **Version:** 1.0 (derived from architecture v0.4, design-review v7.10, requirements v0.8)
- **Date:** 2026-11-13
- **Status:** Draft. Tasks are ordered by dependency and assigned to backend, frontend, or testing phases.
- **MVP Scope:** All features marked MVP in requirements Section 4.

## 2. Phase Assignment Strategy
- **Backend:** Database schema, API routes, input validation, service rules (archive, overflow, autosave), error handling
- **Frontend:** React components, hooks, state management, autosave, draft storage, search/filter, UI/UX
- **Testing:** Unit tests (Vitest on both sides), API integration tests (Supertest), performance verification, contrast verification

## 3. Entry Criteria and Exit Gates

### Backend Phase
- **Entry:** Architecture v0.4 approved, design-review complete
- **Exit:** All API routes operational, integration tests pass, server running on localhost

### Frontend Phase
- **Entry:** Backend API is functional and documented
- **Exit:** All components built, Vitest tests pass, app builds successfully

### Testing Phase
- **Entry:** Backend and Frontend both complete
- **Exit:** All tests pass, verification report produced

## 4. Task Breakdown by Phase

### Backend Phase (B-01 to B-11)

#### B-01: Database layer setup
- Create schema (notes, checklist_items tables), database.ts, initialize on startup
- Depends: Architecture Section 7
- Check: Schema created, foreign_keys pragma ON

#### B-02: Notes repository
- CRUD operations with prepared statements
- Depends: B-01
- Check: All repository methods work, no SQL injection

#### B-03: Notes service with business rules
- Archive/unarchive, overflow, delete relinking (N-08 Option 1), updatedAt logic
- Depends: B-02
- Check: All rules enforced, unit tests cover edge cases

#### B-04: Input validation
- Validators for title, body, color, checklistItems, id (UUID), archived query, body size
- Depends: Architecture Section 6
- Check: All validation rules implemented

#### B-05: Error handling
- AppError.ts, errorHandler.ts, JSON format per Section 6
- Depends: Architecture Section 6
- Check: Error codes working, no sensitive details leaked

#### B-06: API routes
- GET /api/notes, GET /api/notes/:id, POST /api/notes, PATCH /api/notes/:id, DELETE /api/notes/:id, POST /api/notes/:id/overflow
- Depends: B-03, B-04, B-05
- Check: All endpoints respond correctly, Supertest integration tests pass

#### B-07: Express middleware
- JSON parsing (100 KB), CORS (CLIENT_URL origin, allowed methods), security headers, error handler
- Depends: B-06
- Check: CORS allows only CLIENT_URL, preflight returns 204

#### B-08: Server startup and config
- server.ts (listen call), config.ts (PORT, DB_PATH, CLIENT_URL, NODE_ENV), .env template
- Depends: B-07
- Check: Server starts, reads .env, binds to 127.0.0.1

#### B-09: Idempotency (N-01, N-11)
- POST /api/notes: on duplicate id, compare title, body, color (omitted=white), checklistItems (order significant)
- Depends: B-06
- Check: Identical retries return 200, different content returns 400

#### B-10: Integration tests (Supertest)
- All endpoints, error cases, edge cases (overflow, delete relinking, archive rules), 500-note performance baseline (NFR-01)
- Depends: B-08
- Check: All tests pass, <1 second for 500 notes

#### B-11: Backend unit tests (Vitest)
- Repository, service rules, validation, error codes
- Depends: B-02, B-03, B-04, B-05
- Check: All tests pass

### Frontend Phase (F-01 to F-14)

#### F-01: React + Vite + TypeScript + Tailwind setup
- Initialize project, configure vite.config.ts
- Depends: Architecture Section 3
- Check: App builds, dev server runs

#### F-02: Palette and design tokens
- Define 8 colors with muted variants (4.5:1 contrast for checked items)
- Depends: Architecture Section 8
- Check: Palette defined, contrast verified

#### F-03: API client
- Fetch functions for all endpoints, error handling, response types
- Depends: B-08 (backend running)
- Check: API calls work against backend

#### F-04: Draft storage with useDrafts hook
- localStorage per note id, rejected flag, Discard/Copy actions
- Depends: F-03
- Check: Drafts persist, rejected drafts don't auto-replay

#### F-05: Autosave hook (useAutoSave)
- Trigger on blur or 2-second pause, retry, handle rejected responses
- Depends: F-03, F-04
- Check: Autosave works, retries work, rejected stops retry

#### F-06: Notes state (useNotes hook)
- Fetch notes, split active/archived, client-side search/filter
- Depends: F-03
- Check: Notes fetched, split correctly, filter works

#### F-07: NoteCard component
- Display note, inline edit title/body, color, pin/archive/delete buttons, expanded checklist view
- Depends: F-01, F-02
- Check: All controls work, overflow link shown, archived notes read-only

#### F-08: ChecklistEditor component
- Add/edit/remove/check items, 80-char truncation, overflow at 50 items
- Depends: F-07
- Check: All operations work, truncation shown, overflow creates new note

#### F-09: SearchBar and ColorFilter components
- Search query and color selection, sessionStorage persistence
- Depends: F-06
- Check: Search filters, color filter applies, both persist in sessionStorage

#### F-10: Toast and ConfirmDialog components
- Toast (aria-live=polite), ConfirmDialog (focus trap, Escape closes)
- Depends: F-01
- Check: Messages shown, confirmations work

#### F-11: EmptyState component
- Show when no notes, clear filter button when search/filter matches nothing
- Depends: F-06
- Check: Shows appropriately, clear button works

#### F-12: NoteList and App layout
- NoteList with active/archived tabs, App.tsx wiring components, view routing
- Depends: F-06, F-07, F-09, F-11
- Check: Layout correct, tabs work, all components render

#### F-13: Time formatting utility
- Format createdAt/updatedAt in user local time zone
- Depends: F-07
- Check: Timestamps display in local time

#### F-14: Frontend unit tests (Vitest)
- Test hooks, components, API client, search performance (300 ms for 500 notes, NFR-02)
- Depends: F-12
- Check: All tests pass, search <300 ms

### Testing Phase (T-01 to T-06)

#### T-01: Palette contrast verification
- Unit test for all 8 colors: muted-text contrast >= 4.5:1 (WCAG)
- Depends: F-02
- Check: Test passes for all colors

#### T-02: Backend performance test
- Seed 500 notes, measure GET /api/notes time <1 second (NFR-01)
- Depends: B-10
- Check: Test seeds and measures, <1 second

#### T-03: Frontend search performance test
- Measure client search over 500 notes <300 ms (NFR-02)
- Depends: F-14
- Check: Test measures, <300 ms

#### T-04: End-to-end tests (optional)
- Playwright E2E: create, edit, search, archive, delete, checklist overflow
- Depends: F-12, B-08
- Check: E2E tests pass

#### T-05: Code review
- Design review report in docs/code-review-report.md
- Depends: F-12, B-08
- Check: Code review report exists

#### T-06: Verification report
- Comprehensive verification: all FRs, NFRs, acceptance criteria met
- Depends: T-01, T-02, T-03, T-05
- Check: Verification report in docs/verification-report.md, all tests pass

## 5. Critical Dependencies

Backend tasks must complete before frontend can use API:
- B-08 (server running) ? F-03 (API client) ? F-12 (app complete)

Frontend must complete before testing:
- F-12 (app complete) ? F-14 (unit tests) ? T-06 (verification)

Both backend and frontend must complete before code review and verification:
- B-11 (backend tests) + F-14 (frontend tests) ? T-05 (code review) + T-06 (verification)

## 6. Blockers and Risks
**None identified.** All decisions are confirmed. No external dependencies or API contracts block entry.

## 7. Phase Exit Verification

### Backend Exit Gate
- All B-01 to B-11 tasks complete
- Supertest integration tests pass
- Server runs on localhost with SQLite
- No test failures

### Frontend Exit Gate
- All F-01 to F-14 tasks complete
- Vitest unit tests pass
- App builds successfully with `npm run build`
- No compilation errors

### Testing Exit Gate
- All T-01 to T-06 tasks complete
- All unit and integration tests pass
- Verification report produced
- No critical issues from code review

## 8. Notes
- Task durations and story points are not estimated in this plan.
- Code must pass linting (if configured) before implementation completes.
- Database path, environment variables, and .env are NOT committed to repository (NFR-04).
- Palette in `client/src/lib/palette.ts` and `server/src/constants/palette.ts` must match (verified by test).
- All timestamps are ISO 8601 UTC; client displays in local time zone.
- No assumptions are left unconfirmed; design-review v7.10 closed N-01 to N-12.
