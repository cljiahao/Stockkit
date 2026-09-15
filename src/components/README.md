# src/components

Shared React components. `ui/` is shadcn-managed (CLI style — do not
hand-edit); `widgets/` are small app-wide bits (brand mark, theme toggle,
link list); `layout/` is site chrome; `landing/` is the marketing page's
section components.

`section.tsx` — thin adapter over `@merqo/ui`'s `Section` (the
per-field-group shell: icon chip + eyebrow + title + description),
used by the profile page's five sections, per
`docs/business/2026-07-21-profile-settings-page-standard.md` §2.1.
Injects `@merqo/ui`'s own `ElevatedCard` (2026-09-16 — was a stockkit-local
copy, promoted after being found byte-identical to qkit's/paykit's own;
still not qkit's Ticket motif) via `Section`'s `wrapper` render-prop, fully
replacing the shared default `bg-card`/`border`/`shadow-sm` shell.
`ElevatedCard` is also used directly (not via `Section`) on the public auth
pages, `/admin`, `/error`, and `/not-found`.

`dashboard-tour.tsx` — thin adapter over `@merqo/ui`'s `DashboardTour`:
supplies stockkit's own step content (`tour-steps.ts`'s
`tourSteps(isMobile)`, an ordered list each keyed to a
`data-tour="..."` anchor elsewhere in the dashboard, with a mobile
variant that spotlights the collapsed nav burger instead of the inline
links below Tailwind's `sm` breakpoint), the `markTourSeen` server
action, and routing. The first step's description embeds a
`.tour-example` HTML snippet (styled in `src/app/globals.css`, rendered
via driver.js's own `innerHTML` popover) showing an example product row —
its stock-status indicator is the real `stock-status-indicator.tsx`,
rendered via `react-dom/server`'s `renderToStaticMarkup`, not a hand-copied
color; see
`../../../docs/superpowers/specs/2026-08-25-tour-example-badge-drift-fix-design.md`
(workspace root, cross-kit, outside this repo's own git tree). The
Products step's copy explains what actually distinguishes a Restock,
Waste, and Adjustment log entry (always adds, always subtracts, or
picks either direction), not just the three reason names. The `driver.js` overlay lifecycle (auto-run once
on first login, stamped via `onFirstSeen` as soon as the tour starts
rather than when it finishes so a mid-tour refresh can't re-trigger
it, replay via a floating "?" button, unmount teardown) and the
popover's Reefer Frost theming are both owned by the shared component
— it generates the scoped popover CSS at runtime from this app's own
CSS custom properties, so there's no local `tour.css` to maintain.

`stock-status-indicator.tsx` — `StockStatusIndicator({status, textClassName?})`:
the dot + label pair for a product's stock status, shared by `product-row.tsx`,
`product-detail.tsx`, and the overview page's low/out-of-stock list —
previously duplicated inline in all three.

`SOCIAL_LINK_FIELDS` (website/Instagram/Facebook/TikTok, real brand marks
via `@icons-pack/react-simple-icons`, a generic `Globe` for website) and its
`SocialLinksFields` input group are no longer local — since 2026-09-16
both come from `@merqo/ui`, promoted after being found duplicated across
every kit. Used by the profile page's social-links section.

`BackButton` is likewise no longer local — since 2026-09-16 it comes from
`@merqo/ui` (a shared "leave this page" link: shadcn `Button asChild
variant="ghost"` + `ArrowLeft` icon). Used by the plan and profile pages,
each passing `LinkComponent={Link}` so the shared component's default plain
`<a>` doesn't downgrade the client-side transition `next/link` gave it
before.

The dashboard's account menu, Feedback/Get-help sheets, and avatar
uploader are no longer local components here — they're composed
directly from `@merqo/ui` in `src/app/dashboard/dashboard-nav.tsx` and
`src/app/dashboard/profile/profile-form.tsx` respectively. See those
files' own doc comments for the adapter wiring.
