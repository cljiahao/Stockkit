# stockkit — profile page: bring up to the cross-kit profile-settings standard

Date: 2026-07-23

## Problem

`docs/business/2026-07-21-profile-settings-page-standard.md` (locked, applies
to every kit) requires the account-settings page to cover three
"personal-account" fields — display name, profile icon, password — in
addition to the shared stall name/social links. stockkit's current
`/dashboard/profile` only has stall name and social links: no display name,
no avatar upload, no way to change password from this page. The data-flow
half of the standard (§3: shared `merqo.vendor_profile` via RPC, overlay
read pattern) is already correctly implemented — this gap is entirely on
the UI/personal-account side (§1, §2).

Reference implementation: qkit's `src/app/dashboard/profile/` (`page.tsx`,
`profile-form.tsx`, `src/components/ticket-section.tsx`,
`src/components/image-uploader.tsx`, `src/lib/image-resize.ts`), read in
full during this design pass.

Out of scope: no changes to `actions.ts` (stall name/social links already
correctly go through the shared RPC — see spec §3.1, untouched here), no
changes to the shared `merqo.vendor_profile` schema/RPCs, no banner-style
image upload (stockkit has no booth/product-photo use case — avatar only),
no `InfoTooltip` component (qkit's own profile page doesn't use the
`tooltip` prop either — nothing on this page needs it; build it the first
time something actually does, per the standard's own YAGNI note in §2.2).

## Design

### File structure

```
dashboard/profile/
  page.tsx            — add email/displayName/avatarUrl from the auth user
  profile-form.tsx     — expand from 2 sections to 5, wrapped in Section
  actions.ts           — unchanged
  README.md            — updated
src/components/
  section.tsx          — new: icon chip + eyebrow + title + description
                          shell, wraps ElevatedCard (stockkit's Ticket
                          equivalent)
  image-uploader.tsx    — new: avatar-only (thumb variant only)
src/lib/
  image-resize.ts       — new: resizeToWebp(), ported from qkit
supabase/migrations/
  000X_vendor_avatars_bucket.sql — new
```

### Storage

A new public-read Supabase Storage bucket, `vendor-avatars`, RLS-scoped so a
vendor may only write under their own `{auth.uid()}/...` path — same shape
as qkit's `booth-images` migration:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vendor-avatars', 'vendor-avatars', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "vendor_avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-avatars');

CREATE POLICY "vendor_avatars_vendor_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "vendor_avatars_vendor_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vendor-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "vendor_avatars_vendor_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vendor-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

Unlike qkit (which shipped its bucket unconstrained and hardened it in a
later migration, `0037_booth_images_bucket_limits.sql`), the size limit and
MIME allow-list are baked into the bucket from this first migration — no
reason to repeat that two-step history here.

### `next.config.ts`

Uncomment/fill the `images.remotePatterns` placeholder for `*.supabase.co`
so `next/image` accepts the avatar URLs the bucket serves.

### Schemas (`src/lib/schemas.ts`)

Add:

```ts
export const displayNameSchema = z.object({
  displayName: z.string().trim().max(60, 'Display name is too long'),
});
export type DisplayNameInput = z.infer<typeof displayNameSchema>;
```

`passwordChangeSchema` already exists (used by `/reset-password`) — reused
as-is, no changes.

### Data flow

No changes to the shared/kit-local split already established:

| Field | Where | Written via |
|---|---|---|
| Stall name, social links | shared `merqo.vendor_profile` | `actions.ts` server actions (unchanged) |
| Display name, avatar URL, password | `auth.users` (kit-local) | client-side `supabase.auth.updateUser(...)`, directly from `profile-form.tsx` |

### UI layout

`Section` component (new, `src/components/section.tsx`):

```tsx
export function Section({
  icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <ElevatedCard as="section" className="px-6 py-6">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          {eyebrow && (
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <h2 className="font-display text-xl font-semibold leading-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </ElevatedCard>
  );
}
```

(Exact shape depends on `ElevatedCard`'s existing prop surface — confirmed
during implementation; falls back to a plain wrapping `<section>` +
`ElevatedCard`'s existing className pattern if `as` isn't supported.)

Two independent flex-column stacks — never `md:grid` (spec §2.3's
documented failure mode: a CSS grid's row height tracks the tallest cell in
that row, so once one section outgrows its row-mate, every row after it
starts late in both columns):

```tsx
<div className="flex flex-col gap-5 md:flex-row md:items-start">
  <div className="flex flex-1 flex-col gap-5">{/* column 1 */}</div>
  <div className="flex flex-1 flex-col gap-5">{/* column 2 */}</div>
</div>
```

Column order (spec §2.4, exact):

- **Column 1:** stall name → profile icon (`ImageUploader`) → change
  password (email shown read-only above the password fields)
- **Column 2:** display name → social links

Icons (lucide-react, already a dependency): `Store` (stall name),
`UserRound` (profile icon), `KeyRound` (password), `IdCard` (display name),
`Share2` (social links) — same as qkit's, generically appropriate.

Each section keeps its own independent save button, `pending` state
(`useAsyncAction`), inline validation error, and success toast (spec
§2.5) — already the pattern stockkit's existing two sections follow;
extended to all five.

### Testing

Extend `profile-form.dom.test.tsx`:

- display name: saves independently, rejects >60 chars client-side without
  calling `supabase.auth.updateUser`
- password: saves on match, rejects on mismatch/too-short client-side,
  clears both fields on success
- avatar: upload calls `supabase.storage.from('vendor-avatars').upload(...)`
  then `supabase.auth.updateUser({ data: { avatar_url } })`; remove calls
  `updateUser({ data: { avatar_url: null } })`

`supabase.auth.updateUser` and `supabase.storage` mocked via the existing
`createClient` mock pattern. Needed to clear the `diff-cover` ≥80%
changed-line coverage CI gate on all new code.

## Self-review

- Placeholder scan: none — every section has concrete code/SQL, not
  descriptions of code.
- Internal consistency: data-flow table matches the file-structure section;
  column order matches the icon list order.
- Scope: single page + its direct dependencies (bucket, 2 new small
  components, 1 new lib file, 1 schema addition). Not decomposed further —
  the pieces are tightly coupled to this one page's requirements.
- Ambiguity: `Section`'s exact prop surface depends on `ElevatedCard`'s
  current API, not fully known until implementation reads that file —
  flagged inline above as the one point the plan needs to confirm against
  the actual file rather than assume.
