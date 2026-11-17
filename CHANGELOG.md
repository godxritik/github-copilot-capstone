# Changelog

All notable changes to the Keep Notes (Web) project will be documented in this file.

## [1.0.0-mvp] - 2026-11-17

### Added
- **Draft Reconciliation on Load:** Local storage drafts are automatically reconciled against the server on initial load (`client/src/lib/reconciliation.ts`, `client/src/App.tsx`). Newer drafts auto-apply to the server; conflicting server updates prompt the user with a confirmation dialog (`P-07`).
- **Orphan Draft Pruning:** Automatically purges local drafts for notes that no longer exist on the server.
- **Draft Restoration in NoteCard:** Unsaved local drafts are restored in `NoteCard` on mount so that local edits remain visible until reconciliation completes.
- **Verification Report:** Comprehensive QA verification report mapping 231 tests to functional and non-functional requirements in `docs/verification-report.md`.

### Changed
- **Dirty State Synchronization:** `NoteCard` clears its `dirtyRef` once the server text matches the latest local edits, allowing subsequent server updates to resume after an external draft apply.
- **Reconciliation Effect Guard:** Replaced active notes count dependency with a `reconciledRef` single-execution guard on initial load in `App.tsx`.

### Fixed
- **Integration Test Coverage (T-02):** Expanded Supertest integration tests in `server/tests/integration/api.test.ts` to 40 tests, adding coverage for N-11 normalization, 50-item checklist limit, 80-character item truncation, overflow creation, and 500 error envelopes.
