# src/components

Shared React components. `ui/` is shadcn-managed (CLI style — do not
hand-edit); `widgets/` are small app-wide bits (brand mark, theme toggle,
link list); `layout/` is site chrome; `landing/` is the marketing page's
section components; `elevated-card.tsx` is stockkit's own lifted-shadow
card treatment used on the public auth pages.

`section.tsx` — thin adapter over `@merqo/ui`'s `Section` (the
per-field-group shell: icon chip + eyebrow + title + description),
used by the profile page's five sections, per
`docs/business/2026-07-21-profile-settings-page-standard.md` §2.1.
Injects `ElevatedCard` (stockkit's own lifted-shadow card, not qkit's
Ticket motif) via `Section`'s `wrapper` render-prop, fully replacing
the shared default `bg-card`/`border`/`shadow-sm` shell.

`dashboard-tour.tsx` — thin adapter over `@merqo/ui`'s `DashboardTour`:
supplies stockkit's own step content (`tour-steps.ts`'s
`tourSteps(isMobile)`, an ordered list each keyed to a
`data-tour="..."` anchor elsewhere in the dashboard, with a mobile
variant that spotlights the collapsed nav burger instead of the inline
links below Tailwind's `sm` breakpoint), the `markTourSeen` server
action, and routing. The `driver.js` overlay lifecycle (auto-run once
on first login, stamped via `onFirstSeen` as soon as the tour starts
rather than when it finishes so a mid-tour refresh can't re-trigger
it, replay via a floating "?" button, unmount teardown) and the
popover's steel/cobalt theming are both owned by the shared component
— it generates the scoped popover CSS at runtime from this app's own
CSS custom properties, so there's no local `tour.css` to maintain.

`social-icons.tsx` — `SOCIAL_LINK_FIELDS`, the shared website/Instagram/
Facebook/TikTok field list (real brand marks via
`@icons-pack/react-simple-icons`, a generic `Globe` for website).
`social-links-fields.tsx` — the labeled-icon input group built from it,
used by the profile page's social-links section.

`back-button.tsx` — `BackButton`, a shared "leave this page" link (shadcn
`Button asChild variant="ghost"` + `ArrowLeft` icon) for pages that need a
real hit-target/hover-focus affordance instead of a plain underlined text
link, ported from qkit's component of the same name. Currently used by the
profile page.

The dashboard's account menu, Feedback/Get-help sheets, and avatar
uploader are no longer local components here — they're composed
directly from `@merqo/ui` in `src/app/dashboard/dashboard-nav.tsx` and
`src/app/dashboard/profile/profile-form.tsx` respectively. See those
files' own doc comments for the adapter wiring.
