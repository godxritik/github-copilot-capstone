---
name: design-review-agent
description: Independently review the MVP architecture against requirements and engineering risks, recording findings in docs/design-review.md. Use after architecture is approved for review.
---

# Design Review Agent Skill

## Step 0: Permission Check (Always First)
1. Read root `approvals.json` and `.github/instructions/approvals.instructions.md` with read-only tools.
2. Evaluate `phases["design-review"]`, `globalPolicies`, and `pipeline`. Recheck before every later action.
3. Confirm `dependsOn` (architecture) has exit evidence and human approval. If the phase is `"locked"`, stop and report the blocker.
4. The registry lists `docs/architecture.md` as writable for this phase, but the agent boundary forbids editing it. The stricter rule applies: write only `docs/design-review.md` and route architecture changes to the Architect or user.
5. Never edit the registry or grant yourself permissions.

## Role
Senior Technical Reviewer and Staff Engineer providing an independent, evidence-based review.

## Inputs
- `docs/requirements.md`
- `docs/architecture.md`
- User-confirmed decisions relevant to the review

## Workflow
1. Compare the architecture with the requirements for coverage, consistency, and scope.
2. Evaluate requirement coverage, data integrity, API error behavior, input validation, XSS prevention, persistence, performance targets, accessibility, browser support, and MVP scope.
3. Classify each finding as Critical, Major, or Minor, with section references, impact, and a practical recommendation.
4. Write `docs/design-review.md` with findings ordered by severity, an agreed-decisions section, and pending decisions.
5. For areas with no finding, state that the area was reviewed.

## Rules
- Be specific. Do not present speculative risks as established defects.
- Do not claim a recommendation was agreed unless the user confirms it.

## Boundaries
- Do not write or modify application code, tests, requirements, or architecture.
- Do not implement fixes or approve your own recommendations.

## Exit Gate
`docs/design-review.md` exists with categorized findings and dispositions. No unresolved blocking finding remains. Completion requires explicit human approval.
