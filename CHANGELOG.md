# Changelog

## Unreleased

### Changed

- Migrated onto the shared `@merqo/ui` component package (v0.8.1):
  `useAsyncAction`, `Section`, `ImageUploader`, `DashboardTour`,
  `TwoColumnSections`, and the composed `AccountMenu`+`DashboardNav` are
  now thin adapters over the shared components, matching qkit's
  migration. `feedback-form.tsx`/`support-form.tsx` and their
  `<SentConfirmation>` success card (added below, in the same
  Unreleased batch) are removed entirely — `AccountMenu`'s built-in
  `FeedbackSheet`/`HelpSheet` now own that UI, closing on submit rather
  than showing a persistent "sent" card. The local `tour.css` popover
  theming is also removed — `DashboardTour` now generates the same
  scoped rules at runtime from this app's own CSS custom properties.
  `InfoTooltip` was evaluated but has no stockkit call site to migrate
  (no existing tooltip usage).

### Fixed

- Session-refresh middleware (`updateSession`) now also covers `/admin`,
  not just `/dashboard` — an `/admin` visit on a near-expiry token now gets
  the same cookie-refresh treatment a `/dashboard` visit already got.
  `requireAdmin()` still independently enforces authorization; this was a
  cookie-refresh gap, not an authorization gap.

### Changed

- `feedback-form.tsx`/`support-form.tsx` now use the shared
  `useAsyncAction` hook instead of hand-rolled `useTransition` +
  try/catch, and share a new `<SentConfirmation>` component for their
  post-submit success card. Also dropped both forms' stale "designed to
  be mounted in a Sheet ... later task" doc comments now that
  `dashboard-nav.tsx` has had them wired up for a while.

### Added

- `src/lib/stock.test.ts` — boundary-case coverage for `stockStatusFor`
  (core shared ok/low/out stock classification, previously untested).
- templateCentral 5.13.0 comment-hygiene enforcement layer: a live
  `PostToolUse` hook (`.claude/hooks/post-edit-comment-check.sh`,
  feedback-only), a warn-only husky pre-commit check
  (`.husky/lib/comment-hygiene.sh`), and a CI job (`comment-hygiene`,
  scoped to added lines only) — alongside the existing static ESLint
  gate (`no-inline-comments`/`sonarjs/no-commented-code`).

- Merqo-team admin console at `/admin` (ported from loopkit's proven
  admin-console pattern, adapted to stockkit's vendors/products/
  stock_movements domain): a gated overview page (vendor/product/plan
  totals plus a cross-vendor recent-activity feed) and a vendors page
  with a per-vendor Free/Pro plan toggle. Backed by migration
  `0013_stockkit_admin.sql` (`admins` allow-list, `is_admin()`,
  `admin_audit` log — no self-elevate UI, bootstrap the first admin by
  SQL). Added the shadcn `Badge` primitive via the CLI (previously
  missing from this repo).

### Changed

- `SiteFooter` rebuilt to match qkit's exact single-row footer layout
  (wordmark, tagline, copyright, sign-in link as flex siblings), dropping
  the inverted dark `bg-foreground`/`text-background` treatment for a
  plain `border-t`. The sign-in link is now an opt-in `showSignIn` prop
  (on only for the public layout, off for the dashboard's reuse of the
  same footer). The bottom call-to-action band above it was also
  removed — qkit's landing page never had one.

### Added

- `BackToTop` scroll-to-top button on the landing page (ported from qkit).

### Fixed

- Dashboard onboarding tour now stamps `tour_seen_at` as soon as it
  auto-runs, not when it finishes — a refresh mid-tour no longer makes
  it re-run on every dashboard load.
- Google OAuth sign-in now forces the consent screen to English
  (`hl=en`), matching the fix already shipped in paykit/merqo.
- Dashboard sticky-header styling moved from `DashboardNav` into
  `layout.tsx`'s `<header>`, matching the shared convention every other
  kit's dashboard nav already uses.
- Navbar "Get started" CTA now uses the shared `size="sm"` Button token
  (was a custom className), matching the cross-kit landing-page parity pass.
- Login page brought to cross-kit parity: wordmark resized to `text-3xl`,
  Google icon extracted into `google-mark.tsx`, and the email placeholder
  and sign-up/sign-in toggle button spacing aligned with the other kits'
  login pages.
- Browser-tab title now uses the cross-kit "Name | Tagline" Title Case
  format: "Stockkit | Inventory Tracking" (was "stockkit: inventory
  tracking").
- `.husky/lib/pre-commit.sh` used `xargs -d '\n'`, a GNU-only flag not
  supported by BSD xargs (macOS default) — broke every local commit
  touching a staged .ts/.tsx/.js/.mjs/.cjs file. Swapped for portable
  `tr '\n' '\0' | xargs -0`.
- Browser-tab title given a tagline ("stockkit: inventory tracking"), matching
  the sibling kits' "name: tagline" shape instead of a bare product name.
- Dashboard and landing navbar height, padding, and logo size now match
  qkit's spec (`px-5 py-3.5`/`py-4`, `text-3xl` logo, no fixed `min-h-16`).

### Changed

- Migrated git hooks from lefthook to husky — lefthook's unsigned
  `lefthook.exe` is unconditionally blocked by Windows Smart App Control on
  this machine; husky has no native binary. Same checks, same rigor.

- **chore:** templateCentral 5.12 migration health-check fixes: `package.json`'s
  `prepare` script now tolerates a missing `.git` (`lefthook install || true`,
  fixes Docker builds where `.dockerignore` excludes `.git`); fixed a lowercase
  `docs/constitution.md` reference in `.claude/settings.json`'s `permissions.ask`
  to match `protect-files.sh`'s canonical uppercase `docs/CONSTITUTION.md` (no
  constitution file exists yet, but this closes a latent case-sensitivity trap
  for whenever one is added); removed the unused, unwired `.claude/hooks/verify.sh`
  leftover; bumped the `pnpm/action-setup` action pin to v4.4.0 in `ci.yml` and
  `security.yml`.
- Added a Free/Pro vendor tier. `vendors.plan` (migration
  `0009_vendor_plan.sql`, defaulting to `'free'`) drives a shared
  entitlement model in `src/lib/plan.ts` (`ENTITLEMENTS`/`normalizePlan`),
  which gates three things: new products are capped at 20 active on Free,
  stock-movement history is trimmed to the last 10 rows per product, and
  CSV export of the ledger is Pro-only. A new `/dashboard/plan` page (linked
  from the account menu) shows the vendor's current tier and what it
  entitles them to, with an "Ask us to upgrade to Pro" CTA that files a
  `billing` support message — there's no self-serve billing yet, Pro is
  granted manually.
- **Security:** closed a plan-escalation hole the tier work opened
  (migration `0010_vendor_plan_grants.sql`). `0001` granted `authenticated`
  table-level INSERT/UPDATE on `vendors`, and the `vendors_self_*` RLS
  policies only check row ownership, never which columns are written — so
  any signed-in vendor could `from('vendors').update({ plan: 'pro' })`
  straight from browser devtools and self-grant Pro, making the whole tier
  system bypassable. Both grants are now **column-level**
  (`UPDATE (id, name, tour_seen_at)`, `INSERT (id, name)`), which is the only
  construct that actually restricts a column — Postgres can't carve one out
  of a table-level grant, so a `REVOKE UPDATE (plan)` on top of one is a
  silent no-op (the same trap qkit hit and fixed in its `0042`). `plan` is
  now writable only by `service_role`. `vendors_self_update` also gained the
  `WITH CHECK` it was missing, so its row can't be re-pointed at another
  auth user.
- **Security:** the Free plan's 20-active-product cap is now enforced in
  Postgres, not just in the `saveProduct` server action (migration
  `0011_product_limit_rls.sql`). The action-only check was skippable by
  calling `from('products').insert(...)` directly from the browser client.
  `products_vendor_all` (`FOR ALL`) is split into per-command policies so
  INSERT can be gated on a new `stockkit.can_create_product()`
  `SECURITY DEFINER` function; the server action's check stays as the
  friendly-error fast path. That policy check alone is not enough, though —
  an RLS `WITH CHECK` runs per row against the statement's own snapshot, so
  rows inserted earlier in the same statement are invisible to a later row's
  check and a single `insert([...30 rows])` from the browser sailed past the
  cap 30 times over. The cap is therefore really guaranteed by a new
  statement-level trigger (`products_enforce_active_cap`, `AFTER INSERT`
  with a transition table) that recounts each affected vendor's true
  post-statement total and rejects the whole statement if it is over —
  under a per-vendor advisory lock, which closes the concurrent-insert
  variant of the same bypass too. Also fixed the function grants: `stockkit`
  is a PostgREST-exposed schema and functions default to `EXECUTE` for
  `PUBLIC`, so `can_create_product` was a live
  `POST /rest/v1/rpc/can_create_product` oracle telling anyone whether an
  arbitrary vendor was on Pro or under their cap; it is now granted to
  `authenticated` only, and the two supporting functions to no one. New
  pgTAP assertions in `supabase/tests/rls.test.sql` cover both migrations
  against a real Postgres, including the multi-row batch.
- **Security:** closed the reactivation half of the same cap bypass, left
  open on purpose by `0011` (migration `0012_product_reactivation_limit.sql`):
  create 20 active, deactivate one, insert a replacement, then reactivate
  the deactivated one — 21 active, repeatable. `saveProduct`'s update branch
  had no cap check at all on this path before now. Same two-layer shape as
  `0011`, adapted for `UPDATE`: a `BEFORE UPDATE FOR EACH ROW` trigger
  compares `OLD`/`NEW.is_active` directly (an RLS `WITH CHECK` can't see
  `OLD`, so it can't tell a reactivation apart from an ordinary edit to an
  already-active product); it turns out to already catch a same-statement
  batched reactivation too, since (unlike RLS's `WITH CHECK`, evaluated per
  row against one fixed statement-wide snapshot) a row-level trigger runs
  live SQL and Postgres advances the command counter between rows of the
  same statement. An `AFTER UPDATE FOR EACH STATEMENT` trigger with `OLD`/
  `NEW` transition tables backstops it regardless, closing the
  concurrent-transaction race the row-level trigger can't see (two sessions
  each reactivating one product at once) — the same reason `0011`'s insert
  side takes a per-vendor advisory lock. `saveProduct` also gained a
  matching app-level check.
- `vendorEntitlement` (`dashboard/products/actions.ts`) now logs a failed
  plan lookup instead of swallowing it. It still fails closed to Free —
  the right default — but a transient DB error silently downgrading a
  paying Pro vendor (capped products, truncated history, no CSV export)
  used to leave no trace at all.
- `DashboardNav`'s mobile burger toggle now uses the shadcn `Button`
  (`variant="ghost" size="icon"`) instead of a raw `<button>`, and its
  mobile links panel is now an absolutely-positioned, backdrop-blurred
  overlay with a tap-away scrim that dismisses it on outside click —
  both ported from qkit's equivalent component, for cross-product UX
  consistency.
- Ported qkit's `BackButton` component (`src/components/back-button.tsx`)
  and switched the profile page's "← Dashboard" text link to use it, for
  a consistent hit target/hover affordance instead of a plain underlined
  link.
- Backfilled missing `README.md`s for `src/app/actions/`,
  `src/components/ui/`, and `.claude/` — three folders that had drifted out
  of the readme-coupling convention followed everywhere else in the repo
  (and across the other Merqo kits). No code changes.
- Added a dashboard onboarding tour (`@/components/dashboard-tour`, ported
  from qkit): a `driver.js` overlay that auto-runs once on a vendor's first
  login and is replayable anytime via a floating "?" button. Seen-state is
  tracked server-side (`vendors.tour_seen_at`, migration
  `0008_vendor_tour_seen.sql`, stamped via the new `markTourSeen` server
  action) rather than `localStorage`, so it's consistent across devices.
- Added `supabase/seed/starter-inventory-prod.sql` — a manual, idempotent
  demo seed script (6 products spanning all three stock statuses + an
  11-row stock-movement ledger) for showcasing stockkit against a real
  hosted vendor account.
- `DashboardNav`'s stall name now comes from the shared
  `merqo.vendor_profile.stall_name` (via a new `resolveVendorName`
  helper), not stockkit's own local `vendors.name` column — matching
  `profile/page.tsx`'s existing source of truth (and qkit's/loopkit's own
  cutover to the same pattern). A vendor whose stall name only lived in
  the shared table — e.g. it was set from another Merqo kit, or they
  signed up via Google OAuth, which never creates a local `vendors` row
  at all — saw the "Your stall" fallback in the nav forever, even though
  the profile page showed their real name.
- `unit_cost_cents` (`productFormSchema`/`stockMovementFormSchema`) is now
  capped at `MAX_MONEY_CENTS` ($10k), matching qkit's fat-finger guard rail
  on every money field — previously unbounded, so a stray extra digit while
  typing a unit cost had nothing stopping it from saving.
- Added `supabase/migrations/0007_rls_select_auth_uid.sql`, retrofitting
  every `stockkit`-schema RLS policy (`vendors`/`products`/
  `stock_movements`/`feedback`) to wrap `auth.uid()` in a scalar subquery
  (`(select auth.uid())`), matching qkit's own retrofit — Postgres
  re-evaluates a bare `auth.uid()` once per row instead of once per query,
  Supabase's documented `auth_rls_initplan` linter warning. Row-level
  isolation is unchanged.
- Added `formatPrice` (`src/lib/schemas.ts`) — a locale-formatted currency
  helper (`Intl.NumberFormat`, matching qkit's/loopkit's `en-SG`/`SGD`
  convention) for read-only money display. The dashboard's "Inventory
  value" stat was using `centsToDollarString` — the plain-decimal helper
  documented for form inputs/CSV, not display — via a hardcoded `$`
  prefix, so it never got thousands separators.
- Added `test/setup.ts` as Vitest's global `setupFiles` entry (matching
  qkit's/loopkit's setup), and removed the per-file `afterEach(() =>
cleanup())`/`ResizeObserver` stub boilerplate it now duplicated across
  19 `.dom.test.tsx` files. Also added `@testing-library/jest-dom` as a
  dependency and wired its matchers in — stockkit had none available
  anywhere before this.
- `eslint.config.mjs` now turns `no-inline-comments`/`sonarjs/no-commented-code`
  off for `**/*.test.{ts,tsx}`, `**/test/**`, and `scripts/**`, matching
  qkit's/loopkit's carve-out — table-driven test fixtures routinely need a
  short trailing note, which the app-code-focused gate would otherwise
  block. Its `ignores` list also gained `coverage/**` and `supabase/**`,
  matching siblings.
- Added `supabase/config.toml` — it was missing entirely, so `supabase
start` fell back to exposing only the `public` schema to the Data API.
  Every Supabase client in `src/lib/supabase/` is scoped to `{ db: { schema:
'stockkit' } }`, so every query the app makes would have been rejected as
  schema-not-exposed against a freshly-started local Supabase — the local
  dev flow this project's own README/AGENTS.md describe as "the only way to
  exercise this app at all" was unusable as committed. Also enables the
  `google` external auth provider (needed for `login-form.tsx`'s "Continue
  with Google" button to work locally) and documents the two env vars it
  reads in `.env.example`. Added a `supabase/README.md` explaining both.
- `src/components/layout/providers.tsx` no longer instantiates a live
  `QueryClient`/`QueryClientProvider` — it was leftover scaffold wiring with
  zero `useQuery`/`useMutation` call sites anywhere in the app, contradicting
  AGENTS.md's own "not wired in" description. Now matches qkit's/loopkit's
  `providers.tsx`, which only wrap `Toaster` (and, for qkit, `TooltipProvider`
  where it's actually used — stockkit has no `Tooltip` usage, so it's
  omitted here too).
- `dev` now runs with `--turbopack` (matching qkit/loopkit's script) and
  `next.config.ts`'s Content-Security-Policy is hardened to match qkit's
  full policy (`default-src`/`script-src`/`img-src`/`connect-src`/etc.,
  env-aware for local Supabase vs. hosted) instead of the near-unrestricted
  baseline (`frame-ancestors`/`base-uri`/`object-src` only) it shipped
  with — `images.remotePatterns` also gained `*.googleusercontent.com`
  since Google OAuth populates `user_metadata.avatar_url` with a
  googleusercontent URL before a vendor ever uploads their own.
- The try/catch-on-thrown-error pattern fixed in `profile-form.tsx` earlier
  is now applied everywhere else a client component calls a server action
  or `supabase.auth`/`supabase.from(...)` directly: `login-form.tsx`
  (Google sign-in, sign-in/up, password-reset send), `reset-password-form.tsx`,
  `feedback-form.tsx`, `support-form.tsx`, `dashboard-nav.tsx`'s sign-out
  (which previously didn't even check the _returned_ error, let alone a
  thrown one), and `product-form.tsx`/`stock-log-form.tsx`'s remaining
  save/delete/record handlers. A thrown rejection (e.g. a raw network
  failure) previously showed no toast and could leave the button silently
  re-enabled with no feedback.
- Renamed this session's newer test files (`error.test.tsx`,
  `not-found.test.tsx`, `global-error.test.tsx`, `loading.test.tsx`,
  `product-form.test.tsx`, `stock-log-form.test.tsx`) to `*.dom.test.tsx`,
  matching stockkit's own established convention (and qkit's documented
  one) for full RTL+jsdom component-render tests — they'd drifted to plain
  `.test.tsx` despite being the same kind of test as the rest of the suite.
- `.prettierrc` now sets `endOfLine: "auto"`, matching qkit's and
  loopkit's config — this is the actual root cause of the recurring
  Windows `prettier --check` CRLF false-positives worked around
  throughout this project's development so far. `tsconfig.json`'s
  `exclude` now also excludes `.claude/worktrees`, matching loopkit.
- `product-form.tsx`'s and `stock-log-form.tsx`'s unit-cost fields
  (free-text, no native numeric validation) now get an inline
  `aria-invalid`/error-message treatment on an unparseable value,
  matching the pattern `profile-form.tsx` already established elsewhere
  in the app — previously these two (pre-existing, this session's work
  never touched them) surfaced every validation failure via `toast.error`
  only.
- Added `src/app/error.tsx` (nested-error boundary), `src/app/not-found.tsx`
  (custom 404), and `src/app/global-error.tsx` (root-layout crash boundary
  — own `<html>`/`<body>`, inline styles), matching qkit's and loopkit's
  three-file pattern. stockkit previously had none of the three, falling
  back to Next's raw default error/404 pages.
- Root layout metadata's `description` was still the unedited Next.js
  scaffold default ("A Next.js application") — replaced with a real
  description of what stockkit does.
- `<Toaster>` now sets `richColors`, matching qkit's and loopkit's config
  — toasts previously rendered without the red/green color-coded
  backgrounds both siblings have.
- Added `src/app/dashboard/loading.tsx` — a centered spinner shown while
  the dashboard segment (or any nested page below it) is loading, matching
  qkit's/loopkit's family-wide convention. Every dashboard page is
  `revalidate = 0` (always dynamic), so this previously had no fallback
  and the content area sat blank mid-navigation.
- `DashboardNav`'s content is now wrapped in `max-w-site mx-auto`, matching
  every dashboard page's own container — previously it had no width
  constraint at all, so on wide screens the wordmark and account menu
  stretched to opposite edges of the viewport with a large empty gap.
  Added inline `Overview`/`Products` nav links (shown at `sm`+, in the
  mobile burger panel below it), matching qkit's dashboard-nav pattern —
  previously there was no persistent way to navigate between dashboard
  pages other than a button embedded in the overview page's own content.
  `next.config.ts`'s `images.remotePatterns` now also allows
  `http://127.0.0.1:54321` (local Supabase CLI storage) alongside
  `*.supabase.co` — without it, `next/image` refused to render an
  uploaded avatar's URL when testing against local Supabase, which is the
  only way to exercise this feature at all per this project's setup notes.
  `profile-form.tsx`'s stall-name and avatar saves now call
  `router.refresh()` on success, so `DashboardNav` (rendered once by the
  persistent layout) picks up the change immediately instead of showing
  stale data until a hard reload.
- Pinned `postcss` to `>=8.5.12` via a `pnpm-workspace.yaml` override,
  patching a high-severity arbitrary-file-read advisory
  (GHSA-6g55-p6wh-862q) in the version pulled in transitively by `next`.
- `DashboardNav`'s account-menu avatar now renders the vendor's uploaded
  profile icon (`AvatarImage`, sourced from `dashboard/layout.tsx` reading
  `user.user_metadata.avatar_url`) instead of always showing initials —
  the upload flow shipped without ever wiring the result up anywhere.
  Also fixed the dropdown's vendor-name label, which rendered as tiny
  muted text instead of a bold name + "Vendor account" subtitle.
- Profile page's social-links inputs now show real brand icons
  (Instagram/Facebook/TikTok via `@icons-pack/react-simple-icons`, a
  generic globe for website) with proper labels, via a new
  `SocialLinksFields` component — previously plain unlabeled inputs with
  the field key as a placeholder.
- `FeedbackForm`'s NPS/category pickers and `SupportForm`'s category picker
  now use shadcn `ToggleGroup`/`Textarea` instead of hand-rolled radio
  markup and a plain `<textarea>`, matching qkit's equivalent components.
  No behavior, copy, or schema change.
- `/dashboard/profile` now covers the full profile-settings standard
  (`docs/business/2026-07-21-profile-settings-page-standard.md`): display
  name, profile icon (upload to a new `vendor-avatars` Storage bucket), and
  change-password sections, alongside the existing stall name/social links.
  Previously only stall name and social links existed on this page.
- Bumped `next` from `^16.2.9` to `^16.2.11`, patching four high-severity
  advisories (SSRF in Server Actions on custom servers, SSRF via
  attacker-controlled rewrite destination hostname) flagged by the CI
  dependency-audit gate.
- `SiteFooter` now renders the full mandatory footer per
  `docs/business/2026-07-21-landing-page-standard.md` §1.5: a `StockKit`
  wordmark (linking `/#top`) and a one-line tagline, alongside the existing
  `© <year> stockkit · a Merqo kit` credit line — it previously carried only
  the credit line, matching qkit's and loopkit's footer structure.
- Logo mark (`BrandText`, public `Navbar`, `DashboardNav`) now renders
  "StockKit" (PascalCase) instead of "stockkit" (fully lowercase), matching
  the locked cross-kit brand-naming convention. Public `Navbar` gained the
  required `#faq` link and its wordmark now uses a plain `<a href="/#top">`
  instead of `next/link`'s `Link`, matching the locked landing-page
  standard. Favicon's brand color updated to match the current (richer)
  primary — it was still the pre-refresh washed-out hex.
- Landing page visual refresh: a new `Space Grotesk` display typeface on
  every section heading, an ambient cobalt-tinted background, a `LedgerCardPreview`
  hero illustration (mock product card — on-hand count, unit cost, a recent
  stock movement), icons and `01/02/03` numbering on `HowItWorks`, icons on
  `Benefits`, a restrained `fade-rise` entrance animation, and a navbar
  restyle (floating pill → full-width sticky translucent bar).

- Landing page decomposed into section components (`Hero`, `HowItWorks`,
  `Benefits`, `Faq`, `Cta`) matching the sibling kits' structure, adding a
  "why vendors pick stockkit" Benefits section stockkit didn't have before.
- Login gained Google OAuth sign-in and a full forgot-password/reset-password
  flow, via a new `/auth/callback` route — none of this existed previously.
- Login and reset-password restyled with a new `ElevatedCard` component.
- Primary color raised from a washed-out `oklch(0.45 0.09 250)` to a
  contrast-verified richer `oklch(0.46 0.16 255)` (light) /
  `oklch(0.68 0.13 252)` (dark); fixed a dead gradient utility that had three
  identical color stops.
- Public `Navbar`/`SiteFooter` made session-aware server components.
