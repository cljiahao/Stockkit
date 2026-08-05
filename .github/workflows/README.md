# workflows

## Purpose

GitHub Actions CI pipelines: `ci.yml` (harness integrity, check, unit tests,
coverage gate, build, db migrations + RLS, changelog gate, README-freshness
gate) and `security.yml` (gitleaks secret scan, dependency audit, CodeQL).

## Contents

- `ci.yml` — triggers on push to `main` and on every PR. Jobs: `test`
  ("check + unit" — `pnpm install --frozen-lockfile`, `.claude/verify-harness.sh`
  harness-integrity check, `pnpm check`, `pnpm test:ci`, then a changed-line
  coverage gate via `diff-cover` against `origin/main`, failing under 80%);
  `build` ("build (next build)" — `pnpm build` with dummy Supabase env vars,
  since dynamic routes render at request time); `db` ("db (migrations +
  pgTAP RLS)" — `supabase start` applies every migration in
  `supabase/migrations/`, failing the job if one is malformed, then
  `supabase test db` runs the pgTAP suite in `supabase/tests/rls.test.sql`);
  `changelog` (PR-only — if `src/` changed, `CHANGELOG.md` must also be in
  the PR diff; skippable via the `skip-changelog` label); `readme-freshness`
  (PR-only — if a folder's files changed, that folder's `README.md` must
  also be in the PR diff; skippable via the `skip-readme-check` label);
  `comment-hygiene` (PR-only — hard-fails on change-narration comments in
  *added* lines only, via `git diff -U0` against the PR base, using the
  first 10 (keyword) patterns from `.claude/comment-hygiene-patterns.txt`;
  skippable via the `skip-comment-check` label).
- `security.yml` — triggers on push to `main`, every PR, and a weekly cron
  (`0 6 * * 1`, CodeQL only). Default job permission `contents: read`. Jobs:
  `gitleaks` ("secret scan" — skipped on the scheduled run; widens
  permissions to add `pull-requests: read` for the PR-scan API call; checks
  out full history and runs `gitleaks/gitleaks-action` v3); `audit`
  ("dependency audit (pnpm)" — skipped on the scheduled run; hard-gates on
  `pnpm audit --prod --audit-level=high`, then runs a full
  `pnpm audit --audit-level=high || true` informationally for devDeps);
  `codeql` ("CodeQL (javascript-typescript)" — only runs
  `if: github.event.repository.private == false`, i.e. self-skips on this
  private repo since code-scanning upload requires GitHub Advanced Security
  on private repos; would self-enable if the repo went public — uses
  `security-extended` queries, needs `security-events: write`).

## Connectivity

Both workflows pin every third-party action to a full commit SHA (with a
version comment) rather than a floating tag. `ci.yml`'s `db` job depends on
every file in `supabase/migrations/` applying cleanly and on
`supabase/tests/rls.test.sql`'s inline fixtures (no seed data needed).
`ci.yml`'s `test` job depends on `.claude/verify-harness.sh` and
`.claude/harness.json` (one level up, outside this folder) staying in sync —
see `.claude/README.md`. `security.yml` is what husky's `pre-commit` gitleaks
step (`.husky/lib/pre-commit.sh`) mirrors locally, minus CodeQL/audit.

## Parent

[.github](../README.md)
