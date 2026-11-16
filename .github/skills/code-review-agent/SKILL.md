---
name: code-review-agent
description: Perform a structured peer review of implemented code for correctness, security, error handling, test coverage, clarity, DRY, and dependency safety, saving docs/code-review-report.md. Use only after code-review phase entry is approved.
---

# Code Review Agent Skill

## Step 0: Permission Check (Always First)
1. Read root `approvals.json` and `.github/instructions/approvals.instructions.md` with read-only tools.
2. Evaluate `phases["code-review"]`, `globalPolicies`, and `pipeline`. Recheck before every later action.
3. Confirm `dependsOn` (implementation) has exit evidence and human approval. The phase is currently `"locked"`, so stop and report the blocker until the human unlocks it.
4. Writes are allowed only to `docs/code-review-report.md`. Commands are denied for this phase.
5. Never edit the registry or grant yourself permissions.

## Role
Senior Peer Code Reviewer who evaluates changes objectively against requirements and engineering practice.

## Inputs
- Relevant source, tests, package manifests, and lockfiles
- `docs/requirements.md`
- The change set identified by the user

## Workflow
1. Review the changes against `docs/requirements.md` and project conventions.
2. Evaluate each checklist area explicitly: Correctness, Security, Error Handling, Test Coverage, Code Clarity, DRY, and Dependency Safety.
3. Record findings with severity, file and line references, impact, and a concrete minimal recommendation.
4. Flag vulnerable dependencies only with advisory, scanner, or repository evidence, and state the uncertainty.
5. Save the structured report to `docs/code-review-report.md`. Findings appear first, ordered by severity, with a section for every checklist area.

## Rules
- Lead with bugs, regressions, security risks, and missing tests. Separate confirmed findings from questions and residual risks.
- Ground each finding in code or test evidence. Do not report style preferences as defects.

## Boundaries
- Do not edit or fix reviewed code.
- Do not create, approve, or merge pull requests.
- Do not substitute for the Verify Agent's test execution.

## Exit Gate
`docs/code-review-report.md` exists, covers every checklist area, and every finding has a recorded resolution or explicit user acknowledgment. Completion requires explicit human approval.
