# .claude

## Purpose

Claude Code harness for stockkit: hook scripts that enforce guardrails at
tool-call/session boundaries, project skills, the harness integrity manifest,
and its verifier.

## Contents

- `harness.json` — harness manifest: templateCentral version/stack/adaptation metadata, plus `seeded_files` — the enforcement-layer file list (path + sha256 `origin_hash`) that `verify-harness.sh` diffs against
- `hooks/` — the lifecycle scripts `settings.json` wires up: `protect-files.sh` (blocks/asks-approval on writes to secrets and governance files), `block-no-verify.sh` (blocks `--no-verify` and hook-bypass patterns), `user-prompt-guard.cjs` (prompt-injection/credential pattern check), `post-edit-typecheck.sh` (incremental `tsc --noEmit` after every edit), `post-tool-failure.sh` (surfaces failed-tool errors), `stop-checks.sh` (runs the test suite before letting a turn end), `subagent-stop.sh` (type-gates a subagent's uncommitted changes), `session-context.sh` (re-injects AGENTS.md routing context on session start), `skill-usage-log.sh` (appends every skill invocation to `.claude/skill-usage.log`)
- `regen-harness.sh` — human-run-only: rewrites every `origin_hash` in `harness.json` to match current on-disk content, blessing an intentional harness edit; `protect-files.sh` requires human approval before an agent can even edit it
- `settings.json` — wires each script in `hooks/` to a Claude Code lifecycle event (PreToolUse, PostToolUse, PostToolUseFailure, Stop, SubagentStop, SessionStart, UserPromptSubmit) and sets tool `permissions` (allow/deny/ask) and skill overrides
- `skills/` — project skills (`next-verify`, `supabase-migrate`)
- `verify-harness.sh` — harness integrity sensor: recomputes sha256 for every seeded file matched by a path guard and compares to `harness.json`'s `origin_hash` baseline; read-only, exits non-zero on drift; run by CI and husky's `pre-push` hook

Unlike loopkit, stockkit has no `.harness-base/` — no upstream 3-way-merge
snapshot has been seeded here yet.

## Connectivity

`settings.json` is the wiring diagram: it maps each Claude Code lifecycle
event to a script in `hooks/` (e.g. `PreToolUse` → `protect-files.sh` and
`block-no-verify.sh`, `Stop` → `stop-checks.sh`), so a hook script does
nothing until `settings.json` references it. `harness.json`'s `seeded_files`
list is the source of truth for which of those hook scripts (plus
`settings.json` itself, the husky/gitleaks/CI config) count as
"enforcement layer" — `verify-harness.sh` hashes each listed path and fails
if it drifts from the recorded `origin_hash`, catching silent edits or
accidental reverts. `skills/` holds project skills invoked on-demand;
`skill-usage-log.sh` appends a line to `.claude/skill-usage.log` on every
skill invocation.

## Parent

[stockkit](../README.md)
