# Code Review Report: Keep Notes (Web)

Scope: `server/src/**`, `client/src/**`, and existing tests, reviewed against `docs/requirements.md`. Read-only review. No code was changed, and no tests were run.

## Findings (ordered by severity)

### High

1. **"Apply Draft" does not apply the draft** (correctness)
   - Location: [App.tsx](c:/Users/RitikGaur/Desktop/Github%20copilot%20Capstone/client/src/App.tsx) lines 178-182.
   - The `onConfirm` handler closes the dialog and shows "Local draft applied." It never saves the draft to the server, and the draft stays in localStorage.
   - Impact: the user is told the draft was applied, but the server copy is unchanged. Data can be lost on the next reconciliation or discard.
   - Recommendation: save the draft content through the update path, discard the draft on success, and show the toast only after the save succeeds.
   - **Status: FIXED** in the implementation step (`applyDraftToServer` in `client/src/lib/reconciliation.ts`, wired into the `App.tsx` dialog handler). Covered by `client/tests/unit/reconciliation.test.ts`. Findings 2-8 remain open.

2. **`APPLY_AND_SAVE` is not handled, and draft recovery is incomplete** (correctness)
   - Location: [App.tsx](c:/Users/RitikGaur/Desktop/Github%20copilot%20Capstone/client/src/App.tsx) lines 55-63 (`getDraft` is called only here). [NoteCard.tsx](c:/Users/RitikGaur/Desktop/Github%20copilot%20Capstone/client/src/components/NoteCard.tsx) never calls `getDraft`.
   - `reconcileDraftOnLoad` can return `APPLY_AND_SAVE`, but the loop only branches on `CONFIRM_WITH_USER` and `DISCARD_REMOVED_404`. Drafts that should be saved automatically are never saved.
   - Impact: after a reload, unsaved edits are not restored into the note editor, which affects the draft-recovery requirement.
   - Recommendation: handle `APPLY_AND_SAVE` explicitly, and initialize `NoteCard` from the draft when one exists.

### Medium

3. **Only one conflict dialog is tracked** (correctness/UX)
   - Location: [App.tsx](c:/Users/RitikGaur/Desktop/Github%20copilot%20Capstone/client/src/App.tsx) line 36 (`reconcileDialog` is a single object). The loop at lines 52-68 overwrites it for each conflicting note.
   - Impact: when several notes have conflicting drafts, only the last one is shown, and the user cannot resolve the others.
   - Recommendation: queue conflicts in array state and present them one at a time.

4. **Drafts for vanished notes can persist** (correctness)
   - Location: [App.tsx](c:/Users/RitikGaur/Desktop/Github%20copilot%20Capstone/client/src/App.tsx) lines 52-68. Only the `DISCARD_REMOVED_404` path discards drafts, and reconciliation runs only for `activeNotes`.
   - Impact: drafts for notes that were deleted or moved to trash can stay in localStorage indefinitely.
   - Recommendation: prune drafts whose note IDs are absent from both the active and trash lists.

### Low

5. **Stale local state in `NoteCard`** (correctness, low-medium)
   - Location: [NoteCard.tsx](c:/Users/RitikGaur/Desktop/Github%20copilot%20Capstone/client/src/components/NoteCard.tsx) lines 26-27 initialize `title` and `body` from props once.
   - Impact: if the server version changes while the card is mounted, the card keeps showing old text until it remounts.
   - Recommendation: sync from `note` when the server `updatedAt` changes and there are no pending edits.

6. **Unused repository methods** (DRY/dead code)
   - Location: [notesRepository.ts](c:/Users/RitikGaur/Desktop/Github%20copilot%20Capstone/server/src/db/notesRepository.ts) lines 212 (`appendChecklistItem`) and 222 (`countChecklistItems`). Production code does not call them; only tests do.
   - Recommendation: remove them, or document them as intentional API surface and keep them covered.

7. **Test script paths in `server/package.json`** (test coverage/tooling)
   - The `test:unit` and `test:integration` scripts use paths relative to the repo root, not `server/`, so they may match no files. Not executed in this review.
   - Recommendation: fix the globs to be relative to `server/`, then confirm by running the scripts in the verify phase.

8. **Dependency version mismatches** (dependency safety)
   - `server/package.json` pins `vitest ^0.34.0` (client uses 1.x), `tsx ^3.12.7`, and `better-sqlite3 ^13.1.1`. The last version was not verified against the registry, and no advisory scan was run.
   - Evidence is limited to manifest contents. No vulnerability is confirmed.
   - Recommendation: run `npm audit` and confirm the `better-sqlite3` version in the verify phase.

## Checklist Areas

| Area | Result |
|---|---|
| Correctness | Findings 1-5. Draft apply and recovery are incomplete. |
| Security | Response headers (`nosniff`, CSP), CORS preflight, and the 100 KB body limit are covered by [api.test.ts](c:/Users/RitikGaur/Desktop/Github%20copilot%20Capstone/server/tests/integration/api.test.ts). No confirmed defect. Advisory status unknown (finding 8). |
| Error Handling | `errorHandler` covers malformed JSON and `entity.too.large` ([errorHandler.test.ts](c:/Users/RitikGaur/Desktop/Github%20copilot%20Capstone/server/tests/unit/errorHandler.test.ts)). The client conflict path ignores `APPLY_AND_SAVE` (finding 2). |
| Test Coverage | T-03 filter timing is covered in [useNotes.test.ts](c:/Users/RitikGaur/Desktop/Github%20copilot%20Capstone/client/tests/unit/useNotes.test.ts). No test covers the Apply Draft or draft-recovery UI. T-02 is partial. T-04 to T-06 (Playwright) are not written. |
| Code Clarity | No confirmed issues. Source files are valid UTF-8. |
| DRY | Dead repository methods (finding 6). Reconciliation branching lives in `App.tsx`, while the decision logic is in `reconciliation.ts`. |
| Dependency Safety | Manifest mismatches only (finding 8). No confirmed vulnerability. |

## Questions and Residual Risks

### Decisions Recorded

- **Apply Draft behavior (decided: A, save immediately).** "Apply Draft" should send the draft through the update path, discard the local draft only after the save succeeds, and show the toast only after success. This resolves finding 1.
- **Testing task placement (decided: A, implementation exit gate).** T-02 and T-04 to T-06 must be finished before the implementation gate can be completed. They are not deferred to the verify phase.

### Open Items

- Vulnerability status is unknown without an audit run (finding 8).

## Recommendation

Under the decisions above, findings 1 and 2 must be fixed, and T-02 and T-04 to T-06 must be completed, before the implementation gate can be completed. Findings 3 and 4 can be tracked as follow-up work. This review made no code changes. Any fixes or new tests need a separate, approved implementation step. Completion of this phase and the next phase require explicit human approval.
