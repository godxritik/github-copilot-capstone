---
description: 'Apply the SDLC permission registry and require explicit human approvals for protected actions and phase transitions.'
applyTo: '**'
---

# Permissions and Approval Gates

## Read the Registry First
- Before any write, command, dependency installation, or phase handoff, read the current root `approvals.json` and identify the acting specialist by its phase's `agent` value. Recheck after a user changes permissions.
- If the registry is missing, invalid, ambiguous, or lacks the relevant permission, stop the affected action and ask the user to resolve it. Do not infer access from tool availability.
- These instructions apply to all agents, including the orchestrator. The orchestrator coordinates and reads evidence; it does not inherit specialist permissions or acquire registry-editing rights.
- Apply global policies, phase permissions, agent boundaries, and explicit approvals together. The most restrictive applicable rule wins. A broad allowlist does not override a narrower agent boundary; for example, the Design Review Agent must still recommend architecture changes rather than edit them itself.

## Permission Semantics
- `false` or `"locked"`: the action is prohibited. Never perform it, including indirectly through a script, another agent, or a different tool.
- `"ask"`: STOP before execution, describe the exact action, targets, side effects, and relevant command, and request explicit human approval. Wait for the answer. Approval covers only the described action, not later commands or phases.
- `true` or `"approved"`: the action is permitted only within all remaining global, phase, role, and human-approval restrictions.
- A conversational approval does not override an explicit denial. Ask the human to update the registry if a prohibited capability is needed; do not unlock phases or grant yourself permissions.

## File Writes
- Before writing any file, compare its normalized repository-relative path against the phase's `canWriteFiles` list. Write only to an exact allowlisted path or a matching glob. `**` matches descendant paths.
- Reject paths outside the repository, parent-directory traversal, and symlink or junction destinations that escape the allowed area. Use forward slashes for matching and resolve the actual destination.
- Treat creation, modification, renaming, generated files, test output, lockfiles, and command side effects as writes. Every affected path must be allowed. File-deletion permission must also be satisfied for any operation that deletes files.
- Do not write to unlisted root files or other phases' artifacts, even as part of a dependency installation or formatter run. Pause and explain an allowlist conflict before proceeding.
- Registry, schema, instruction, and agent-definition changes are policy administration by the human, not a phase agent's self-authorized work. No current phase allowlist grants these edits.
- Code Review must save its report to `docs/code-review-report.md`; Verify must save its report to `docs/verification-report.md`. A report in chat alone does not replace these registry output paths. Preserve their specialist review and testing responsibilities.

## Commands, Dependencies, and Network
- Before running any command, check both global `allowRunCommands` and phase `canRunCommands`. If either denies it, do not run it. If either is `"ask"`, request and obtain explicit approval before running the exact command or clearly enumerated command group.
- Command approval does not authorize file writes, deletion, network access, commits, pushes, or installation that another policy prohibits. Inspect expected side effects before asking.
- Before installing dependencies, check global `allowInstallDependencies`, phase `canInstallDependencies`, command permissions, write paths, and network restrictions. If an applicable permission is `"ask"`, stop and obtain approval first. Missing phase installation permission denies installation.
- Respect `allowNetworkAccess: false` for all network tools and commands, including package downloads, remote Git operations, and GitHub PR API calls. Do not use another tool to bypass the denial.
- Respect `allowFileDeletion: false` and `allowGitPush: false`. Do not delete files or push commits under this registry.
- Before a Git commit, check global `allowGitCommit` and command permissions. `"ask"` requires explicit approval; permission to edit files does not imply permission to commit.
- PR creation requires phase `canCreatePR` approval and all other applicable permissions. The supplied registry blocks network access and Git pushes, so remote PR creation remains blocked until the human explicitly revises the conflicting policy. Never merge a PR when `canMergePR` is false, and never approve or merge your own PR.

## Phase Entry and Completion Gates
- A phase with `status: "locked"` must NOT begin specialist work. Tell the user to complete and approve the predecessor phase, then have the human explicitly unlock the intended phase. Read-only coordinator inspection for status reporting is not specialist execution.
- Before entering an approved phase, inspect `dependsOn`, verify the predecessor's exit evidence, and confirm explicit human completion approval. An existing output file or `status: "approved"` alone does not prove completion.
- `status: "approved"` authorizes eligible phase entry; it does not waive `requiresApprovalToComplete`. In the initial registry, Requirements may begin but `approvedBy: null` means completion approval is not recorded.
- After producing the output, check the registry `exitGate` and the stricter orchestrator/specialist gates. Ask for explicit approval to complete when `requiresApprovalToComplete` is true. Do not mark the phase complete without the evidence and human decision.
- The human records completion approval in `approvedBy` and explicitly authorizes the next phase. Do not fabricate an approver identity or automatically modify statuses. A name in the registry must be backed by an actual human approval decision, not treated as evidence on its own.
- When `requiresApprovalPerTask` is true, propose one task and its intended changes, then wait for approval before applying them. Phase-entry approval does not authorize every task or command.
- Never auto-advance. With `requireApprovalBetweenPhases: true`, `allowAutoAdvance: false`, and `humanInTheLoop: true`, pause for explicit human approval between every pair of phases, even if all artifacts already exist.
- If evidence is stale, a dependency changes, or an approval cannot be established, stop progression and report the blocker. Route rework to its owning phase and request renewed approval.

## Secrets and Limitations
- Never commit secrets, credentials, or tokens. With `blockSecretsInOutput: true`, do not expose them in responses, reports, command arguments, captured logs, or test evidence. Redact sensitive values and ask the user to enter secrets directly into an appropriate secure interface when necessary.
- Do not claim that registry permissions, instructions, or JSON Schema create a technical sandbox. These are agent workflow constraints; tool-level enforcement requires separately configured hooks or access controls, which are outside this setup.
- The schema validates data shape and allowed values; it does not verify exit evidence, real human identity, dependency order, or actual completion. Check those explicitly during coordination.