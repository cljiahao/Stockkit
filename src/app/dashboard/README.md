# src/app/dashboard

The authenticated vendor dashboard (guarded by `src/proxy.ts`). `layout.tsx`
resolves the session + stall name (via `@/lib/vendor-name`'s
`resolveVendorName` — the shared `merqo.vendor_profile.stall_name`, same
source of truth `profile/page.tsx` reads, not the local `vendors.name`
column) + avatar URL (read defensively off `user.user_metadata`) and
renders `dashboard-nav.tsx`, a thin adapter over `@merqo/ui`'s composed
`DashboardNav`+`AccountMenu`: burger far-left below `sm` opening the same
Overview/Products links shown inline at `sm`+, avatar/account dropdown
far-right at every width, per
`docs/business/2026-07-21-dashboard-nav-standard.md` — the account
dropdown's avatar renders the vendor's uploaded profile icon when set,
falling back to initials otherwise. The shared component renders its own
sticky `<header>`, full-bleed edge-to-edge (`px-5 py-3.5` on the `<header>`
itself, with an internal `mx-auto max-w-7xl` wrapper as of `@merqo/ui`
v0.9.0 so the nav's content lines up with the page content below it), so
`layout.tsx` wraps it in a `display: contents` `<div>`, not a
box-generating element — a second wrapping `<header>` there would nest two
headers and break the inner one's `position: sticky` (no room in its
containing block to shift); see the regression test in
`layout.test.tsx`/`dashboard-nav.dom.test.tsx` guarding this. Feedback and
Get-help are `AccountMenu`'s built-in `FeedbackSheet`/`HelpSheet`, wired to
`submitFeedbackAction`/`submitSupportMessageAction` via throw-adapters (the
shared `onSubmit` contract expects a rejected promise on failure; these
actions return `{success, error}`) — there's no local
`feedback-form.tsx`/`support-form.tsx` anymore. `(overview)/` is the
stock-value/low/out-of-stock stats page; `products/` is the products
workspace; `profile/` is the account-settings page; `plan/` is the
Free/Pro plan page (own README).

`layout.tsx`'s `<main>` is the single width container for every dashboard
page: `mx-auto w-full max-w-7xl px-6`, matching qkit/loopkit/paykit's
canonical dashboard width (Tailwind's built-in `max-w-7xl`, 1280px).
Individual pages under it only ever add their own vertical padding
(`py-8`/`py-12`) — none of them own a width/horizontal-padding wrapper
anymore. This replaces the old `.max-w-site` utility (`max-w-[1184px]`,
a stockkit-only third width value vs. the other kits), which has been
removed from `src/app/globals.css` now that nothing references it.

`profile-form.tsx`'s stall-name and avatar saves call `router.refresh()`
on success — both are displayed by `dashboard-nav.tsx`, which is rendered
once by the persistent layout, so without an explicit refresh it would
keep showing stale data until a hard reload even though the underlying
write succeeded.

`loading.tsx` — a centered spinner shown while this segment (and every
nested page below it — overview, products, profile, all `revalidate = 0`)
is loading, matching qkit's `dashboard/loading.tsx` pattern. Its test is
`loading.dom.test.tsx` — the `.dom.test.tsx` suffix for full RTL+jsdom
component-render tests, per this project's own convention.

`dashboard-nav.tsx`'s wordmark uses the shared `BrandText` gradient
treatment (`@/components/widgets`) instead of a hand-rolled two-span
split, matching the public nav and hero.

`dashboard-nav.tsx`'s `signOutAction` throws on a returned Supabase error
(`AccountMenu`'s sign-out contract shows the thrown message inline in the
dropdown, not a toast) and otherwise pushes to `/login` + refreshes +
awaits `navigatingAway()`.

`loading.dom.test.tsx` relies on `test/setup.ts`'s global RTL `cleanup()`
instead of a per-file `afterEach` (`dashboard-nav.dom.test.tsx` still
declares one, for its sign-out/feedback/support action mock resets).

`layout.test.tsx` — logic-only (`.test.tsx`, no DOM render): calls
`DashboardLayout` directly and inspects the returned element tree,
asserting `resolveVendorName`'s result — not the local `vendors.name`
read — reaches `DashboardNav`'s `vendorName` prop, plus the `DashboardTour`
`seen` prop and the durable tour-seen stamp described below (stamps when
`tour_seen_at` is null/missing, doesn't re-stamp once it's already set).

`layout.tsx` also reads `vendors.tour_seen_at` and renders
`@/components/dashboard-tour`'s `DashboardTour` (own README), passing
`seen={!!vendor?.tour_seen_at}`. Since this layout wraps every
`/dashboard/*` page, it also calls `@/lib/tour-prefs`'s `stampTourSeen`
directly, synchronously, as part of this request whenever `tour_seen_at`
is unset — the durable half of the onboarding-tour "stamp on start" fix
(#38). `tour-actions.ts` — `markTourSeen()`, a `'use server'` action
wiring the same `stampTourSeen` to `dashboard-tour.tsx`'s client-fired
`onFirstSeen`. That client path is fire-and-forget and can be aborted by a
hard navigation before it lands — `@merqo/ui`'s `DashboardNav` renders nav
links as plain `<a>` tags, and the tour's own steps spotlight real
dashboard nav links, inviting exactly that click mid-tour — so
`layout.tsx`'s own synchronous call (which imports `stampTourSeen`
straight from `@/lib/tour-prefs`, not through this Server Action, to avoid
crossing a client/server serialization boundary) is what actually makes
the "stamp on start" fix durable. `tour-actions.test.ts` — unit tests for
`markTourSeen`'s update payload, its no-op when signed out, and its
log-not-throw on failure.
