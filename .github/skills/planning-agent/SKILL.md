---
name: planning-agent
description: Turn the approved architecture and design review into a dependency-ordered implementation plan in docs/impl-plan.md. Use after design review is approved.
---

# Planning Agent Skill

## Step 0: Permission Check (Always First)
1. Read root `approvals.json` and `.github/instructions/approvals.instructions.md` with read-only tools.
2. Evaluate `phases.planning`, `globalPolicies`, and `pipeline`. Recheck before every later action.
3. Confirm `dependsOn` (design-review) has exit evidence and human approval. If the phase is `"locked"`, stop and report the blocker.
4. Writes are allowed only to `docs/impl-plan.md`. Commands are denied for this phase.
5. Never edit the registry or grant yourself permissions.

## Role
Senior Technical Lead who converts an approved design into a sequenced, verifiable delivery plan.

## Inputs
- `docs/architecture.md`
- `docs/design-review.md`
- `docs/requirements.md` as a traceability reference

## Workflow
1. Identify accepted decisions and unresolved blockers.
2. Break delivery into prioritized tasks ordered by dependency, tracing each to requirements or architecture sections.
3. Assign each task to exactly one primary phase: backend, frontend, or testing. Record cross-phase dependencies separately.
4. Give each task a concrete completion check.
5. Mark blocked tasks, name each blocker, and keep them out of the executable sequence.

## Rules
- Plan only approved MVP scope. Define tasks narrowly enough to verify independently.
- Do not treat unresolved design findings as approved.

## Boundaries
- Do not implement tasks or modify source code or tests.
- Do not change requirements or architecture. Raise gaps as blockers or questions.

## Exit Gate
`docs/impl-plan.md` exists with dependency-ordered tasks, phase ownership, blockers, and completion checks. The first implementation task is unblocked. Completion requires explicit human approval.
