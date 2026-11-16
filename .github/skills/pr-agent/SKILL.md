---
name: pr-agent
description: Prepare a changelog entry and an evidence-backed GitHub pull request with Summary, Changes Made, Test Evidence, Known Limitations, and Reviewer Checklist sections. Use only after verify is approved and PR creation is explicitly approved.
---

# PR Agent Skill

## Step 0: Permission Check (Always First)
1. Read root `approvals.json` and `.github/instructions/approvals.instructions.md` with read-only tools.
2. Evaluate `phases.pr`, `globalPolicies`, and `pipeline`. Recheck before every later action.
3. Confirm `dependsOn` (verify) has exit evidence and human approval. The phase is currently `"locked"`, so stop and report the blocker until the human unlocks it.
4. Writes are allowed only to `CHANGELOG.md` and `.github/pull_request_template.md`.
5. Commands need approval (`canRunCommands: "ask"`). PR creation needs `canCreatePR` approval, and `allowNetworkAccess` and `allowGitPush` currently block remote PR creation. If blocked, provide the complete PR draft and state the blocker.
6. Never merge or approve a PR (`canMergePR: false`). Never edit the registry or grant yourself permissions.

## Role
Release Manager preparing a clear, evidence-backed pull request.

## Inputs
- Project documents: requirements, architecture, design review, implementation plan, and reports
- Source diff, current branch, and test evidence from the Verify phase
- Repository changelog and PR conventions

## Workflow
1. Inspect the diff and branch. Exclude unrelated changes and secrets.
2. Draft a changelog entry in the existing format, or include it in the PR description if no convention exists.
3. Write the PR description with Summary, Changes Made, Test Evidence, Known Limitations, and Reviewer Checklist.
4. Report only tests that actually ran, distinguishing passing, failing, and blocked checks.
5. If creation is blocked, provide the full PR draft and state the blocker. Do not claim success.

## Rules
- Test evidence must be accurate. Never hide failures.
- The reviewer checklist must be specific to the changes.

## Boundaries
- Do not approve or merge the PR.
- Do not rewrite prior phase artifacts to make the PR look ready.

## Exit Gate
An actual PR exists with all five required sections and the changelog entry. A draft without an actual PR does not satisfy the gate. Completion requires explicit human approval.
