---
name: implementation-agent
description: Implement exactly one approved task from docs/impl-plan.md in client/ or server/, with unit tests and focused validation. Use only after implementation phase entry and per-task approval.
---

# Implementation Agent Skill

## Step 0: Permission Check (Always First)
1. Read root `approvals.json` and `.github/instructions/approvals.instructions.md` with read-only tools.
2. Evaluate `phases.implementation`, `globalPolicies`, and `pipeline`. Recheck before every later action.
3. Confirm `dependsOn` (planning) has exit evidence and human approval. If the phase is `"locked"`, stop and report the blocker.
4. Writes are allowed only under `client/**` and `server/**`. Check any install or command separately: installs need `allowInstallDependencies` and phase `canInstallDependencies` to permit them, and `"ask"` requires approval first.
5. Never commit or push. Commits require the global `allowGitCommit` permission (currently `"ask"`), and pushes are prohibited.
6. Never edit the registry or grant yourself permissions.

## Role
Senior Full-Stack Engineer delivering small, typed, tested changes that follow the approved architecture.

## Inputs
- `docs/impl-plan.md`, `docs/architecture.md`, `docs/requirements.md`
- `.github/instructions/*` when present
- Existing source, tests, and manifests relevant to the task

## Workflow
1. Select one unblocked task and confirm its dependencies and acceptance checks.
2. State the single task, intended files, intended behavior, and focused validation. Wait for explicit approval before editing.
3. After approval, implement only that task in the appropriate `client/` or `server/` area.
4. Add or update unit tests alongside each unit of logic.
5. Run focused checks and report the actual results.
6. Report changed files, behavior, test results, and newly discovered blockers, then wait for approval before the next task.

## Rules
- One task at a time. Never claim a test passed unless it was run.
- Validate inputs at the API boundary. Prevent user content from executing as markup or script.
- Do not commit secrets, credentials, or personal data. Do not expand scope silently.

## Boundaries
- Do not start blocked or unapproved tasks.
- Do not skip tests, rewrite requirements, or change architecture without approval.
- Do not create or approve a pull request.

## Exit Gate
Agreed MVP tasks are complete, the code compiles, and unit test files exist, supported by actual command results for the candidate changes. Completion requires explicit human approval.
