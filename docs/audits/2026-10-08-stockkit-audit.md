# Stockkit audit, 2026-10-08

## Verified changes

- CSV export prefixes spreadsheet formula-like notes with an apostrophe before RFC 4180 quoting. Typed numeric movement deltas remain numeric. Six injection regressions now pass alongside existing quote/newline escaping tests (32 product-action tests total).
- Migration 0017 restricts stock_movements INSERT to a product owned by the authenticated vendor, closing cross-vendor foreign-key references with caller-owned movement rows. Added pgTAP regression; column/RPC types unchanged and documented. Migration is unapplied; local database test remains pending.
- Tests disable automatic dotenv loading (`envDir: false`). No direct environment-file reads or live database access were performed; the initial inherited baseline preceded this dotenv safeguard.
- Added eight profile-action regressions covering input rejection, authentication, preservation of shared profile fields, scoped local mirroring, and shared/local write failures.
- Added five Supabase adapter tests covering vendor cookies, read-only cookie contexts, missing synthetic service key and privileged-client isolation from request sessions. Added three logging tests covering context forwarding, query-string omission, correlation and generic error responses.

## Validation

- Initial full run: 68 files, 383 tests, six expected pre-fix CSV failures, all other tests passed (304 seconds).
- Product regressions after fix: 32/32 pass.
- Profile regressions: 8/8 pass.
- Supabase/logging regressions: 8/8 pass.
- Typecheck passed after security changes. Final suite: 74 files / 411 tests pass; statements 87.23%, branches 80.53%, functions 82.19%, lines 88.57%. Explicit 80% thresholds are configured for all four metrics.

## Remediated follow-up findings

- P1 ledger retention: archiveProduct updates is_active rather than deleting
  the product. Migration 0018 uses RESTRICT foreign keys for product/vendor
  movement ancestry, retaining the ledger across attempted ancestor deletion.
- P2 opening balance: migration 0018 inserts initial stock inside the product
  insert transaction. A partial unique index allows only one initial row per
  product, protecting mixed-version deployment from the old second insert.
  Existing duplicate initial rows deliberately block migration for review.
- P2 history/export truncation: Pro queries keyset-page by created_at and id
  until an empty response, including when the server cap is below the requested
  batch size. A later page error rejects the full result. Free stays capped.
- P2 audit rejection: src/lib/audit.ts now contains rejected client setup and
  insertion, preserving its documented best-effort contract after a completed
  mutation. New rejection tests still require the final follow-up test run.

## Direct mutation mitigation, pending DB verification

P2 direct quantity/ledger bypass is addressed by additive migration 0019:
authenticated vendors retain UPDATE only on metadata/archive fields and lose
direct movement INSERT. The unchanged-signature stock RPC becomes SECURITY
DEFINER with empty search_path, explicit non-null auth.uid owner check, row
lock, finite/nonzero delta and reason/note/cost validation. Opening inserts use
a definer trigger after product RLS/cap checks. No policy is widened. Trusted
service-role maintenance privileges remain; this is a vendor boundary.

Caller search found application mutations only in product actions and the
manual hosted seed. The seed now skips existing IDs and lets the trigger
create openings; it cannot reset quantities, transfer ownership, or duplicate
initial rows on rerun. Prior seed history is preserved without cleanup.

The new stock-write-boundary.test.sql covers grants, normal writes, cross-owner
and unauthenticated rejection, input validation and transactional failure.
Existing RLS/retention test expectations follow the narrower grants. SQL remains
unapplied and unrun, so the boundary is not claimed database-verified. The
tracked inventory predates these new files and must be refreshed for final review.

## Scope limitations

No commits, pushes, deployments, live database changes or governance edits. Dependency vulnerability scan and live RLS execution remain pending. Coverage target and repository lint/typecheck are verified. Findings above are code observations, not claims of live exploitation or regulatory compliance.

## Coverage checkpoint and dead-code cleanup

Post-fix full suite: 69 files and 391 tests passed. Coverage before subsequent adapter/RPC tests and dead-code cleanup: statements 77.29%, branches 72.94%, functions 64.39%, lines 78.28%.

Removed unreferenced local primitives (avatar, checkbox, dropdown-menu, field, form, sheet, sonner, toggle-group, toggle), unused BrandLogo/LinkList widgets, and unused forwarded-header origin helper after searching source/test/e2e/script consumers. Active product UI primitives are retained. This removes actual unused production code, not coverage exclusions. No dependencies or lockfiles changed.

First-product desktop creation defect reproduced in a failing regression and fixed: the empty inventory branch now renders its creation panel after Add product. Workspace regression suite passes 4/4. Product-detail tests exercise desktop restock/history refresh and mobile tabs. Shared RPC contract tests pass 5/5. Changed-file ESLint and TypeScript checks passed before this final UI regression; final repository ESLint, TypeScript and git diff whitespace checks pass.

Inventory overview tests cover authentication, empty inventory, inventory valuation, urgent-stock ordering, and healthy inventory. Final measured coverage includes these tests and the ProductDetail/workspace regressions. No new coverage exclusions were introduced.

## Latest parent validation and static schema review

Before the best-effort audit follow-up, coverage measured statements 88.05%,
branches 81.29%, functions 83.33%, lines 89.18%; parent reported check passed.
The follow-up requires a fresh focused test/check run before acceptance.

Migration 0018 and ledger-retention.test.sql were independently read. Its 14
assertions cover opening balance/count, archive state/retention, duplicate
opening prevention, product/vendor/account deletion rejection, zero opening,
and rollback on forced ledger failure. The existing RLS fixture products start
at zero before privileged balance updates and explicit initial rows, avoiding
double insertion under the new trigger. RLS ownership applies to the invoker
opening insert; ledger failure rolls back product creation. SQL remains unrun,
and the migrations remain unapplied. Deployment must apply 0018 before the app
stops writing the old separate opening movement.

Scoped boundary review also read admin gate/actions and Merqo bearer/provision/
vendor-status paths. Admin writes gate before privileged clients; Merqo routes
authenticate before service-role access, and provision uses a separate secret
from metrics. No new cross-vendor issue was found in those inspected paths.
This is not a claim that all security boundaries were exhaustively verified.

The companion tracked-file inventory distinguishes individually inspected
files, evidence-backed dead-code removal, protected governance and pending
necessity review. A coverage pass is not proof every file is necessary.

Movement direction follow-up: UI already forced restock positive and waste
negative, but Zod and the RPC accepted contradictory signs. Both boundaries
now enforce that convention, reject infinite deltas, and retain either sign
for adjustments. Eight Zod cases and two additional pgTAP cases cover it;
runtime/SQL verification remains required after this patch.

## Full production source content review

Read every enumerated non-test TS/TSX file in src (125 files including all 14
CLI-owned UI primitives and the database types mirror) plus globals.css.
The separate source-review CSV records exact paths, content hashes, role and
necessity disposition. This content review does not claim all tests, docs,
scripts, historical migrations or governance were individually reviewed.

- P1 products-workspace.tsx: switching selected products retained the previous
  form draft under the new product ID. Both ProductDetail layouts now remount
  per product ID; a real-form regression verifies saved identity and costs.
- P2 movement-history.tsx: returned failures looked like empty ledgers and
  rejected requests stayed loading. Explicit error/retry handling now contains
  both paths. These new fixes require parent focused tests and quality checks.
- Open P2 pagination: admin-data.ts platformTotals/listVendors, dashboard
  overview/products pages and Merqo metrics/vendor-activity/vendor-status
  routes still use unpaginated collection reads. Large accounts/platforms can
  silently lose rows at the API cap. Dashboard reads also suppress DB errors.
- Open P2 rejection handling: login completeSignup synchronization, profile
  updateStallName local mirroring and tour-prefs stampTourSeen can reject after
  successful primary work despite documented best-effort behavior. Avatar
  cleanup also lacks a catch around client creation/parsing (P3).
- Dead-code candidates: constants/env.ts and constants/index.ts have no
  production import consumers; API_ROUTES is definition-only. Retained pending
  complete test/config/dynamic-consumer evidence, not counted as necessary.

Admin pages and mutations individually gate privileged access. Merqo routes
authenticate before service-client use with a distinct provisioning secret.
Service clients remain server-side; normal product reads use the caller's RLS
session. CSV notes are formula-neutralized and quoted. UI text uses React
escaping; tour HTML is static authored markup. No new cross-vendor exploit was
identified in this content pass. Database execution and live browser checks
remain separate validation requirements, not inferred from this review.

## Content-review remediation follow-up

The collection-pagination findings above now have an application patch across
dashboard, admin and Merqo routes. All pages use stable ID cursors through an
empty result, retain their original RLS/filter scope, and reject partial data
on failure. Dashboard failures reach the error boundary. Vendor status reads
only the resolved vendor. The auth-user safety ceiling now reports failure.

Explicit best-effort signup/profile/tour/avatar cleanup side effects contain
rejections as well as returned failures. Primary writes retain their previous
failure behavior. Focused regression and whole-repository validation are
pending parent execution; earlier coverage numbers do not validate these new
patches. Remaining reset-password rejection and orphan-upload behavior need
their separate UI follow-up; no unverified fixes are described as tested.

Reset-session follow-up now handles returned/rejected auth lookup failures with
an explicit retry state, separate from expiry. Rejected avatar metadata saves
retain uploaded objects deliberately: an uncertain network outcome can follow
a committed metadata update, so deleting immediately could break the saved
avatar. A confirmed-unreferenced cleanup job would be a separate storage task.

Final boundary follow-up: legal lookup setup/read rejection fails closed, and
cache-write rejection preserves a successfully verified authoritative result.
Profile social links now accept only HTTP(S), closing dangerous-scheme storage
at the shared-profile action boundary. Regression cases accompany both.

Unused constants/env.ts, constants/index.ts and API_ROUTES were removed after
source/test/e2e/script and explicit config/package consumer searches found only
definitions and the dead barrel. No CLI-owned primitive was hand-edited.
The source-review CSV remains a hashed snapshot of the 126 files read before
these edits; deleted files remain documented as reviewed/dead-scaffold evidence.

## Verified application checkpoint (2026-10-09)

This checkpoint supersedes the earlier pending coverage and quality statements above. The final broad suite passed 463 tests in 81 files. Coverage is 90.35% statements / 83.01% branches / 85.43% functions / 91.53% lines; all four exceed the enforced 80% thresholds. Authored index modules are included. Full ESLint and TypeScript checks pass. Logs: audit-coverage-final.log, audit-eslint-final.log and audit-types-final.log.

The refreshed source ledger records 125 current production TS/TSX/CSS modules. Shared-profile section writes use the atomic partial-update contract; unused whole-profile wrappers are removed. Source hashes verify the reviewed checkpoint, not absence of vulnerabilities. Documentation, tests and historical migrations do not all have the same full-content review claim.

Fresh production dependency audit reports zero advisories. The development dependency audit retains one high-severity braces advisory (GHSA-vfj7-8cjw-p6xm); the advertised fixed version was unavailable from the registry during this checkpoint. This remains open. New migrations and rollback-only SQL tests have not been applied/run because Docker’s Linux engine is unavailable. Browser E2E remain separate validation. No deployment, commit, push, production database mutation or secret-file read is claimed.

Isolated build checkpoint: Next build --webpack passed for a curated temporary copy with sanitized placeholder environment values and no project dotenv files. This verifies compilation, route generation and static prerendering with the webpack path; it does not verify the default Turbopack build, live credentials or deployed integrations.
