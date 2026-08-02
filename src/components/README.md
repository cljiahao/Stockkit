# src/components

Shared React components. `ui/` is shadcn-managed (CLI style — do not
hand-edit); `widgets/` are small app-wide bits (brand mark, theme toggle,
link list); `layout/` is site chrome; `landing/` is the marketing page's
section components; `elevated-card.tsx` is stockkit's own lifted-shadow
card treatment used on the public auth pages.
`section.tsx` — the per-field-group shell (icon chip + eyebrow + title +
description, wraps `ElevatedCard`) used by the profile page's five
sections, per
`docs/business/2026-07-21-profile-settings-page-standard.md` §2.1.
`image-uploader.tsx` — the profile page's avatar uploader: validates
type/size client-side, resizes via `@/lib/image-resize`'s `resizeToWebp`,
uploads to the `vendor-avatars` Storage bucket under the vendor's own
`{vendorId}/...` path, and reports the resulting public URL back to the
caller.
`feedback-form.tsx`/`support-form.tsx` — vendor NPS and categorized
Get-help widgets, Sheet-mounted off the account menu; both use shadcn
`ToggleGroup`/`Textarea` for their score/category pickers and message
body, matching qkit's equivalent components. Both wrap their server
action call in `try/catch` — a thrown rejection still shows a generic
toast instead of failing silently.
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

`feedback-form.dom.test.tsx`, `support-form.dom.test.tsx`, and
`image-uploader.dom.test.tsx` rely on `test/setup.ts`'s global RTL
`cleanup()` instead of declaring their own per-file `afterEach`.

`dashboard-tour.tsx` — `DashboardTour`, the dashboard's onboarding tour
(ported from qkit): a `driver.js` overlay that auto-runs once on first
login (`seen` prop, from `vendors.tour_seen_at`, stamped via
`markTourSeen` as soon as the tour starts rather than when it finishes,
so a mid-tour refresh can't re-trigger it) and is replayable via a
floating "?" button. `tour-steps.ts` — `tourSteps(isMobile)`, the ordered
step list (each keyed to a `data-tour="..."` anchor elsewhere in the
dashboard), with a mobile variant that spotlights the collapsed nav
burger instead of the inline links below Tailwind's `sm` breakpoint.
`tour.css` — scoped overrides for driver.js's popover to match the app's
theme. `driver.js` (+ its CSS) is dynamically imported inside
`dashboard-tour.tsx`, not statically, so it never ships in the base
dashboard bundle for vendors who never trigger the tour.
