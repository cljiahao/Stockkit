# dashboard/profile

## Purpose

Vendor account profile page — stall/shop name, social links, profile icon,
display name, and sign-in password, each saved independently through the
channel that owns that data (shared `merqo.vendor_profile` for stall
name/social links vs. the Supabase auth user for icon/display
name/password), per
`docs/business/2026-07-21-profile-settings-page-standard.md`.

## Contents

- `actions.ts` — `updateStallName(input)` and `updateSocialLinks(input)`
  server actions; both go through the shared `merqo.vendor_profile` RPC
  wrappers in `@/lib/merqo-vendor-profile`. Display name, avatar, and
  password are explicitly **not** handled here — they live on the auth
  user and are set client-side via `supabase.auth.updateUser`.
- `page.tsx` — `ProfilePage()` (server, `revalidate = 0`): auth guard,
  overlays the shared vendor profile onto the local `vendors` row (§3.3 of
  the standard), reads `display_name`/`avatar_url` defensively off
  `user.user_metadata`, and renders `ProfileForm`.
- `profile-form.tsx` — `ProfileForm({ vendorId, stallName, socialLinks,
displayName, email, avatarUrl })`, client component, five independently
  saved `Section`s in two independent `flex flex-col` stacks (never a CSS
  grid — see the standard's §2.3). Column 1: stall name, profile icon
  (`ImageUploader`), change password. Column 2: display name, social links
  (`@/components/social-links-fields.tsx` — real brand icons per field,
  not plain unlabeled inputs). Column order and layout mechanism match the
  standard exactly. The stall-name and avatar saves call `router.refresh()`
  on success so `dashboard-nav.tsx` — which renders both, once, in the
  persistent dashboard layout — picks up the change immediately instead of
  showing stale data until a hard reload.

## Connectivity

Reachable from `dashboard-nav.tsx`'s account menu ("Profile" item).
`page.tsx` calls `createServerClient()` + `getOrCreateVendorProfile`,
renders `profile-form.tsx`, which calls `actions.ts`'s
`updateStallName`/`updateSocialLinks` for stall name/social links and the
browser Supabase client (`@/lib/supabase/client`) directly for
avatar/display-name/password, all validated against schemas in
`@/lib/schemas`. Avatar uploads go through `@/components/image-uploader.tsx`
to the `vendor-avatars` Storage bucket (`supabase/migrations/0006_vendor_avatars_bucket.sql`).

## Parent

[dashboard](../README.md)
