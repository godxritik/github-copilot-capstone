# Design Review: Google Keep Notes (Web)

## 1. Document Info
- **Reviewed documents:** `docs/architecture.md` (v0.1 review; round 2 re-check of the saved v0.2, see Section 7) and `docs/requirements.md` v0.8
- **Date:** 2026-11-13
- **Reviewer role:** Design Review Agent
- **Status:** Draft, pending human approval
- **Independence note:** the architecture draft and this review were produced in the same working session. The findings below are based only on the two documents; the human reviewer should weigh this when approving.

## 2. Summary
The architecture covers every MVP requirement (FR-01 to FR-13, FR-22, NFR-01 to NFR-12) and stays inside MVP scope. No Critical finding was identified. There are 8 Major findings, which describe behavior that is undefined or would fail on a valid user flow, and 9 Minor findings. The Major findings should be resolved by the Architect before planning starts.

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 8 |
| Minor | 9 |

## 3. Findings

### Major

**M-01. Overflow title can exceed the 200-character title limit and cause a 500.**
- Evidence: architecture Section 6 (Overflow rule) sets the title to `Continued from [original title]`; Section 7 has `CHECK (length(title) <= 200)`; requirements Section 6 limits title to 200 characters.
- Impact: an original note with a title longer than 185 characters produces an overflow title over 200 characters. The database CHECK fails and the user gets HTTP 500 on a valid action.
- Recommendation: define the rule for long titles, for example truncating the original title so the full overflow title is at most 200 characters. Define the title for an empty original title (for example `Continued from Untitled`). Record the rule in Section 6.

**M-02. The overflow endpoint has no request or response contract.**
- Evidence: architecture Section 6 lists `POST /api/notes/:id/overflow` as "Create an overflow note containing one item" with no request body, response body, or validation.
- Impact: the client and server cannot be implemented consistently. It is unclear whether the 51st item's text and checked state come in the request body, and how that item is validated (80-character limit, string type).
- Recommendation: specify the request body (`{ "text": string, "isChecked": boolean }`), the validation, and the 201 response (the new note, with the original's updated link fields available through a follow-up read or in the response).

**M-03. Overflow behavior on a note that already has an overflow note is undefined.**
- Evidence: Section 6 rules say the new note links from the previous one (D-03), and A-08 says links point to the newest overflow note "only", while earlier notes are reachable through `continuedFromId`. A forward link (`continuedInId`) from the original to the first overflow note is not defined to be the newest one.
- Impact: if a client calls overflow on an original that already has `continuedInId` set, the original's link is overwritten or a second overflow note is created from the same parent, breaking the chain. A-08 contradicts the stated chain model.
- Recommendation: state that overflow is allowed only on the last note in the chain (`continuedInId` is null); otherwise return 400 `VALIDATION_ERROR`. Rewrite A-08 to describe a forward chain: each note's `continuedInId` points to the next note, and each note's `continuedFromId` points to the previous note.

**M-04. Failed creation of a new note has no draft path.**
- Evidence: Section 9 says the server generates note IDs and clients never supply them; Section 8 keys drafts by note ID; FR-12 requires a failed save to be kept as a local draft and retried.
- Impact: if the first `POST /api/notes` fails, the note has no ID, so there is no draft key. The user's text is lost, contradicting FR-12.
- Recommendation: either use a client-generated temporary key for unsaved notes, or allow the client to supply a UUID on creation (validated by the server). Document the chosen approach in Sections 6 and 8.

**M-05. Client behavior for 400 responses during auto-save is undefined.**
- Evidence: Section 5 handles success, 500 or network failure, and 404 only. Section 6 returns 400 `NOTE_ARCHIVED` or `VALIDATION_ERROR` for PATCH.
- Impact: a draft for a note that was archived in another tab returns 400 `NOTE_ARCHIVED` on every retry; the draft is never cleared and retries repeat indefinitely. A validation rejection behaves the same way.
- Recommendation: define the behavior for 400 (stop retrying, keep the draft visible with a message, or discard). Add the 400 branch to the sequence diagram in Section 5.

**M-06. Out-of-order auto-save responses are not handled.**
- Evidence: Section 8 triggers saves on blur and after a 2-second pause; Section 6 uses last write wins (A-07) and full replacement of the checklist.
- Impact: a blur-triggered save and a pause-triggered save can be in flight together, and an older response can replace newer local state or clear a newer draft. The checklist full-replacement PATCH can overwrite a concurrent item change.
- Recommendation: state that the client serializes saves per note (one request in flight, latest state sent next) and clears a draft only if it matches the saved content.

**M-07. Production hosting of the client is unspecified, and the API has no access control.**
- Evidence: D-01 and O-04 (Q5, A) put the built client on separate static hosting; Section 9 lists CORS for `CLIENT_URL` only. Requirements Section 7 excludes authentication.
- Impact: any host that can reach the API can read, change, and delete every note. CORS does not prevent this, because it restricts browsers only. The architecture does not say where the client is hosted, how HTTPS is used, or what the API network exposure is.
- Recommendation: state that the MVP is for a trusted local or private network. Bind the server to the loopback interface by default (configurable), document the exposure risk, and state that adding authentication is a Future item (FR-17). Name the intended hosting for the static client, or mark it as an explicit unresolved decision.

**M-08. Ordering and index do not match, and ordering is not deterministic.**
- Evidence: Section 6 orders pinned first then `updatedAt` descending; Section 7 has `idx_notes_view (is_archived, is_pinned, updated_at DESC)`.
- Impact: the index sorts `is_pinned` ascending, so the query `ORDER BY is_pinned DESC, updated_at DESC` cannot use it for ordering. This has little effect at 500 notes, but the index does not match the stated design. Notes with the same `updatedAt` have no tie-breaker, so list order can change between requests.
- Recommendation: define the index as `(is_archived, is_pinned DESC, updated_at DESC, id)` and state the ORDER BY with an `id` tie-breaker.

### Minor

**m-01. Overflow changes the original note's `continued_in_id`, but the `updatedAt` effect is undefined.**
- Evidence: FR-13 refreshes `updatedAt` on any stored field change; Section 6 changes the original's `continuedInId`.
- Impact: the original note would move to the top of its group, or not, depending on an unstated rule.
- Recommendation: state whether link changes refresh `updatedAt`.

**m-02. Error handling for unspecified cases.**
- Evidence: Section 6 error table covers VALIDATION_ERROR, NOTE_ARCHIVED, NOT_FOUND, and INTERNAL_ERROR only.
- Impact: malformed JSON, an oversized body (body-parser returns 413), an invalid `:id` format, an unknown route, and an invalid `archived` query value have no defined response. NFR-12 allows only 400, 404, and 500.
- Recommendation: map malformed JSON, oversized body, invalid ID format, and invalid query values to 400 `VALIDATION_ERROR`, and unknown routes to 404 `NOT_FOUND`.

**m-03. Length checks use different units.**
- Evidence: Section 7 uses SQLite `length()` (characters); validation counts JavaScript string length (UTF-16 code units).
- Impact: text with emoji can pass one check and fail the other. A pass in validation and a failure in the database CHECK would return 500.
- Recommendation: choose one counting rule, validate with it on the server before the database, and keep the CHECK as a backstop.

**m-04. `PATCH` with `isArchived: true` combined with other fields is undefined.**
- Evidence: Section 6 defines unarchive combinations but not archive combinations (for example `isArchived: true` with `isPinned: true`).
- Impact: the result of such a request is ambiguous.
- Recommendation: state that archiving always results in `isPinned: false`, whatever the request contains.

**m-05. Security headers are unspecified.**
- Evidence: Section 9 says "a small middleware, without adding a dependency unless approved".
- Impact: the headers are not listed, so they cannot be verified or tested.
- Recommendation: list the headers (for example `X-Content-Type-Options` and a restrictive `Content-Security-Policy` on API responses), or defer them explicitly.

**m-06. List query efficiency is not stated.**
- Evidence: Section 7 stores checklist items in a separate table; Section 11 targets 500 notes in under 1 second.
- Impact: loading each note's items with a separate query (an N+1 pattern) can reduce list performance.
- Recommendation: state that the list endpoint loads items in one query for all returned notes.

**m-07. Accessibility details for dialogs and messages are missing.**
- Evidence: Section 8 covers native controls and `aria-label` only.
- Impact: `ConfirmDialog` needs focus handling and keyboard dismissal, and `Toast` needs a live-region role, or the messages in FR-11 and FR-12 may not be announced.
- Recommendation: add focus trap and Escape handling for `ConfirmDialog` and `aria-live` for `Toast`.

**m-08. Read-only view of an expanded note is not shown.**
- Evidence: FR-02 requires an in-place expanded view; no component in Section 10 covers it explicitly (`NoteCard` and `NoteEditor` only).
- Impact: low; the intent is likely covered by `NoteCard`.
- Recommendation: state which component provides the expanded view and how archived notes appear read-only.

**m-09. `better-sqlite3` is a native module.**
- Evidence: Section 3 and A-03.
- Impact: this is a risk, not a defect. Installation can require a build toolchain if no prebuilt binary matches the Node version on the target machine.
- Recommendation: pin a Node version in the plan and check that `better-sqlite3` installs on it before implementation.

## 4. Areas Reviewed With No Finding
- **Requirement coverage:** every MVP requirement appears in the traceability table (Section 15) with an architecture location.
- **MVP scope:** Future items FR-14 to FR-21 are excluded, and nothing in the design depends on them.
- **XSS prevention:** plain-text rendering, no `dangerouslySetInnerHTML`, and prepared statements are specified (NFR-03).
- **Secrets:** environment variable names only; no values appear (NFR-04).
- **Browser support and responsive layout:** reviewed (NFR-08, NFR-09); no finding identified.
- **Persistence:** SQLite with foreign keys and CHECK constraints; reviewed for FR-12, apart from M-04 and M-05.
- **Mermaid diagrams:** syntax and consistency with the text were reviewed; no finding identified.

## 5. Decisions
### Confirmed by the user
- D-01: separate origins in development and production (Q1 A, Q5 A).
- D-02: overflow links stored in `continuedFromId` and `continuedInId` (Q2 B).
- D-03: an overflow note can overflow again (Q3 A).
- D-04: HTTP 400 for edits to archived notes (Q4 A).

### Made by the architect, not confirmed by the user
- O-01 palette, O-02 `better-sqlite3`, O-03 overflow title snapshot, O-05 last write wins, O-06 newest overflow link. These remain pending the user's confirmation. M-03 affects O-06.

### Pending decisions arising from this review
- M-01 to M-08: no recommendation has been agreed. Each requires the Architect or the user to decide.
- M-04: choose between a client-side temporary key and a client-supplied UUID.
- M-07: choose the hosting and exposure policy for the MVP.

---

## 6. Re-Review of Architecture v0.2 (2026-11-13)

### 6.1 Process Note
- Between the first review and this re-review, `docs/architecture.md` was edited to v0.2 by this same agent (acting under a mistaken role), following the user's instruction to apply the recommendations. The Design Review Agent boundary says it must not edit `docs/architecture.md`, so this was a boundary breach, even though the registry allowed the write.
- Independence is therefore reduced: this re-review checks changes made by the reviewer. The user should either accept this knowingly or have the Architect re-confirm v0.2 and a fresh reviewer check it.
- The recommendations applied were the ones proposed in this report. The user delegated their resolution ("apply the above findings"), which is the only agreement recorded for them.

### 6.2 Status of Earlier Findings
| ID | Status | Evidence in v0.2 |
|---|---|---|
| M-01 | Resolved | Section 6 "Overflow title" truncates to 200 characters and handles an empty title. |
| M-02 | Resolved | Section 6 endpoint table defines the overflow request body. See N-02 for the response gap. |
| M-03 | Resolved | Section 6 "Overflow chain" and A-08 define a forward chain. See N-02 for the UI gap. |
| M-04 | Resolved with a new issue | Client-generated UUIDs in Sections 6, 8, 9. See N-01. |
| M-05 | Resolved with a new issue | 400 branch in Section 5 and Section 8. See N-03. |
| M-06 | Resolved | Section 8 serializes saves per note and clears a draft only on a matching 2xx response. |
| M-07 | Partially resolved | Loopback default and trusted-network statement added (Section 9). Hosting is deferred (A-11). See N-05. |
| M-08 | Resolved | Section 7 index and ORDER BY match and include an `id` tie-breaker. |
| m-01 | Resolved with a new issue | Section 6 states that link changes do not refresh `updatedAt`. See N-06. |
| m-02 | Resolved | Section 6 error table maps malformed JSON, oversized body, invalid ID, invalid query, and unknown routes. |
| m-03 | Resolved | Code-point counting is defined in Sections 6 and 7. |
| m-04 | Resolved | Section 6 "Archiving" rule. |
| m-05 | Resolved | Section 9 lists the two headers. |
| m-06 | Resolved | Section 6 endpoint table states one query for checklist items. |
| m-07 | Resolved | Section 8 covers `ConfirmDialog` focus and Escape, and `Toast` `aria-live`. |
| m-08 | Resolved | Section 8 "Expanded view". |
| m-09 | Resolved | A-12 pins Node LTS and checks `better-sqlite3`. |

### 6.3 New Findings

#### Major
**N-01. A retried `POST` after a lost response is rejected as a duplicate.**
- Evidence: Section 8 retries a failed `POST` with the same client-generated ID; Section 9 and the Section 6 validation table reject a duplicate ID with 400; Section 5 and Section 8 say a 400 stops retrying and keeps the draft.
- Impact: if the server stored the note but the response was lost, the retry returns 400. The client then treats the save as rejected and keeps the draft permanently, although the note exists. The user sees a failure for a note that was saved, and a stale draft remains.
- Recommendation: make creation idempotent. A `POST` with an existing ID and identical content returns the stored note with 200 or 201. A different body for the same ID returns 400. Document the rule in Section 6 and add it to the Section 5 flow.

#### Minor
**N-02. The overflow flow leaves two client-side gaps.**
- Evidence: Section 6 returns "201 new note" only; Section 6 allows overflow only when `continuedInId` is null.
- Impact: the client cannot learn the original note's new `continuedInId` from the response and must refetch it. Also, if the user adds another item to an original that already has an overflow note, the API returns 400 and the UI behavior is undefined.
- Recommendation: state that the client refetches the original (or that the response includes both notes), and state that adding items to a note with an overflow note goes to the last note in the chain, or that the control is disabled.

**N-03. A permanently rejected draft has no exit.**
- Evidence: Section 8 keeps the draft after a 400 and applies a stored draft over the server copy on load.
- Impact: a draft rejected with `NOTE_ARCHIVED` is replayed on every load and rejected every time. The user cannot clear it.
- Recommendation: on a repeated 400, show the draft with discard and copy actions, and exclude it from automatic replay until the user acts.

**N-04. `POST /api/notes` body fields are not enumerated.**
- Evidence: Section 6 says "Create a note; the client supplies a UUID `id`" and rejects unknown fields, but does not list the allowed fields.
- Impact: it is unclear whether the client may set `isArchived`, `isPinned`, timestamps, or link fields at creation.
- Recommendation: list the accepted fields (`id`, `title`, `body`, `color`, `checklistItems`) and reject timestamps, link fields, and state fields with 400.

**N-05. The loopback default conflicts with separate-origin production hosting.**
- Evidence: Section 9 binds to `127.0.0.1` by default; D-01 and A-11 host the client on separate static hosting.
- Impact: a client hosted elsewhere cannot reach a loopback-only API. Setting `HOST` to a public interface leaves an unauthenticated API reachable, as M-07 described.
- Recommendation: the user should decide the MVP deployment target (local use only, or a private network). The plan should record the decision and the required network controls before implementation.

**N-06. The `updatedAt` exception for links conflicts with FR-13, and the requirements data model lacks the link fields.**
- Evidence: FR-13 refreshes `updatedAt` when any stored field changes; Section 6 excludes `continuedInId` changes. Requirements Section 6 lists no `continuedFromId` or `continuedInId`.
- Impact: the architecture adds stored fields and an exception that the approved requirements do not contain.
- Recommendation: raise a requirements change request for the Business Analyst (add both fields to the data model and state the FR-13 exception), and obtain the user's confirmation.

**N-07. `Access-Control-Allow-Headers` is not specified.**
- Evidence: Section 9 lists allowed methods only.
- Impact: JSON requests send `Content-Type: application/json`, which triggers a preflight. Without that header allowed, PATCH and POST fail in the browser.
- Recommendation: add `Content-Type` to the allowed headers and state the preflight behavior.

### 6.4 Areas Re-Checked With No New Finding
- Requirement coverage and traceability table: no new gap beyond N-06.
- XSS, secrets, browser support, responsive layout, Mermaid syntax (the added 400 branch is valid).
- Performance verification (Section 11) and MVP scope (Section 12).

### 6.5 Updated Decisions
- **Confirmed by the user:** D-01 to D-04, and the delegated application of the M-01 to M-08 and m-01 to m-09 recommendations.
- **Still architect-made, not user-confirmed:** O-01, O-02, O-03, O-05, O-06.
- **Pending:** N-01 to N-07. N-05 and N-06 need user decisions.

### 6.6 User Decisions on N-05 and N-06 (2026-11-13)
- **Q6 (N-05), answer A:** the MVP is for local use only. The client and API both run on the user's machine, and the API binds to `127.0.0.1`. Section 9 of the architecture should state this and drop the private-network wording; the production-hosting wording in D-01 and A-11 (separate static hosting) should be reconciled with local-only use.
- **Q7 (N-06), answer B:** no requirements change request. `continuedFromId`, `continuedInId`, and the FR-13 exception are recorded as an accepted architecture-level addition. The architecture should say so explicitly, since `docs/requirements.md` Section 6 does not list these fields.
- **Still open for the Architect:** N-01 to N-04 and N-07, using the resolutions listed in this report. After the Architect updates `docs/architecture.md`, the Design Review Agent re-reviews.

---

## 7. Round 2 Re-Check of Architecture v0.2 (2026-11-13)

### 7.1 Scope and Basis
- Checked the architecture file as currently saved (header: v0.2, "pending re-review") against the Section 6 findings, the user decisions in Section 6.6, and `docs/requirements.md` v0.8.
- The Section 6 items below that are marked open are not yet reflected in the saved architecture. They are reported as open, not resolved.
- This review does not modify `docs/architecture.md`.

### 7.2 Status of Section 6 Findings in the Saved Architecture (v0.2, superseded)
Historical snapshot of architecture v0.2. Current status is in Sections 7.8 to 7.10 (v0.4), so do not use this table as current.
| ID | Status | Evidence in the saved architecture |
|---|---|---|
| N-01 | Open (Major) | The POST row and validation table still reject a duplicate `id` with 400. No idempotent-retry rule exists. |
| N-02 | Open (Minor) | Overflow success is still "201 new note" only. Section 8 does not say how the client refreshes the original's `continuedInId`, or what the UI does when an item is added to a note that already has `continuedInId`. |
| N-03 | Open (Minor) | Section 8 still applies a stored draft over the server copy on load and saves it again. No exit exists for a draft that keeps receiving 400. |
| N-04 | Open (Minor) | The POST row still does not list the accepted fields. It only says unknown fields are rejected. |
| N-05 | Open (Minor), decided by user Q6 | Section 9 still says "trusted local or private network", and D-01 and A-11 still describe separate static hosting. The Q6 answer (local use only, bound to `127.0.0.1`) is not reflected. |
| N-06 | Partly resolved | The link fields and the FR-13 exception appear in Sections 6 and 7. The architecture does not say they are an accepted addition beyond requirements Section 6, as the Q7 answer requires. |
| N-07 | Open (Minor) | Section 9 lists allowed methods only. `Access-Control-Allow-Headers` (`Content-Type`) is not specified. |

### 7.3 New Findings

#### Major
**N-08. Deleting a note inside an overflow chain leaves link state undefined.**
- Evidence: Section 7 sets `ON DELETE SET NULL` on both `continued_from_id` and `continued_in_id`. The DELETE row in Section 6 and its rules say nothing about linked notes. FR-05 allows permanent deletion of any note, and FR-11 requires links in both directions.
- Impact: in a chain A → M → B, deleting M clears A's `continuedInId`. A then looks like the last note, so overflow on A is allowed again and creates a second child. This breaks the forward chain in D-03 and A-08. B also loses its `continuedFromId`. Deleting the head note leaves its overflow note with no back link.
- Recommendation: define the DELETE rule for linked notes in Section 6. Option 1: in one transaction, relink the neighbours when a middle note is deleted (A.`continuedInId` = B and B.`continuedFromId` = A), and clear only the link on the neighbour when the head is deleted. Option 2: block deletion of a linked note with a 400 code such as `NOTE_LINKED`. NFR-12 allows only 400, 404, and 500, so the new code must be a 400. Either option should state the resulting UI. The requirements do not cover this case, so the user should choose the option.

#### Minor
**N-09. The contrast requirement for checked items is not covered.**
- Evidence: FR-11 and requirements Section 9 (Checklist) require muted checked rows at a contrast ratio of at least 4.5:1. Architecture Section 8 covers the line-through only, and Section 11 has no contrast check.
- Impact: the requirement can be missed during implementation, and it is not testable as written.
- Recommendation: state the muted style and its contrast target in Section 8. Add a verification step to Section 11, such as an automated accessibility check in the client tests or a recorded manual check.

**N-10. The list endpoint documents only the active view.**
- Evidence: the endpoint table lists only `GET /api/notes?archived=false`. FR-03 requires a separate archived view. The validation table mentions an invalid `archived` value but does not list the accepted values.
- Impact: the request for the archived view is not defined in the API contract.
- Recommendation: document `archived=true` and `archived=false` as the accepted values, and state that any other value returns 400 `VALIDATION_ERROR`.

### 7.4 Areas Re-Checked With No New Finding
- FR-06 pinned ordering, FR-08 and FR-09 client-side filtering, FR-10 archive rules, FR-13 `updatedAt` rules, and FR-22 empty states, apart from N-10 for FR-03.
- Overflow title rule (M-01), forward chain rule (M-03), and archive combination rule (m-04), which match the confirmed answers in requirements Section 10.
- Secrets: only environment variable names are documented (NFR-04).
- XSS: plain-text rendering and prepared statements (NFR-03).
- Performance design (NFR-01, NFR-02) and the error-code mapping (NFR-12).

### 7.5 Decision Status
- **Confirmed by the user:** D-01 to D-04. Q6 (N-05): local use only, bound to `127.0.0.1`. Q7 (N-06): the link fields and the FR-13 exception are an accepted architecture-level addition. These are user answers recorded in this review. The architecture has not yet been updated to reflect Q6 and Q7.
- **Architect-made, not user-confirmed:** O-01, O-02, O-03, O-05, O-06.
- **Confirmed by the user (2026-11-13 request to apply the Section 7.6 proposals):** N-01, N-02, N-03, N-04, N-05, N-06, N-07, N-09, and N-10, as written in Section 7.6.
- **Confirmed by the user (2026-11-13):** N-08 Option 1, relink neighbours on delete.
- **Not yet applied:** all confirmed resolutions, including N-08, are still pending in `docs/architecture.md`.

### 7.6 Resolutions for the Architect
Confirmed by the user on 2026-11-13 and recorded here, including the N-08 choice of Option 1. They are not yet applied to `docs/architecture.md`, which this review does not edit.

- **N-01 (idempotent create):** `POST /api/notes` with an existing `id` and content identical to the stored note returns 200 with the stored note. The same `id` with different content returns 400 `VALIDATION_ERROR`. Section 5 treats 200 and 201 as success.
- **N-02 (overflow response and UI):** overflow returns 201 `{ "note": <new note>, "original": <updated original> }`, and the client updates both. When the original has `continuedInId` set, the checklist add control is replaced by the "Continue in new note" link, so no request reaches the 400 path.
- **N-03 (rejected draft exit):** after a 400, the draft is stored with a `rejected` flag and is not replayed automatically on load. The Toast offers Discard and Copy actions. Discard removes the draft. Copy places the draft text on the clipboard.
- **N-04 (POST fields):** accepted fields are `id`, `title`, `body`, `color`, and `checklistItems`. Any other field, including `isPinned`, `isArchived`, timestamps, `continuedFromId`, and `continuedInId`, returns 400 `VALIDATION_ERROR`.
- **N-05 (local use, per Q6 answer A):** remove the "trusted local or private network" wording from Section 9 and state that the client and API run on the user's machine and the API binds to `127.0.0.1`. Replace the separate-static-hosting wording in D-01 and A-11 with localhost origins. Set the example `CLIENT_URL` to the local client origin. The separate-origin decision (D-01) remains.
- **N-06 (accepted addition, per Q7 answer B):** add a note that `continuedFromId`, `continuedInId`, and the FR-13 link-change exception are an accepted architecture-level addition. Requirements Section 6 does not list them, and no requirements change request is raised.
- **N-07 (CORS headers):** allowed methods are GET, POST, PATCH, DELETE, and OPTIONS. Allowed headers are `Content-Type`. Preflight is answered with 204 by a small middleware, with no new dependency.
- **N-08 (delete linked notes): needs your decision.**
  - **Option 1, relink on delete (recommended):** in one transaction, deleting a middle note sets its previous note's `continuedInId` to its next note and the next note's `continuedFromId` to its previous note. Deleting the head clears the next note's `continuedFromId`. Deleting the tail clears the previous note's `continuedInId`. FR-05 is kept as written, and the chain stays forward-linked.
  - **Option 2, block deletion:** deleting a linked note returns 400 `NOTE_LINKED`. This conflicts with FR-05, because a note in a chain could not be deleted without first deleting the chain, so I do not recommend it.
- **N-09 (checked-item contrast):** define a muted text color per palette color in `palette.ts`, with a contrast ratio of at least 4.5:1 against that color's background. Add a unit test that checks every palette color.
- **N-10 (archived view):** `GET /api/notes` requires `archived` with the value `true` or `false`. A missing or other value returns 400 `VALIDATION_ERROR`.

### 7.7 Verification Check (2026-11-13, 13:13 IST)
- Checked the saved `docs/architecture.md` against the confirmed resolutions. None of the changes is present yet:
  - Still "Version 0.2 (design review findings applied; pending re-review)".
  - N-01: the POST row and validation table still reject a duplicate `id` with 400, with no identical-content 200 rule.
  - N-02: overflow still returns "201 new note" only.
  - N-03: no rejected-draft flag or Discard/Copy actions.
  - N-04: the POST accepted-fields list is absent.
  - N-05: Section 9 still says "trusted local or private network", and A-11 still describes static hosting.
  - N-06: no statement that the link fields are an accepted addition.
  - N-07: no `Access-Control-Allow-Headers` or OPTIONS handling.
  - N-08: no relink-on-delete rule; `ON DELETE SET NULL` is unchanged.
  - N-09: no muted-color contrast rule or palette test.
  - N-10: `GET /api/notes` still documents only `archived=false`.
- **Result:** all findings N-01 to N-10 remain open. They can be closed only after the Architect applies the changes and this agent re-checks them.

### 7.8 Re-Check of Architecture v0.3 (2026-11-13)
Checked `docs/architecture.md` v0.3, which the Architecture Agent updated from the confirmed Section 7.6 resolutions.

| ID | Status | Evidence in v0.3 |
|---|---|---|
| N-01 | Resolved | Section 6 POST row and `id` validation row: identical content returns 200, different content returns 400. Sections 5 and 8 treat 200 as success. |
| N-02 | Resolved | Section 6 overflow row and rules: `{ note, original }` with 201. Section 8 replaces the add control with the link. |
| N-03 | Resolved | Section 5 and Section 8: rejected flag, no automatic replay, Toast with Discard and Copy. |
| N-04 | Resolved | Section 6 POST row and unknown-fields row list the accepted fields. |
| N-05 | Resolved | Section 9 binds to `127.0.0.1` for local use only. The "private network" wording is gone. D-01 and A-11 use localhost origins. |
| N-06 | Resolved | D-05 records the link fields and the FR-13 exception as an accepted addition. |
| N-07 | Resolved | Section 9: methods include OPTIONS, allowed header is `Content-Type`, preflight returns 204. |
| N-08 | Resolved | Section 6 DELETE row and relink rules (Option 1). Section 7 notes that `ON DELETE SET NULL` is a backstop. FR-05 is unchanged. |
| N-09 | Resolved | Section 8 muted-color rule and Section 11 unit test covering every palette color. |
| N-10 | Resolved | Section 6 GET row and `archived` validation row: required, `true` or `false` only. |

#### New findings
**N-11. The identical-content rule for a repeated `POST` is not fully defined (Minor).**
- Evidence: Section 6 and the `id` validation row compare `title`, `body`, `color`, and `checklistItems`. They do not say whether checklist item order is significant, or how an omitted `color` is compared with the stored value.
- Impact: an identical retry could be misclassified as a conflict, which keeps a draft in the rejected state.
- Recommendation: state that the comparison is on normalized values, with checklist order significant and an omitted `color` treated as `white`. The Architect applies this.

**N-12. A-13 is an architect assumption, not a confirmed decision (Minor, user confirmation needed).**
- Evidence: A-13 defines how rejected drafts behave after reload and how a new edit replaces them. The confirmed resolutions do not cover this, and Section 13 marks it as not user-confirmed.
- Impact: low. The behavior is consistent with N-03 and the no-auto-replay rule.
- Recommendation: the user confirms or changes A-13.

#### Status
- **Closed as resolved:** N-01 to N-10, and N-12. N-12 is closed because the user confirmed A-13 on 2026-11-13 ("confirm").
- **Decided by the user:** N-11 is accepted as recommended on 2026-11-13 ("this is fine"). The rule is checklist order significant, and an omitted `color` treated as `white`, when comparing a repeated `POST` with the stored note. The architecture v0.3 does not state this rule yet, so it still needs to be applied to `docs/architecture.md` by the Architecture Agent.
- Completion approval for the design-review phase is still the user's decision in `approvals.json`, and it is not recorded here.

### 7.9 Re-Check of Architecture v0.4 (2026-11-13, N-11 Applied)
Checked `docs/architecture.md` v0.4, which now includes the N-11 clarification in Section 6 Rules.

| ID | Status | Evidence in v0.4 |
|---|---|---|
| N-11 | Resolved | Section 6 Rules, first bullet: "Repeated POST comparison (N-11): compare `title`, `body`, `color`, and `checklistItems` with the stored note after treating an omitted request `color` as `white`. Checklist order is significant: the arrays must have the same length, with matching `text` and `isChecked` values at each position." |

#### New findings
None identified. All N-01 to N-11 are now closed or resolved in v0.4.

#### Status
- **Closed as resolved:** N-01 to N-11, and N-12.
- Completion approval for the design-review phase is still the user's decision in `approvals.json`, and it is not recorded here.

### 7.10 Design Review Complete
Architecture v0.4 passes re-check. All findings N-01 to N-12 are resolved. The design review is complete and ready for human approval to complete the phase.

## 7.11 Round 3 Review of Architecture v0.4 (2026-11-16)
Scope: `docs/architecture.md` v0.4 against `docs/requirements.md` v0.8. Findings already recorded in Sections 7.1 to 7.10 are not repeated. Findings are new unless marked as a residual.

### Summary
No Critical finding. One Major finding (P-02) describes a recoverable-data failure on a valid user flow and should be resolved by the Architect before planning starts. Eight Minor findings (P-01 and P-03 to P-09) are recorded for the Architect to address or accept.

### Findings

**P-01. Trigger and failure feedback for non-text actions are not specified (Minor).**
- Evidence: Section 8 (autosave, line 206) covers failed saves generically, with a per-note draft and retries. Section 6 PATCH accepts `isPinned`, `isArchived`, `color`, and `checklistItems`. Neither section says whether checkbox toggles, pin, color, or archive send immediately or on blur, or whether the UI rolls back a failed toggle. FR-11 requires checks to persist after reload.
- Impact: a failed checkbox toggle or pin change may look saved and then disappear on reload. The draft mechanism stores text, so it is unclear whether a failed non-text change is kept at all.
- Recommendation: in Section 8, state for each non-text action whether it is sent immediately, whether the UI rolls back on failure, and whether a Toast is shown. State whether drafts apply only to text.

**P-02. Overflow creation is not idempotent and has no failure path (Major).**
- Evidence: `POST /api/notes/:id/overflow` (Section 6) has the server generate the new note ID. N-01 made only `POST /api/notes` idempotent. Under the overflow rules, once `continuedInId` is set, a repeated overflow request returns 400 `VALIDATION_ERROR`. Section 8 defines no retry for overflow.
- Impact: if the response is lost after the server created the overflow note, the client shows an error and the user sees a failure for a note that exists. A second attempt is then rejected by the chain rule, so the user cannot recover from the UI.
- Recommendation: have the client supply the new note's UUID (as N-01 does for create), return the stored pair with 200 or 201 for an identical retry, and return 400 only for different content. Alternatively, the client can refetch the list after an overflow failure. Document the rule in Section 6 and the flow in Section 8.
- Proposed resolution (for the Architect to apply to `docs/architecture.md`; this agent does not edit it; not agreed):
  - Section 6, `POST /api/notes/:id/overflow`: the request body adds `id` (client UUID, required, same format rule as `POST /api/notes`). The server stores the new note with that ID.
  - Rule (P-02): if `original.continuedInId` equals the supplied `id`, and the stored overflow note matches the request (`text` and `isChecked` at position 0, with the N-11 normalization), return 200 with the stored `{ "note", "original" }`. If `original.continuedInId` is set to a different ID, return 400 `VALIDATION_ERROR`. If `id` already exists on another note, return 400 `VALIDATION_ERROR`.
  - Section 8: the client keeps the overflow request as a pending draft keyed by the original note ID and the new UUID, retries it on the same triggers as text drafts, and clears it on 200 or 201. The retry uses the latest state of the original note, as in the autosave rules.
  - Section 6 validation table: add `id` as a required field for the overflow endpoint, and add the 200 identical-retry response to the status column.
- Status: proposed only. The user must agree before the Architect applies it. Expected effect: P-02 is closed once the Architect applies this text and the Design Review Agent re-checks it.

**P-03. Archive and overflow chains can split across views (Minor).**
- Evidence: Section 6 covers overflow and delete relinking but not archiving a note that belongs to a chain. Archiving the original, or a middle note, leaves its neighbours active. Section 9 has no rule for this case.
- Impact: a chain can be partly active and partly archived. Navigation through "Continue in new note" then crosses views, which is not defined.
- Recommendation: state that archive is per note and that chain links are kept across views, or define a rule that keeps the chain in one view. Record the choice as a decision for the user.

**P-04. The performance conditions cited in Section 11 are not in the requirements (Minor).**
- Evidence: Section 11 says targets are measured "under the conditions in the requirements (standard laptop, 20 Mbps, 50 ms latency)". `docs/requirements.md` v0.8 defines no such conditions.
- Impact: the cited basis for the NFR-01 measurement does not exist, so the test condition cannot be traced.
- Recommendation: either add the test conditions to the requirements through the BA and user, or remove the claim and state the actual test environment in Section 11.

**P-05. Performance tests do not cover the stated targets end to end (Minor).**
- Evidence: Section 11 measures NFR-02 with a unit test of the client filter function. NFR-02 covers the time from input change to updated results. NFR-01 names a "client load check" without a tool or measurement.
- Impact: a filter function test can pass while the rendered list stays slow. NFR-01 cannot be verified as written.
- Recommendation: measure NFR-02 from input event to rendered results, for example in a Playwright check with 500 seeded notes. Name the tool and measurement for NFR-01.

**P-06. The client depends on a secure context for `crypto.randomUUID()` (Minor).**
- Evidence: Section 8 generates note IDs with `crypto.randomUUID()`. Browsers expose this API only in secure contexts. `http://localhost` qualifies, but a client served from another origin does not.
- Impact: with the local-only design (N-05), this works. If the client origin changes, note creation fails at runtime.
- Recommendation: state the requirement that the client runs on `localhost` or HTTPS, or add a fallback UUID generator. Include the check in the browser support test for NFR-08.

**P-07. Stale and orphaned drafts can override or hide data (Minor).**
- Evidence: A-07 applies a stored, non-rejected draft over the server copy on load. A rejected draft has no visible path to Discard or Copy after its note is deleted, because the note is not opened again.
- Impact: an old draft can overwrite newer server content without warning. Rejected drafts for deleted notes stay in `localStorage` indefinitely.
- Recommendation: show a confirmation or a comparison when a stored draft is older than the server copy. Remove a draft when its note is deleted or returns 404.

**P-08. Checklist replacement conflicts with the position constraint if applied naively (Minor).**
- Evidence: `checklist_items` has `UNIQUE (note_id, position)` (Section 7). Section 6 says PATCH replaces the whole checklist list (`checklistItems`, "full replacement list"). Section 7 does not say how the replacement is written.
- Impact (inferred, not confirmed in the design): if positions are updated one row at a time, the unique constraint can be violated mid-update, which would produce a 500 on a valid request.
- Recommendation: state that a checklist replacement deletes and re-inserts the note's items in one transaction, or use a deferred uniqueness check.

**P-09. Residual: the `HOST` override still allows network exposure (Minor, residual of M-07 and N-05).**
- Evidence: Section 9 says the optional `HOST` setting overrides the `127.0.0.1` default. The API has no authentication.
- Impact: setting `HOST` to a non-loopback address exposes all notes to the network, with no check in the design.
- Recommendation: remove `HOST` from the MVP, or state in Section 9 that a non-loopback value is unsupported and must not be used.

### Proposed resolutions for Minor findings (P-01, P-03 to P-09)
These are proposals for the Architect, or for the user where a decision is needed. None is agreed, and this agent does not edit `docs/architecture.md`.

- **P-01 (non-text actions):** add a Section 8 table with one row per action (checklist add, edit, remove, check, pin, color, archive). Columns: send timing (immediate or on blur), failure behavior (UI rolls back to the last saved state), and feedback (Toast with the existing message). State that drafts apply only to text fields. Decision for the user: confirm that non-text actions are not drafted.
- **P-03 (archive and chains):** add a Section 6 rule: archive is per note, and `continuedFromId` and `continuedInId` stay unchanged on archive and unarchive. The chain may span active and archived views, and the "Continue in new note" link opens an archived note read-only (D-04). Decision for the user: confirm this rule, or require the whole chain to move together.
- **P-04 (test conditions):** either the BA adds the test conditions (standard laptop, 20 Mbps, 50 ms latency) to `docs/requirements.md` and the user approves the change, or Section 11 states the actual test environment and drops the reference to the requirements. Decision for the user.
- **P-05 (performance tests):** NFR-02: measure in a browser test from input event to rendered result, with 500 seeded notes, against 300 ms. NFR-01: state that the measured interval is the API response time plus client render, and name the tool (for example, Playwright). Keep the unit test as a supporting check only.
- **P-06 (secure context):** add to Section 8 that the client runs on `http://localhost` or HTTPS. Add a check to the NFR-08 browser test that note creation works on the supported origin. No fallback generator is needed while the client is local-only.
- **P-07 (stale and orphaned drafts):** when a stored non-rejected draft is older than the server copy (`updatedAt`), show a confirmation before it is applied. Remove drafts for a note when its 404 is received or the note is deleted. Decision for the user: confirm that these two rules replace last-write-wins on load, or keep A-07 and accept the risk.
- **P-08 (checklist replacement):** state in Section 7 that a checklist PATCH deletes and re-inserts the note's items in one transaction, so the `UNIQUE (note_id, position)` constraint is not hit mid-update.
- **P-09 (`HOST`):** remove `HOST` from the MVP environment variables (Section 9 and the variables list in Section 10), so the API always binds to `127.0.0.1`. Decision for the user: confirm removal, or document that a non-loopback value is unsupported.

Once the Architect applies the agreed items, the Design Review Agent re-checks them and closes P-01 and P-03 to P-09.

### Areas reviewed with no new finding
- Requirement coverage: FR-01 to FR-13, FR-22, and NFR-01 to NFR-12 are mapped in Section 15. Out-of-scope items (FR-14 to FR-21) are not reintroduced.
- XSS and input safety: plain-text rendering, prepared statements, and the CSP header address NFR-03.
- API error behavior: the 400, 404, and 500 format matches NFR-12, apart from P-02.
- Accessibility: focus trap, `aria-live` toasts, and accessible names address NFR-06 and NFR-07.
- MVP scope: no new Future feature appears in the design.

### Decisions status
- Agreed by the user on 2026-11-16 ("accept all defaults"). These are the decisions the Architect must apply to `docs/architecture.md`:
  - **P-02 (Major):** overflow `POST` takes a client UUID `id`. An identical retry returns 200 with the stored `{ note, original }`. A conflicting retry or a duplicate `id` returns 400 `VALIDATION_ERROR`. The client keeps the overflow request as a draft, retries it with the latest original state, and clears it on 200 or 201.
  - **P-01:** a per-action table in Section 8 gives send timing, rollback on failure, and Toast feedback for checklist, pin, color, and archive actions. Drafts apply only to text fields.
  - **P-03:** archive is per note. `continuedFromId` and `continuedInId` are unchanged on archive and unarchive. A chain may span active and archived views.
  - **P-04:** Section 11 drops the "20 Mbps, 50 ms" reference. The test environment is stated in Section 11 instead.
  - **P-05:** NFR-02 is verified by a browser test from input event to rendered results with 500 notes. NFR-01 names the measurement tool, and the unit test is a supporting check only.
  - **P-06:** Section 8 states that the client runs on `http://localhost` or HTTPS. The NFR-08 browser test checks note creation on that origin.
  - **P-07:** a stored draft older than the server copy requires confirmation before it is applied. Drafts are cleared on 404 or note deletion. This replaces last-write-wins on load for drafts only; A-07 still applies to concurrent edits.
  - **P-08:** a checklist PATCH replaces the note's items in one transaction (Section 7).
  - **P-09:** `HOST` is removed from the MVP. The API always binds to `127.0.0.1`.
- Pending: the Architect applies these decisions to `docs/architecture.md`. Then the Design Review Agent re-checks them and closes P-01 to P-09. Planning remains blocked until P-02 is closed.
- Completion approval for the design-review phase is still the user's decision in `approvals.json`, and it is not recorded here.
- Completion approval for the design-review phase is still the user's decision in `approvals.json`, and it is not recorded here.

## 7.12 Round 3 Re-Check of Architecture v0.5 (2026-11-16)
Scope: `docs/architecture.md` v0.5 checked against the accepted P-01 to P-09 decisions (Section 7.11, "accept all defaults"). Read-only check of the architecture; this agent did not edit it.

### Status of P-01 to P-09
| ID | Status | Evidence in v0.5 |
|---|---|---|
| P-01 | Resolved, with minor gap R3-03 | Section 8 per-action table (send timing, rollback, feedback); drafts limited to text |
| P-02 | Open (Major), see R3-01 | Section 6 overflow `id` and P-02 rules exist, but rule order blocks the identical retry |
| P-03 | Resolved | Section 6 "Archive is per note"; links unchanged on archive and unarchive |
| P-04 | Resolved | Section 11 "Test environment" replaces the 20 Mbps and 50 ms reference |
| P-05 | Resolved | Section 11 Playwright tests for NFR-01 and NFR-02, with unit tests as supporting checks |
| P-06 | Resolved | Section 8 secure-context statement and NFR-08 check |
| P-07 | Partly resolved, see R3-02 | Section 8 `draftedAt` comparison and 404 and delete removal. Rejected drafts have no removal trigger when their note is deleted elsewhere |
| P-08 | Resolved | Section 7 checklist PATCH delete and re-insert in one transaction |
| P-09 | Resolved | `HOST` removed from Sections 9 and 10; the API binds to `127.0.0.1` |

### New findings
**R3-01. Overflow rule order rejects the identical retry before it can return 200 (Major).**
- Evidence: Section 6, "Overflow idempotency (P-02)". Step 1 returns 400 if `id` "already exists on another note". Step 2 returns 200 for an identical retry, where `original.continuedInId` equals `id`. An identical retry reuses the overflow note's `id`, which already exists, so step 1 fires first. Step 2 can never be reached for the case it describes.
- Impact: the case P-02 exists to fix (a lost 201 response) still fails. The client receives 400 and treats the overflow as rejected, and the user cannot recover from the UI. The original user-visible failure remains.
- Recommendation: check step 2 before step 1, or state that step 1 applies only when `id` is not the stored `continuedInId`. Make the wording unambiguous about "another note".
- Disposition: user decision 2026-11-16, option A: move the identical-retry check (step 2) ahead of the duplicate-ID check, so step 1 applies only when `id` belongs to a note other than the stored overflow note. The Architect applies the change to architecture.md, and this agent re-checks it.

**R3-02. Rejected drafts for a note deleted elsewhere have no removal trigger (Minor, residual of P-07).**
- Evidence: Section 8, "Draft conflicts (P-07)". A draft is removed on a 404 or when "the note is deleted". A rejected draft is never sent, so no 404 occurs. If the note was deleted in another tab, the rejected draft has no trigger to clear it.
- Impact: the stale-draft problem from P-07 remains for rejected drafts. They stay in `localStorage` until the user acts, and the user may never open that note.
- Recommendation: on load, check each rejected draft with `GET /api/notes/:id` and remove it on 404. Alternatively, accept the residual risk and say so. This is a user decision.
- Disposition: user decision 2026-11-16, option A: on load, each rejected draft is checked with `GET /api/notes/:id` and removed on 404. The Architect applies this to architecture.md, and this agent re-checks it.

**R3-03. Failure feedback text is not defined (Minor).**
- Evidence: Section 8 table, "Toast with the save-failed message". No such message is defined in the Subtle messages list.
- Impact: the wording cannot be tested or implemented consistently.
- Recommendation: define the message text once, for example in the Subtle messages list.
- Disposition: user decision 2026-11-16, option A: define one shared save-failed message in the Subtle messages list (Section 8) and reference it from the feedback column. Wording: "Could not save. Your changes are still shown here; try again." The Architect applies this to architecture.md, and this agent re-checks it.

### Areas re-checked with no new finding
- Requirement coverage (Section 15) after the P-01 to P-09 updates.
- Server validation, error format, and the `id` rules apart from R3-01.
- Secrets and environment variable names after removing `HOST`.
- XSS, accessibility, browser support, and MVP scope: unchanged from earlier rounds.

### Gate status
- Exit gate: `docs/design-review.md` exists with categorized findings and dispositions. Met.
- Blocking: R3-01 is Major and P-02 is open. Planning remains blocked.
- Not recorded here: the design-review completion decision in `approvals.json`. It belongs to the user.

## 7.13 Round 3 Re-Check of Architecture v0.6 (2026-11-16)
Scope: `docs/architecture.md` v0.6 checked against the Section 7.12 dispositions (R3-01 to R3-03) and the Section 7.11 decisions (P-01 to P-09). This re-check did not edit the architecture.

| ID | Status | Evidence in v0.6 |
|---|---|---|
| R3-01 | Closed (Resolved) | Section 6 "Overflow idempotency (P-02)": step 1 is the identical-retry check (200 when `original.continuedInId` equals `id` and content matches; 400 when content differs). Step 2 applies the duplicate-ID 400 only to a note other than the stored overflow note. |
| R3-02 | Closed (Resolved) | Section 8 "Draft conflicts (P-07)": on load, each rejected draft is checked with `GET /api/notes/:id` and removed on 404. |
| R3-03 | Closed (Resolved) | Section 8 "Subtle messages" defines the shared save-failed text, and the feedback column of the non-text action table references it. |
| P-02 | Closed (Resolved) | Follows from R3-01. The identical retry now reaches its 200 response, so the lost-201 case is recoverable. |
| P-07 | Closed (Resolved) | Follows from R3-02. Rejected drafts now have a removal trigger when the note no longer exists. |
| P-01 to P-09 | Closed (Resolved) | Re-checked in Section 7.12; no change in v0.6. |
| M-01 to M-08, N-01 to N-12 | Closed (Resolved) | Previously closed in Sections 6.2, 7.2 to 7.10. No regression found in v0.6 for the overflow title, overflow contract, schema index and `ORDER BY` (Section 7), or the `id` and `archived` validation rules. |

#### Open items
- None blocking. No Major or Minor finding remains open in `docs/architecture.md` v0.6.
- Independence: this re-check was performed in the same working session that applied the architecture changes. The human reviewer should weigh this when approving the design-review phase.
- Not decided here: the design-review completion in `approvals.json` (`approvedBy` is `"user"`, and the completion approval belongs to the user). Planning proceeds only after the user's explicit approval.
