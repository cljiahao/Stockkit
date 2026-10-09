# .github

## Purpose

GitHub-specific configuration: CI/CD workflows and automated dependency updates.

## Contents

- `dependabot.yml` — configures Dependabot for two ecosystems (`npm` at `/`, `github-actions` at `/`), both on a weekly schedule with `open-pull-requests-limit: 0`. That limit deliberately disables routine version-update PRs (dropped as noise for a solo, direct-to-main project) while leaving Dependabot's security-advisory PRs (which ignore the limit) active.
- `workflows/` — the GitHub Actions pipeline definitions (`ci.yml`, `security.yml`).

## Workflows

### ci.yml

Runs on push to `main` and on every pull request.

- `test` job — linter (`pnpm check`), unit tests (`pnpm test:ci`), and coverage gate: changed lines must maintain ≥80% coverage vs. main. Uses `diff-cover` to enforce this per-PR, failing fast on coverage drops.
- `build` job — full Next.js production build (`pnpm build`) with dummy Supabase credentials (real creds not needed for dynamic-route prerendering). Catches bundle-boundary errors and build-time type issues that unit tests miss.
- `db` job — Supabase migrations (`supabase start` applies every migration in `supabase/migrations/`) + pgTAP RLS test suite (`supabase/tests/rls.test.sql`). Fails if a migration is malformed or if any authorization policy is broken.
- `changelog` job (PR-only) — if `src/` changed, `CHANGELOG.md` must be updated. Skippable via the `skip-changelog` label.
- `readme-freshness` job (PR-only) — if files in a folder changed, that folder's `README.md` must be updated (e.g. adding a new helper to `src/lib/` triggers a check for `src/lib/README.md`). Skippable via the `skip-readme-check` label.

### security.yml

Runs on push to `main`, on every pull request, and on a weekly schedule (Monday 06:00 UTC for CodeQL).

- `gitleaks` job — installs the pinned release binary, verifies its SHA-256 and scans the PR commits or pushed range. Disabled on scheduled runs.
- `audit` job — dependency audit on production deps only (`pnpm audit --prod --audit-level=high`), hard-blocking on high/critical vulnerabilities. Also runs a full audit including devDependencies (informational, never fails) to surface test-toolchain issues. Disabled on scheduled runs.
- `codeql` job — GitHub's semantic code scanning (javascript-typescript, security-extended queries). **Dormant on this private repo** (code scanning requires GitHub Advanced Security or a public repo); self-enables if the repo is ever made public. Runs on the weekly schedule; push/PR runs are skipped via the `if: github.event.repository.private == false` condition.

## Connectivity

`workflows/` holds the GitHub Actions pipelines that run on push/PR and schedule; `dependabot.yml` configures automated security-advisory PRs, independent of those workflows. Together they're this repo's whole CI/security surface — referenced from `AGENTS.md`'s "AI Harness" section (security scanning via `.github/workflows/security.yml` and `.github/dependabot.yml`).

## Parent

[stockkit](../README.md)
