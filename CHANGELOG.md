# Changelog

## Unreleased

### Added

- `/admin/activity` — an audit-trail viewer for `admin_audit`, rendered via
  `@merqo/ui`'s shared `AuditLogTable`. Shows the most recent 100 rows
  (`set_vendor_plan`/`set_pricing`/`delete_product`), actor-resolved to a
  vendor name where the actor is a vendor (falling back to the raw
  `admin_id` otherwise), with a flattened readable rendering of each row's
  `detail` jsonb column. Linked from `AdminNav`'s tab bar alongside
  Overview/Vendors.

### Removed

- The kit-local `ThemeToggleButton` widget and its public-landing-nav
  placement (next to the Dashboard/Sign-in buttons) — a signed-in
  preference control didn't belong on a public marketing page. Theme
  switching (light/dark/system) now lives in `@merqo/ui`'s shared
  `AccountMenu`, bumped to v0.18.0. `next-themes` and the `ThemeProvider`
  wiring in `src/app/layout.tsx` are unchanged — still what makes the
  `.dark` palette work.

### Changed

- Bumped `@merqo/ui` to v0.20.0: the admin overview's `Stat` tile now
  wraps the new shared `StatTile` content instead of a fully local
  implementation — no visible change, stockkit's own `ElevatedCard` shell
  and `font-mono` value convention are unchanged.
- Bumped `@merqo/ui` to v0.19.0: the theme control now sits behind a
  collapsed "Theme · {current}" submenu instead of three always-expanded
  radio options.
- The onboarding tour's "example product" stock-status pill now renders
  the real `StockStatusIndicator` component instead of a hand-copied
  color — the hand copy had already drifted into a real bug, showing the
  primary color for a "Low stock" pill when this repo's own convention
  reserves green/amber/red exclusively for stock status. Also extracted
  `StockStatusIndicator` (new `src/components/stock-status-indicator.tsx`)
  out of three previously-duplicated inline copies (`product-row.tsx`,
  `product-detail.tsx`, the overview page).
- Fixed the spec-doc link this added to `src/components/README.md` — was
  one directory level short of the workspace root.

### Fixed

- Cards were visually indistinguishable from the page background in light
  mode — the Reefer Frost rebrand set `--card`/`--popover` to the exact
  same OKLCH value as `--background`. Restored a distinct, lighter card
  treatment in light mode (`src/app/globals.css`); dark mode was already
  correct, and got a further brightness bump on top of that for even
  better contrast.
- The favicon/apple-touch-icon (`src/lib/brand-icon.tsx`) still rendered
  the old steel/cobalt-blue hex after the Reefer Frost rebrand — a real
  visible bug, not just stale docs.

### Changed

- Onboarding tour copy: no more em dashes, richer Products-step copy
  covering restock/waste/adjustment logging, and an example product-row
  preview on the first step.

### Added

- Widened `admin_audit` coverage: a vendor's own product deletion
  (`deleteProduct`) is now recorded, not just admin-console actions —
  `recordAudit()` moved to a shared `src/lib/audit.ts`. New migration
  revokes `UPDATE`/`DELETE` on both `admin_audit` and `stock_movements`
  from `service_role` (kept to `SELECT`/`INSERT`), closing a real
  tampering gap at zero functional cost. Retention (5 years, matching
  IRAS) now stated in `AGENTS.md`.

### Changed

- Brand theme: `globals.css`'s color tokens replaced with "Reefer Frost"
  (chilled cyan-teal primary, frost-grey paper, crate-stamp crimson on
  destructive/attention actions), light and dark, across the full
  shadcn token set. Purely cosmetic — no component/behavior change.

### Fixed

- Bumped `@merqo/ui` to v0.14.1 — the kit-switcher (account menu's
  "Switch products") was sending vendors to a kit's `-sg.vercel.app`
  deployment host instead of its real `<kit>.merqo.io` domain, a
  different host from the shared-session cookie's `.merqo.io` scope —
  bouncing a switching vendor into a login loop instead of a live
  session.

### Added

- Kit switcher: the dashboard's account menu now has a "Switch products"
  submenu listing the other three live kits (qkit, loopkit, paykit), each a
  plain link to that kit's dashboard. SSO via the shared `.merqo.io` cookie
  already signs a vendor in everywhere, so this is purely in-product
  navigation — no new backend, no live per-vendor filtering (every kit's
  dashboard already handles a signed-in vendor gracefully even without that
  kit's own vendor row). Via `@merqo/ui`'s new `switchKits` prop on
  `DashboardNav`/`AccountMenu`, bumped to v0.13.0.
- Admin-editable pricing: a new single-row `stockkit.pricing` table
  (migration `0014_stockkit_pricing.sql`, public-read RLS, service-role-only
  writes) replaces the hardcoded `PRO_PRICE` constant on the vendor plan
  page. Admins can now change the Pro price live from `/admin`'s new
  Pricing section — no redeploy — via `@merqo/ui`'s new `PricingForm`
  component and a new `setPricing` server action.

### Fixed

- `/dashboard/plan` no longer advertises "Valuation trend reports (coming
  soon)" as a Pro perk (`src/lib/plan.ts`'s `resolvePlanView`). No such
  feature exists anywhere in the codebase or has a shipped timeline — a
  paying vendor should not be shown a promise that isn't real. Building the
  feature itself remains separate, unscheduled, out-of-scope work.
- `next.config.ts`'s `headers()` applied `X-Frame-Options: DENY` and CSP
  `frame-ancestors 'none'` unconditionally to every route, including
  `next dev` — both headers are enforced by browsers even on localhost, so
  any preview mechanism that renders the dev server via an `<iframe>` (most
  IDE preview panes do) was silently blocked. Both are now gated behind
  `process.env.NODE_ENV === 'production'`, matching this file's existing
  dev/prod branching style for `connect-src`/`img-src`/`script-src`.
  `frame-ancestors` is omitted from the dev CSP entirely rather than
  relaxed to `'self'`, since a preview pane is typically cross-origin.
  Verified live: booted real dev and prod servers and curled the actual
  response headers in each — dev has neither header, prod has both.

### Changed

- Kit switcher now sources its "Switch products" entries from `@merqo/ui`'s
  new centralized `KIT_FAMILY` registry via `getSwitchKits('stockkit')`,
  replacing the locally hardcoded `SWITCH_KITS` array in
  `dashboard-nav.tsx`. Same three kits, same URLs — this is a pure refactor
  so that adding a future live kit only requires updating `@merqo/ui`, not
  every kit's own `DashboardNav` wrapper. Bumped `@merqo/ui` to v0.14.0.
- Pro's monthly price rises from $14/mo to $19.99/mo, seeded directly on the
  new `stockkit.pricing` table (see Added, above). Rationale and comparator
  research: `docs/business/2026-08-15-per-kit-pricing-rationale.md`.
- Bumped `next`/`eslint-config-next` floors to `^16.2.12` (`eslint-config-next`
  was actually still at a stale `^16.2.6` floor, well behind `next`'s own
  `^16.2.11`). `pnpm install` resolved both to the current `16.3.1` under
  the existing caret-floor pinning model. `pnpm check`, `pnpm test`, and
  `pnpm build` all verified clean against the resolved version.
- Harness re-synced to templateCentral v5.15.0 (was v5.11.0). Cross-checked
  the 5.11.0→5.15.0 CHANGELOG against actual code instead of blindly
  overwriting: `.claude/settings.json`'s hook commands moved from a
  shell-string `command` to the exec-form `command`+`args` pair (avoids
  shell-quoting); `permissions.deny` build-artifact reads gained the
  `./**/`-anchored form (`dist/**`/`.turbo/**` were previously unguarded
  entirely). Everything else — hook script bodies, comment-hygiene
  patterns, the CI workflow, `.gitleaks.toml`, the husky git-hook layer —
  was already byte-identical in intent to 5.15.0 canonical; no changes
  needed. `.claude/.harness-base/` (the 3-way-merge base for future
  re-syncs) never existed for this repo; created from the current seeded
  files. `.claude/verify-harness.sh`/`regen-harness.sh` intentionally keep
  their Windows-safe `git show HEAD:` hashing (not the plugin's raw
  disk-read canonical) — that divergence predates this pass and fixes a
  real CRLF false-positive on `core.autocrlf=true` checkouts.
- `eslint.config.mjs` now extends `sonarjs.configs.recommended` (268 rules)
  instead of wiring up only `sonarjs/no-commented-code` by hand — adds
  bug-pattern, security, and code-smell coverage across the app. The
  recommended config ships `no-commented-code` at `off`; overridden back to
  `error` to keep this repo's comment-hygiene house rule. Scoped overrides:
  `src/components/ui/**` (generated shadcn primitives) turns off
  `sonarjs/prefer-read-only-props`; test files turn off
  `sonarjs/no-hardcoded-secrets`/`sonarjs/no-clear-text-protocols` so fake
  fixtures don't false-positive. Fixed every real finding surfaced: five
  nested ternaries extracted into named helper functions, one function's
  cognitive complexity reduced by extracting the reactivation-cap check out
  of `saveProduct`, a redundant `void` operator removed, a floating-point
  `toBe` assertion switched to `toBeCloseTo`, a generic length assertion
  switched to `toHaveLength`, and the `error.tsx` boundary component renamed
  off `Error` (was shadowing the global).
- Second frontend-design/impeccable critique pass: the app's dark theme
  (a full `.dark` palette in `globals.css`, already wired for every
  semantic color token) was completely unreachable — no toggle and no
  OS-preference detection ever applied the `.dark` class, so `ThemeToggleButton`
  sat unused and every vendor got the light theme regardless of device
  setting. `ThemeProvider` now defaults to `defaultTheme="system"` (was
  hardcoded `"light"`), so the OS/browser preference applies on first
  visit; `ThemeToggleButton` (rebuilt on shadcn's `Button` for nav-bar
  sizing) is now wired into the public nav's `end` slot as a manual
  override — the only reachable spot for it, since `DashboardNav` is a
  `@merqo/ui` shared shell with no free slot, though the choice persists
  via next-themes' localStorage to every route including `/dashboard`.
- Display font switched from Space Grotesk to Fraunces (the shared
  family display face — see
  `docs/business/2026-08-13-typography-family-standard.md`). qkit
  already used Fraunces; this brings stockkit in line with the rest of
  the family now that cross-kit SSO means vendors move between kits
  under one identity, so a per-kit display face reads as a seam rather
  than a feature. Body (Lato) and mono (Geist Mono) fonts are unchanged.
  The brand-icon mark's font fallback also switched from the system
  sans-serif stack to the Georgia serif stand-in, matching Fraunces
  being a serif.
- Design pass from a completed frontend-design/impeccable critique:
  hero headline is now the actual value proposition instead of a
  restated wordmark; the gradient wordmark treatment is now used
  consistently across the public nav, dashboard nav, and hero;
  Benefits reads as a distinct bordered list instead of a near-clone
  of How-it-works' card grid; the unit field is now a shadcn
  Command+Popover combobox instead of a raw `<datalist>`; and a
  small ledger type-scale (lg/md/sm) replaced ad hoc per-screen
  sizing on the overview stats, product detail, and product rows.
- Bumped `@merqo/ui` to v0.10.1: `AccountMenu`'s `FeedbackSheet`/`HelpSheet`
  submit button is no longer flush against the Sheet's bottom edge (the
  `SheetFooter`'s vertical padding is restored). Also pulls in v0.10.0's
  additive, opt-in `LinkComponent` prop on `DashboardNav`/`AccountMenu`
  (defaults to a plain `<a>`, unused here for now). No code changes beyond
  the dependency bump.

### Fixed

- The dashboard overview's "Needs attention" widget showed only a colored
  dot for each product's low/out status, with no text label — unlike
  `product-row.tsx` elsewhere, which correctly pairs the dot with a
  `STOCK_STATUS_LABEL`. Color-only status fails WCAG 1.4.1 on the
  dashboard's main glance-value widget. Added the matching text label.
- The dashboard onboarding tour re-triggered on every visit to
  `/dashboard` despite #38's "stamp on start, not finish" fix. Root
  cause: that fix's mark-seen write is fire-and-forget from the client
  (`dashboard-tour.tsx`'s `onFirstSeen`), and the tour's own steps
  spotlight real dashboard nav links — which `@merqo/ui`'s `DashboardNav`
  renders as plain `<a>` tags, not `next/link` — so clicking one, as the
  tour invites, triggers a hard page navigation that can abort the write
  before it lands, leaving `tour_seen_at` unset. `src/app/dashboard/
layout.tsx` (which wraps every `/dashboard/*` page) now also stamps
  `tour_seen_at` synchronously during its own server render whenever it's
  unset — a write that lands before the response is even sent, immune to
  any client-side navigation race. `tour-actions.ts`'s `markTourSeen` is
  refactored to share the update (`stampTourSeen`, in the new
  `src/lib/tour-prefs.ts`) with `layout.tsx` instead of duplicating it.

- The dashboard onboarding tour re-ran on every visit for vendors who
  signed up via Google OAuth, never staying dismissed. Root cause: OAuth
  sign-in (`src/app/auth/callback/route.ts`) never created a local
  `vendors` row (only the email/password sign-up flow's `completeSignup`
  did), so `markTourSeen`'s `UPDATE ... WHERE id = ...` matched zero rows
  and silently no-opped every time. The callback route now self-heals by
  upserting a `vendors` row (from the OAuth profile's name, falling back
  to a placeholder) right after a successful session exchange, with
  `ignoreDuplicates` so an existing vendor's row and stall name are never
  overwritten on a later sign-in. This also fixes downstream reads of a
  missing vendor row for these vendors (plan lookups, product creation's
  `vendor_id` foreign key).

### Changed

- Bumped `@merqo/ui` to v0.9.0 and adopted its new `LandingNav` shell for
  the public landing nav. The nav moved from `Navbar`
  (`src/components/layout/navbar.tsx`) to `Nav`
  (`src/components/landing/nav.tsx`), matching every other Merqo kit's
  file/export naming — stockkit's public nav was the only structural
  outlier across the kit family (`z-50` instead of `z-20`,
  `bg-background/80` instead of `/85`, padding on the inner `<nav>`
  instead of the `<header>`); delegating to `LandingNav` fixes all three
  automatically. `DashboardNav`'s header also picked up an internal
  `mx-auto max-w-7xl` wrapper from the same `@merqo/ui` bump, for free.
- Dashboard content width standardized on Tailwind's `max-w-7xl`
  (1280px), matching qkit/loopkit/paykit. Replaced the stockkit-only
  `.max-w-site` utility (`max-w-[1184px]`, now removed from
  `src/app/globals.css`) and consolidated the width/horizontal-padding
  container into `src/app/dashboard/layout.tsx`'s `<main>` — individual
  dashboard pages (`(overview)`, `products`, `plan`) no longer own their
  own width wrapper, only their own vertical padding.
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
