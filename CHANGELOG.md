# Changelog

## Unreleased

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
