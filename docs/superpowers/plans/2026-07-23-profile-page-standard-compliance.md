# Profile Page Standard Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/dashboard/profile` up to
`docs/business/2026-07-21-profile-settings-page-standard.md`: add display
name, avatar upload, and password change — none of which exist on the
current page (stall name + social links only).

**Architecture:** Two new small components (`Section`, `ImageUploader`), one
new lib file (`image-resize.ts`), one new Zod schema (`displayNameSchema`),
one new Supabase Storage bucket + RLS migration, and a rewrite of
`profile-form.tsx`/`page.tsx` to five independently-saved sections in two
flex-column stacks. `actions.ts` is untouched — display name/avatar/password
write directly to the Supabase auth user from the client
(`supabase.auth.updateUser`), never through a server action, per the
standard's §3.1 data-flow split.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind v4,
Supabase (`@supabase/ssr`, Storage), Zod, Vitest + Testing Library, lucide-react.

## Global Constraints

- Data-flow split (locked, do not deviate): stall name + social links stay
  on the existing shared `merqo.vendor_profile` write path
  (`actions.ts` → `@/lib/merqo-vendor-profile`). Display name, avatar URL,
  password are **kit-local**, written directly via
  `supabase.auth.updateUser(...)` from the client component — no server
  action for any of the three.
- Layout: two independent `flex flex-col gap-5` stacks side by side on
  `md:flex-row` — **never** `md:grid`/`md:grid-cols-2` (a CSS grid's row
  height tracks the tallest cell in that row, so the row with the biggest
  section pushes every subsequent row late in both columns).
- Column order (exact, per spec §2.4): **Column 1** — stall name → profile
  icon → change password. **Column 2** — display name → social links.
- Each section has its own save button, its own `useAsyncAction` pending
  state, its own inline validation error, its own success toast — never one
  page-level "Save" button.
- Every Zod-validated field validates client-side (`schema.safeParse`)
  before any network call fires.
- `font-mono` is reserved for quantity/cost figures elsewhere in the app —
  none of this page's fields are numeric ledger figures, so it doesn't apply
  here.
- No `InfoTooltip` component — nothing on this page needs one (qkit's own
  profile page doesn't use its `tooltip` prop either).
- TypeScript strict, no `any`, no `@ts-ignore`.
- `readme-freshness` CI gate: every folder that gets a changed file in a
  task's diff needs its `README.md` touched **in that same task** — exact
  dirname of the changed file, not its parent. `CHANGELOG.md` and
  `package.json`/`pnpm-lock.yaml`-style root-level file changes count as
  dirname `.`, so root `README.md` needs touching too whenever one of those
  changes.
- Run `pnpm format` (prettier + `prettier-plugin-organize-imports`) at the
  end of every task before committing — import ordering is
  plugin-enforced, don't hand-order imports.

---

### Task 1: Avatar storage bucket + `next.config.ts` image domain

**Files:**
- Create: `supabase/migrations/0005_vendor_avatars_bucket.sql`
- Modify: `next.config.ts`
- Modify: `supabase/migrations/README.md`

**Interfaces:**
- Produces: a public-read Storage bucket named `vendor-avatars`, 5MB limit,
  JPEG/PNG/WebP only, RLS-scoped so an authenticated vendor may only
  insert/update/delete objects under their own `{auth.uid()}/...` path.
  Task 5's `ImageUploader` uploads to this bucket by name.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0005_vendor_avatars_bucket.sql
-- Public-read bucket for vendor profile-icon uploads (the /dashboard/profile
-- "profile icon" section — docs/business/2026-07-21-profile-settings-page-standard.md).
-- Size/MIME limits are baked in from the start here, unlike qkit's
-- booth-images bucket, which shipped unconstrained and was hardened in a
-- later migration (0037_booth_images_bucket_limits.sql) — no reason to
-- repeat that two-step history.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vendor-avatars', 'vendor-avatars', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Anyone may read avatars (they render in the account-menu avatar, which
-- has no auth gate on the image request itself).
CREATE POLICY "vendor_avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-avatars');

-- A vendor may write only under their own "{auth.uid()}/..." path.
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

- [ ] **Step 2: Update `next.config.ts`'s image config**

Replace the commented-out placeholder:

```ts
  // Uncomment and add domains when using next/image with external URLs:
  // images: {
  //   remotePatterns: [{ protocol: 'https', hostname: 'example.com' }],
  // },
```

with:

```ts
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
```

- [ ] **Step 3: Update `supabase/migrations/README.md`**

Change the `## Contents` intro line `4 files, \`0000\` through \`0003\`.` to
`6 files, \`0000\` through \`0005\`.` and append two new bullets after the
existing `0003` bullet (also backfilling the previously-undocumented
`0004`, which exists in the repo but was never added to this list):

```markdown
- **`0004_feedback.sql`** adds `stockkit.feedback` (vendor NPS score +
  optional free-text message, submitted via `FeedbackForm`). RLS: a vendor
  may insert only their own row (`vendor_id = auth.uid()`); no select/update/
  delete policy for anyone.
- **`0005_vendor_avatars_bucket.sql`** creates the public-read
  `vendor-avatars` Storage bucket (5MB limit, JPEG/PNG/WebP only) for the
  profile page's avatar upload, with RLS on `storage.objects` scoped to each
  vendor's own `{auth.uid()}/...` path for insert/update/delete.
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm typecheck` (checks `next.config.ts` compiles)
Expected: no errors.

```bash
git add supabase/migrations/0005_vendor_avatars_bucket.sql next.config.ts supabase/migrations/README.md
git commit -m "feat: add vendor-avatars storage bucket for profile icon uploads"
```

---

### Task 2: `displayNameSchema`

**Files:**
- Modify: `src/lib/schemas.ts`
- Test: `src/lib/schemas.test.ts`

**Interfaces:**
- Produces: `displayNameSchema: ZodObject<{ displayName: ZodString }>` and
  `DisplayNameInput` type, both exported from `@/lib/schemas`. Task 6's
  `profile-form.tsx` imports and uses both.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { displayNameSchema, passwordChangeSchema } from './schemas';

describe('displayNameSchema', () => {
  it('accepts a short display name', () => {
    const result = displayNameSchema.safeParse({ displayName: 'Aisha' });
    expect(result.success).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    const result = displayNameSchema.safeParse({ displayName: '  Aisha  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe('Aisha');
    }
  });

  it('accepts an empty string (clearing the display name)', () => {
    const result = displayNameSchema.safeParse({ displayName: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a display name longer than 60 characters', () => {
    const result = displayNameSchema.safeParse({ displayName: 'a'.repeat(61) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Display name is too long');
    }
  });
});
```

(This replaces the existing `import { passwordChangeSchema } from './schemas';`
line at the top of the file with the combined import shown above — keep the
existing `describe('passwordChangeSchema', ...)` block below it unchanged.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/schemas.test.ts`
Expected: FAIL — `displayNameSchema` is not exported from `./schemas`.

- [ ] **Step 3: Add the schema**

In `src/lib/schemas.ts`, add directly below the existing
`passwordChangeSchema`/`PasswordChangeInput` block:

```ts
export const displayNameSchema = z.object({
  displayName: z.string().trim().max(60, 'Display name is too long'),
});
export type DisplayNameInput = z.infer<typeof displayNameSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/schemas.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts src/lib/schemas.test.ts
git commit -m "feat: add displayNameSchema"
```

---

### Task 3: `resizeToWebp` (client-side image resize)

**Files:**
- Create: `src/lib/image-resize.ts`
- Test: `src/lib/image-resize.test.ts`
- Modify: `src/lib/README.md`

**Interfaces:**
- Produces: `resizeToWebp(file: File, maxDim: number, quality?: number): Promise<{ blob: Blob; ext: string; type: string }>`, exported from `@/lib/image-resize`. Task 5's `ImageUploader` calls this before uploading.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/image-resize.test.ts
// @vitest-environment jsdom
//
// jsdom has no real Canvas/ImageBitmap backend, so createImageBitmap and
// canvas.getContext('2d') both fail here — every call in this test
// environment exercises resizeToWebp's fallback branch (return the original
// file untouched), not the actual resize/encode path. That's still real
// coverage of the function's control flow (decode failure -> catch ->
// extension parsing), just not the pixel-manipulation happy path, which
// needs a real browser and isn't unit-testable in jsdom.
import { describe, expect, it } from 'vitest';

import { resizeToWebp } from './image-resize';

describe('resizeToWebp', () => {
  it('falls back to the original file when the browser cannot decode/encode it', async () => {
    const file = new File(['fake-image-bytes'], 'photo.PNG', { type: 'image/png' });
    const result = await resizeToWebp(file, 1000);
    expect(result.blob).toBe(file);
    expect(result.ext).toBe('png');
    expect(result.type).toBe('image/png');
  });

  it('defaults to a jpg extension when the filename has none', async () => {
    const file = new File(['x'], 'photo', { type: '' });
    const result = await resizeToWebp(file, 1000);
    expect(result.ext).toBe('jpg');
    expect(result.type).toBe('application/octet-stream');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/image-resize.test.ts`
Expected: FAIL — cannot find module `./image-resize`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/image-resize.ts
// Client-side resize + WebP encode before upload. Scaling a phone photo down
// to a sane max dimension is the biggest size win (a 4000px photo -> 1000px
// drops the vast majority of the pixels before compression), and WebP is
// ~25-35% smaller than JPEG at the same quality. Browser-only (Canvas) —
// call from client components only.

export type ResizeResult = { blob: Blob; ext: string; type: string };

async function decode(file: File): Promise<ImageBitmap> {
  // `from-image` applies EXIF orientation so portrait phone photos aren't sideways.
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

/**
 * Resize `file` so its longest side is <= maxDim and re-encode as WebP.
 * Returns the original file (as-is) if the browser can't decode/encode it,
 * so upload never hard-fails on an exotic image or an unsupported browser.
 */
export async function resizeToWebp(
  file: File,
  maxDim: number,
  quality = 0.82
): Promise<ResizeResult> {
  try {
    const bitmap = await decode(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality)
    );
    if (!blob) throw new Error('encode failed');
    return { blob, ext: 'webp', type: 'image/webp' };
  } catch {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    return { blob: file, ext, type: file.type || 'application/octet-stream' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/image-resize.test.ts`
Expected: PASS, both tests green.

- [ ] **Step 5: Update `src/lib/README.md`**

Append a new paragraph:

```markdown

`image-resize.ts` — `resizeToWebp(file, maxDim, quality?)`, browser-only
(Canvas + `createImageBitmap`): resizes an uploaded image so its longest
side is `<= maxDim` and re-encodes it as WebP, falling back to the original
file untouched if the browser can't decode/encode it. Used by
`src/components/image-uploader.tsx` before every avatar upload.
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/image-resize.ts src/lib/image-resize.test.ts src/lib/README.md
git commit -m "feat: add resizeToWebp for client-side avatar image resizing"
```

---

### Task 4: `Section` component

**Files:**
- Create: `src/components/section.tsx`
- Modify: `src/components/README.md`

**Interfaces:**
- Consumes: `ElevatedCard` from `@/components/elevated-card` — accepts
  `as?: 'div' | 'section'`, `className?: string`, `children`, and spreads
  any other `HTMLAttributes<HTMLElement>` prop through.
- Produces: `Section({ icon, eyebrow?, title, description, children })`,
  exported from `@/components/section`. Task 6's `profile-form.tsx` wraps
  each of its five field groups in this.

- [ ] **Step 1: Write the component**

No test file for this task — `Section` is a pure layout wrapper with no
conditional logic beyond an `eyebrow &&` guard; it's exercised indirectly
by Task 6's `profile-form.dom.test.tsx` once it's actually used to render
real content.

```tsx
// src/components/section.tsx
import type { ReactNode } from 'react';

import { ElevatedCard } from '@/components/elevated-card';

interface SectionProps {
  icon: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
}

// The per-field-group shell every profile-settings-page section uses, per
// docs/business/2026-07-21-profile-settings-page-standard.md §2.1: an icon
// chip, an eyebrow ("who sees this"), a title, a one-line description, and
// the field(s) themselves.
export function Section({ icon, eyebrow, title, description, children }: SectionProps) {
  return (
    <ElevatedCard as="section" className="px-6 py-6">
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-lg">
          {icon}
        </span>
        <div>
          {eyebrow && (
            <p className="text-muted-foreground text-[0.7rem] font-semibold tracking-[0.16em] uppercase">
              {eyebrow}
            </p>
          )}
          <h2 className="font-display text-xl font-semibold leading-tight">{title}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </ElevatedCard>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Update `src/components/README.md`**

Append to the existing paragraph (after the `elevated-card.tsx` sentence):

```markdown
`section.tsx` — the per-field-group shell (icon chip + eyebrow + title +
description, wraps `ElevatedCard`) used by the profile page's five
sections, per
`docs/business/2026-07-21-profile-settings-page-standard.md` §2.1.
```

- [ ] **Step 4: Commit**

```bash
git add src/components/section.tsx src/components/README.md
git commit -m "feat: add Section component for profile-page field groups"
```

---

### Task 5: `ImageUploader` (avatar-only)

**Files:**
- Create: `src/components/image-uploader.tsx`
- Modify: `src/components/README.md`

**Interfaces:**
- Consumes: `resizeToWebp` from `@/lib/image-resize` (Task 3);
  `createClient` from `@/lib/supabase/client`.
- Produces:
  `ImageUploader({ vendorId, value, onChange }: { vendorId: string; value: string | null; onChange: (url: string | null) => void })`,
  exported from `@/components/image-uploader`. Task 6's `profile-form.tsx`
  renders this in the "Profile icon" section.

- [ ] **Step 1: Write the component**

No standalone test — this is a browser-only file-input component (real
`<input type="file">` interaction, actual `fetch`-based Supabase Storage
upload); it's covered indirectly by Task 6's `profile-form.dom.test.tsx`,
which mocks `supabase.storage` and asserts the upload call happens on file
selection.

```tsx
// src/components/image-uploader.tsx
'use client';

import { ImagePlus, Loader2, X } from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { resizeToWebp } from '@/lib/image-resize';
import { createClient } from '@/lib/supabase/client';

// SVG is intentionally excluded — an avatar is always a real photo/raster upload.
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
// Generous source cap — resized + re-encoded to WebP before upload, so this
// only blocks absurd files, not ordinary phone photos.
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_DIM = 1000;

interface Props {
  vendorId: string;
  value: string | null;
  onChange: (url: string | null) => void;
}

// Square avatar-only uploader for the profile page's "Profile icon" section
// (docs/business/2026-07-21-profile-settings-page-standard.md §2.4) — no
// banner variant, stockkit has no booth/product-photo use case.
export function ImageUploader({ vendorId, value, onChange }: Props) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Use a JPEG, PNG, or WebP image');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image must be 15 MB or smaller');
      return;
    }

    setUploading(true);
    const { blob, ext, type } = await resizeToWebp(file, MAX_DIM);
    const path = `${vendorId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from('vendor-avatars')
      .upload(path, blob, { upsert: false, contentType: type });

    if (error) {
      toast.error('Upload failed');
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('vendor-avatars').getPublicUrl(path);
    onChange(publicUrl);
    setUploading(false);
  }

  if (value) {
    return (
      <div className="border-border relative size-20 shrink-0 overflow-hidden rounded-xl border">
        <Image src={value} alt="" fill sizes="5rem" className="object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="bg-background/90 text-foreground hover:bg-background absolute top-1.5 right-1.5 inline-flex size-7 items-center justify-center rounded-full shadow-sm backdrop-blur"
          aria-label="Remove image"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      className="border-border bg-muted/40 text-muted-foreground hover:border-primary/50 hover:text-foreground flex size-20 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed transition-colors disabled:opacity-60"
    >
      {uploading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ImagePlus className="size-4" />
      )}
      <span className="text-[10px] leading-tight font-medium">
        {uploading ? '…' : 'Add photo'}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </button>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Update `src/components/README.md`**

Append directly after the `section.tsx` sentence added in Task 4:

```markdown
`image-uploader.tsx` — the profile page's avatar uploader: validates
type/size client-side, resizes via `@/lib/image-resize`'s `resizeToWebp`,
uploads to the `vendor-avatars` Storage bucket under the vendor's own
`{vendorId}/...` path, and reports the resulting public URL back to the
caller.
```

- [ ] **Step 4: Commit**

```bash
git add src/components/image-uploader.tsx src/components/README.md
git commit -m "feat: add avatar ImageUploader component"
```

---

### Task 6: Wire up `profile-form.tsx` + `page.tsx` — the full five-section page

**Files:**
- Modify: `src/app/dashboard/profile/page.tsx`
- Modify: `src/app/dashboard/profile/profile-form.tsx`
- Modify: `src/app/dashboard/profile/profile-form.dom.test.tsx`
- Create: `src/app/dashboard/profile/README.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md` (root)

**Interfaces:**
- Consumes: `displayNameSchema`/`DisplayNameInput`,
  `passwordChangeSchema`/`PasswordChangeInput` (Task 2, `passwordChangeSchema`
  already existed), `Section` (Task 4), `ImageUploader` (Task 5),
  `useAsyncAction` (`@/hooks`, existing), `createClient` (`@/lib/supabase/client`,
  existing), `FORM_LABEL_CLASS`/`FORM_ERROR_CLASS` (`@/lib/utils`, existing).
- Produces: the complete `/dashboard/profile` page — no other task depends
  on this one's output.

- [ ] **Step 1: Update `page.tsx`**

```tsx
// src/app/dashboard/profile/page.tsx
import { getOrCreateVendorProfile } from '@/lib/merqo-vendor-profile';
import { createServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ProfileForm } from './profile-form';

export const revalidate = 0;

export default async function ProfilePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Defense in depth — proxy.ts already redirects unauthenticated requests
  // to /login before this page renders.
  if (!user) redirect('/login');

  // Local stall-name column stays as a signup-time default only — the shared
  // merqo.vendor_profile row (fetched below) is the source of truth once it
  // exists. This overlays the shared value on top of it rather than a second
  // fetch, per the profile settings standard's §3.3.
  const { data: vendor } = await supabase
    .from('vendors')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();

  const profile = await getOrCreateVendorProfile(supabase, user.id, vendor?.name ?? null);

  // display_name and avatar_url are arbitrary JSON on the auth user — read
  // defensively, per the profile settings standard's §3.1 (kit-local,
  // auth.users.user_metadata, never the shared table).
  const rawDisplayName = user.user_metadata?.display_name;
  const displayName = typeof rawDisplayName === 'string' ? rawDisplayName : '';
  const rawAvatarUrl = user.user_metadata?.avatar_url;
  const avatarUrl = typeof rawAvatarUrl === 'string' ? rawAvatarUrl : null;

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6 md:max-w-4xl">
      <div>
        <Link
          href="/dashboard"
          className="text-muted-foreground text-sm underline underline-offset-4"
        >
          ← Dashboard
        </Link>
      </div>
      <header>
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
          Your account
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your stall/shop name and social links are shared with every Merqo kit you use.
        </p>
      </header>
      <ProfileForm
        vendorId={user.id}
        stallName={profile.stall_name}
        socialLinks={profile.social_links}
        displayName={displayName}
        email={user.email ?? ''}
        avatarUrl={avatarUrl}
      />
    </main>
  );
}
```

- [ ] **Step 2: Replace `profile-form.tsx`**

```tsx
// src/app/dashboard/profile/profile-form.tsx
'use client';

import { ImageUploader } from '@/components/image-uploader';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAsyncAction } from '@/hooks';
import {
  displayNameSchema,
  passwordChangeSchema,
  profileNameSchema,
  socialLinksSchema,
  type SocialLinksInput,
} from '@/lib/schemas';
import { createClient } from '@/lib/supabase/client';
import { FORM_ERROR_CLASS, FORM_LABEL_CLASS } from '@/lib/utils';
import { IdCard, KeyRound, Share2, Store, UserRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { updateSocialLinks, updateStallName } from './actions';

interface Props {
  vendorId: string;
  stallName: string;
  socialLinks: SocialLinksInput;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export function ProfileForm({
  vendorId,
  stallName,
  socialLinks,
  displayName,
  email,
  avatarUrl,
}: Props) {
  const supabase = createClient();

  const [name, setName] = useState(stallName);
  const [nameError, setNameError] = useState<string | null>(null);
  const { pending: savingName, run: runName } = useAsyncAction();

  const [links, setLinks] = useState(socialLinks);
  const [linksError, setLinksError] = useState<string | null>(null);
  const { pending: savingLinks, run: runLinks } = useAsyncAction();

  const [avatar, setAvatar] = useState(avatarUrl);
  const { run: runAvatar } = useAsyncAction();

  const [display, setDisplay] = useState(displayName);
  const [displayError, setDisplayError] = useState<string | null>(null);
  const { pending: savingDisplay, run: runDisplay } = useAsyncAction();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const { pending: savingPw, run: runPw } = useAsyncAction();

  function saveName() {
    const parsed = profileNameSchema.safeParse({ name });
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? 'Invalid stall name');
      return;
    }
    setNameError(null);
    return runName(async () => {
      const res = await updateStallName(parsed.data);
      if (!res.success) return toast.error(res.error);
      toast.success('Stall name saved');
    });
  }

  function saveLinks() {
    const parsed = socialLinksSchema.safeParse(links);
    if (!parsed.success) {
      setLinksError(parsed.error.issues[0]?.message ?? 'Invalid links');
      return;
    }
    setLinksError(null);
    return runLinks(async () => {
      const res = await updateSocialLinks(parsed.data);
      if (!res.success) return toast.error(res.error);
      toast.success('Links saved');
    });
  }

  function saveAvatar(url: string | null) {
    setAvatar(url);
    return runAvatar(async () => {
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: url } });
      if (error) return toast.error(error.message);
      toast.success(url ? 'Profile icon saved' : 'Profile icon removed');
    });
  }

  function saveDisplayName() {
    const parsed = displayNameSchema.safeParse({ displayName: display });
    if (!parsed.success) {
      setDisplayError(parsed.error.issues[0]?.message ?? 'Invalid name');
      return;
    }
    setDisplayError(null);
    return runDisplay(async () => {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: parsed.data.displayName },
      });
      if (error) return toast.error(error.message);
      toast.success('Display name saved');
    });
  }

  function savePassword() {
    const parsed = passwordChangeSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setPwError(parsed.error.issues[0]?.message ?? 'Check your password');
      return;
    }
    setPwError(null);
    return runPw(async () => {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) return toast.error(error.message);
      toast.success('Password updated');
      setPassword('');
      setConfirm('');
    });
  }

  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-start">
      <div className="flex flex-1 flex-col gap-5">
        <Section
          icon={<Store className="size-5" />}
          eyebrow="Shown to customers"
          title="Stall/shop name"
          description="The name vendors and Merqo kits see for your business."
        >
          <div className="space-y-2">
            <Label htmlFor="stall-name" className={FORM_LABEL_CLASS}>
              Stall/shop name
            </Label>
            <Input
              id="stall-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? 'stall-name-error' : undefined}
            />
            {nameError && (
              <p id="stall-name-error" className={FORM_ERROR_CLASS}>
                {nameError}
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={saveName} disabled={savingName}>
              {savingName ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Section>

        <Section
          icon={<UserRound className="size-5" />}
          eyebrow="Your account menu"
          title="Profile icon"
          description="A small image for your account menu. Defaults to your initials."
        >
          <div className="flex items-center gap-4">
            <ImageUploader vendorId={vendorId} value={avatar} onChange={saveAvatar} />
            <p className="text-muted-foreground text-xs">
              Square images look best. Remove it any time to fall back to your initials badge.
            </p>
          </div>
        </Section>

        <Section
          icon={<KeyRound className="size-5" />}
          eyebrow="Sign-in security"
          title="Change password"
          description="Set a new password. At least 8 characters."
        >
          <div className="space-y-2">
            <Label htmlFor="account-email" className={FORM_LABEL_CLASS}>
              Email
            </Label>
            <Input id="account-email" value={email} readOnly disabled className="bg-secondary/60" />
            <p className="text-muted-foreground text-xs">
              Your sign-in email. It can&apos;t be changed here.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password" className={FORM_LABEL_CLASS}>
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className={FORM_LABEL_CLASS}>
              Confirm new password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={!!pwError}
              aria-describedby={pwError ? 'confirm-password-error' : undefined}
            />
            {pwError && (
              <p id="confirm-password-error" className={FORM_ERROR_CLASS}>
                {pwError}
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={savePassword} disabled={savingPw || !password || !confirm}>
              {savingPw ? 'Updating…' : 'Update password'}
            </Button>
          </div>
        </Section>
      </div>

      <div className="flex flex-1 flex-col gap-5">
        <Section
          icon={<IdCard className="size-5" />}
          eyebrow="Just for you"
          title="Display name"
          description="How stockkit addresses you. Customers never see this."
        >
          <div className="space-y-2">
            <Label htmlFor="display-name" className={FORM_LABEL_CLASS}>
              Display name
            </Label>
            <Input
              id="display-name"
              value={display}
              maxLength={60}
              placeholder="e.g. Aisha"
              onChange={(e) => setDisplay(e.target.value)}
              aria-invalid={!!displayError}
              aria-describedby={displayError ? 'display-name-error' : undefined}
            />
            {displayError && (
              <p id="display-name-error" className={FORM_ERROR_CLASS}>
                {displayError}
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={saveDisplayName} disabled={savingDisplay}>
              {savingDisplay ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Section>

        <Section
          icon={<Share2 className="size-5" />}
          eyebrow="Shown to customers"
          title="Social links"
          description="Applies across every Merqo kit you use."
        >
          <div className="space-y-2">
            {(['website', 'instagram', 'facebook', 'tiktok'] as const).map((key) => (
              <Input
                key={key}
                placeholder={key}
                value={links[key] ?? ''}
                onChange={(e) => setLinks({ ...links, [key]: e.target.value })}
              />
            ))}
          </div>
          {linksError && <p className={FORM_ERROR_CLASS}>{linksError}</p>}
          <div className="flex justify-end">
            <Button onClick={saveLinks} disabled={savingLinks}>
              {savingLinks ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `profile-form.dom.test.tsx`**

Replace the file's full contents:

```tsx
// src/app/dashboard/profile/profile-form.dom.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const updateStallName = vi.fn(async (_input: unknown) => ({ success: true }));
const updateSocialLinks = vi.fn(async (_input: unknown) => ({ success: true }));
vi.mock('./actions', () => ({
  updateStallName: (input: unknown) => updateStallName(input),
  updateSocialLinks: (input: unknown) => updateSocialLinks(input),
}));

const { updateUserMock, uploadMock, getPublicUrlMock } = vi.hoisted(() => ({
  updateUserMock: vi.fn(async (_input: unknown) => ({ error: null })),
  uploadMock: vi.fn(async (_path: string, _blob: unknown, _opts: unknown) => ({ error: null })),
  getPublicUrlMock: vi.fn((path: string) => ({ data: { publicUrl: `https://x.supabase.co/${path}` } })),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { updateUser: updateUserMock },
    storage: { from: () => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock }) },
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ProfileForm } from './profile-form';

const defaultProps = {
  vendorId: 'v1',
  stallName: 'My Stall',
  socialLinks: {},
  displayName: '',
  email: 'vendor@example.com',
  avatarUrl: null,
};

afterEach(() => cleanup());

describe('ProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateUserMock.mockResolvedValue({ error: null });
    uploadMock.mockResolvedValue({ error: null });
  });

  it('saves the stall name independently of other sections', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const input = screen.getByLabelText(/stall\/shop name/i);
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(updateStallName).toHaveBeenCalledWith({ name: 'New Name' });
  });

  it('rejects an empty stall name client-side without calling the server action', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const input = screen.getByLabelText(/stall\/shop name/i);
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(updateStallName).not.toHaveBeenCalled();
  });

  it('rejects an invalid social link URL client-side without calling the server action', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const input = screen.getByPlaceholderText('website');
    await user.type(input, 'not-a-url');
    await user.click(screen.getByRole('button', { name: /save links/i }));
    expect(updateSocialLinks).not.toHaveBeenCalled();
  });

  it('saves the display name via supabase.auth.updateUser, independently of other sections', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const input = screen.getByLabelText(/^display name$/i);
    await user.type(input, 'Aisha');
    await user.click(screen.getByRole('button', { name: /save display name/i }));
    expect(updateUserMock).toHaveBeenCalledWith({ data: { display_name: 'Aisha' } });
    expect(updateStallName).not.toHaveBeenCalled();
  });

  it('rejects a display name over 60 characters client-side', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const input = screen.getByLabelText(/^display name$/i);
    await user.type(input, 'a'.repeat(61));
    await user.click(screen.getByRole('button', { name: /save display name/i }));
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('saves a new password and clears the fields on success', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    await user.type(screen.getByLabelText(/^new password$/i), 'hunter22');
    await user.type(screen.getByLabelText(/confirm new password/i), 'hunter22');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'hunter22' });
    expect(screen.getByLabelText(/^new password$/i)).toHaveValue('');
  });

  it('rejects mismatched passwords client-side without calling updateUser', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    await user.type(screen.getByLabelText(/^new password$/i), 'hunter22');
    await user.type(screen.getByLabelText(/confirm new password/i), 'different');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(screen.getByText('Passwords do not match')).toBeTruthy();
  });

  it('uploads and saves a new avatar via the profile icon uploader', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    expect(uploadMock).toHaveBeenCalled();
    expect(updateUserMock).toHaveBeenCalledWith({
      data: { avatar_url: expect.stringContaining('https://x.supabase.co/v1/') },
    });
  });
});
```

- [ ] **Step 4: Run the full test suite**

Run: `pnpm test`
Expected: all tests pass, including the new/updated `profile-form.dom.test.tsx`
cases.

- [ ] **Step 5: Create `src/app/dashboard/profile/README.md`**

```markdown
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
  (`ImageUploader`), change password. Column 2: display name, social links.
  Column order and layout mechanism match the standard exactly.

## Connectivity

Reachable from `dashboard-nav.tsx`'s account menu ("Profile" item).
`page.tsx` calls `createServerClient()` + `getOrCreateVendorProfile`,
renders `profile-form.tsx`, which calls `actions.ts`'s
`updateStallName`/`updateSocialLinks` for stall name/social links and the
browser Supabase client (`@/lib/supabase/client`) directly for
avatar/display-name/password, all validated against schemas in
`@/lib/schemas`. Avatar uploads go through `@/components/image-uploader.tsx`
to the `vendor-avatars` Storage bucket (`supabase/migrations/0005_vendor_avatars_bucket.sql`).

## Parent

[dashboard](../README.md)
```

- [ ] **Step 6: Update `CHANGELOG.md`**

Add to `## Unreleased`, above the existing top entry:

```markdown
- `/dashboard/profile` now covers the full profile-settings standard
  (`docs/business/2026-07-21-profile-settings-page-standard.md`): display
  name, profile icon (upload to a new `vendor-avatars` Storage bucket), and
  change-password sections, alongside the existing stall name/social links.
  Previously only stall name and social links existed on this page.
```

- [ ] **Step 7: Update root `README.md`**

In the `### Contents` bullet list, add three new bullets after the
`src/lib/brand-icon.tsx` line:

```markdown
- `src/components/section.tsx` — the per-field-group shell (icon chip + eyebrow + title + description) used by the profile page's five sections.
- `src/components/image-uploader.tsx` + `src/lib/image-resize.ts` — the profile page's avatar uploader (client-side resize to WebP, upload to the `vendor-avatars` Storage bucket).
```

Also update the `/dashboard` routes table row's `Purpose` column isn't
affected (no new route), so no table changes needed there.

- [ ] **Step 8: Format, typecheck, lint, full test run**

```bash
pnpm format
pnpm typecheck
pnpm lint
pnpm test
```

Expected: all clean.

- [ ] **Step 9: Commit**

```bash
git add src/app/dashboard/profile/page.tsx src/app/dashboard/profile/profile-form.tsx \
        src/app/dashboard/profile/profile-form.dom.test.tsx \
        src/app/dashboard/profile/README.md CHANGELOG.md README.md
git commit -m "feat: add display name, avatar upload, and password change to profile page"
```

---

## Final checks (whole-branch, before PR)

- [ ] `pnpm check` (prettier --check + eslint + tsc + route-logging check) clean.
- [ ] `pnpm test` clean, full suite.
- [ ] `pnpm build` succeeds (use placeholder env vars locally per the
      project's documented workaround: `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=placeholder-publishable-key
      SUPABASE_SECRET_KEY=placeholder-secret-key pnpm build`).
- [ ] Confirm every folder touched across all 6 tasks has its `README.md`
      in the final diff: `supabase/migrations/`, `src/lib/` (twice — Task 2
      touches `schemas.ts`/`schemas.test.ts` only, no README needed there
      since `src/lib/README.md` doesn't enumerate every file, but Task 3
      adds `image-resize.ts` and does touch it), `src/components/` (Tasks 4
      and 5), `src/app/dashboard/profile/` (Task 6, new file), and root
      `README.md` + `CHANGELOG.md` (Task 6, since `CHANGELOG.md` is
      dirname `.`).
- [ ] `pnpm audit --prod --audit-level=high` clean (no new high-severity
      deps introduced — this plan adds no new npm dependencies).
