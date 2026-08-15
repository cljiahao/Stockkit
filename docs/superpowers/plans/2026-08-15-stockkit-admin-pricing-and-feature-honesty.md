# stockkit Admin-Tunable Pricing + Feature-List Honesty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stockkit's hardcoded `PRO_PRICE = '$14/mo'` constant with
an admin-tunable `stockkit.pricing` table (edited live from `/admin`, no
redeploy), seeded at the raised price of $19.99/mo, using `@merqo/ui`'s new
`PricingForm` component. Bundled in the same PR: remove the false
"Valuation trend reports (coming soon)" line from the Pro feature list in
`src/lib/plan.ts` — that feature doesn't exist and was never built.

**Architecture:** One new single-row table (`stockkit.pricing`, `id`
pinned to 1) mirroring qkit's `qkit.pricing` shape minus the day-pass
column stockkit doesn't need. A small `src/lib/pricing.ts` config module
(`PricingConfig`, `DEFAULT_PRICING`) mirrors qkit's own. `setPricing` is a
new Server Action in `src/app/admin/actions.ts`, following this file's
existing local-schema convention (not qkit's centralized-schema one). A
new client wrapper, `src/app/admin/pricing-section.tsx`, adapts
`@merqo/ui`'s presentational `PricingForm` to this app's action/toast/
refresh plumbing — the same pattern `profile-form.tsx` already uses for a
`@merqo/ui` component. The vendor-facing `/dashboard/plan` page switches
from the hardcoded constant to a live DB read with a fallback.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase
(`@supabase/ssr`), Zod, Vitest + Testing Library, shadcn/ui, `@merqo/ui`.

**Design doc:** `docs/superpowers/specs/2026-08-15-stockkit-admin-pricing-and-feature-honesty-design.md`.
Pricing rationale source of truth: `../../../docs/business/2026-08-15-per-kit-pricing-rationale.md`
(do not re-derive the $19.99 figure here — cite it).

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`.
- Validate all user input with Zod at every boundary (forms + server actions).
- Authorization lives in RLS policies, not app code. The new `pricing`
  table gets a public-SELECT policy and no write policy at all — every
  write goes through the service-role `setPricing` action.
- Comment hygiene: own-line comments only, no trailing inline comments
  (`no-inline-comments: error`); no committed dead/commented-out code
  (`sonarjs/no-commented-code: error`).
- `font-mono` on every quantity/cost figure shown to the vendor (this
  repo's one deliberate typographic signature) — the plan page's price
  display already has this; keep it when it moves from a hardcoded string
  to a computed one.
- After editing the schema, update `src/lib/types.ts` to match (this repo
  has no `supabase gen types` step — types are hand-maintained).
- **`PricingSection`'s `onSave` throws on failure, it does not toast
  inline.** `@merqo/ui`'s `PricingForm` surfaces a rejected `onSave` via
  its own `onError` prop — toasting inside `onSave` as well as inside
  `onError` double-fires the error UI. One toast call, in `onError`, full
  stop.
- **This plan does not build a valuation/trend feature.** The
  "coming soon" fix removes a false claim from a feature list; building
  the feature it once referred to is separate, unscheduled, out-of-scope
  work.
- Confirm the actual `@merqo/ui` tag that ships `PricingForm` before
  bumping `package.json`'s dependency pin — don't assume a version number
  sight-unseen (see Task 1, Step 0).
- Run `pnpm check && pnpm test` before considering any task done; run
  `pnpm build` before the final commit (this repo's convention: `pnpm
check`/`pnpm test` miss Next.js client/server bundle-boundary errors).

---

### Task 0: Confirm the `@merqo/ui` `PricingForm` release and bump the dependency

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml` (via `pnpm install`)

**Interfaces:**

- Consumes: nothing.
- Produces: `PricingForm`, `PricingFormProps`, `PricingFieldConfig`
  importable from `@merqo/ui` — every later task that touches
  `pricing-section.tsx` depends on this being available.

- [ ] **Step 1: Find the real released tag**

`merqo-ui`'s own `PricingForm` plan
(`merqo-ui/docs/superpowers/plans/2026-08-15-pricing-form.md`) is being
executed in parallel with this plan. Before starting, check:

```bash
cd "../merqo-ui" && git tag --sort=-v:refname | head -3
```

If the tag containing `PricingForm` isn't published yet, this plan is
blocked on that work landing first — do not proceed by vendoring or
copy-pasting the component locally; wait for the real release (matches
how every other kit consumes `@merqo/ui`, via the pinned GitHub tag in
`package.json`).

- [ ] **Step 2: Bump the pin**

In `package.json`, change:

```
"@merqo/ui": "github:cljiahao/merqo-ui#v0.11.1",
```

to the confirmed tag from Step 1 (e.g. `#v0.12.0` — confirm, don't assume).

- [ ] **Step 3: Install and verify the export resolves**

Run: `pnpm install`
Then: `node -e "console.log(Object.keys(require('@merqo/ui')))"` (or
equivalent quick check) to confirm `PricingForm` is among the package's
exports.
Expected: `PricingForm` present; no install errors.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: bump @merqo/ui for PricingForm"
```

---

### Task 1: `stockkit.pricing` table

**Files:**

- Create: `supabase/migrations/0014_stockkit_pricing.sql`
- Modify: `src/lib/types.ts`

**Interfaces:**

- Produces: `stockkit.pricing` (SQL table); `Database['stockkit']['Tables']['pricing']`
  and `export type Pricing = Database['stockkit']['Tables']['pricing']['Row']`
  in `src/lib/types.ts` — Task 2's `PricingConfig` and every later
  Supabase query against this table depend on this type existing.

- [ ] **Step 1: Write the migration**

```sql
-- 0014_stockkit_pricing.sql
-- Admin-editable pricing so the vendor plan page can show a live price and
-- admins can tune it without a deploy. Single-row, id pinned to 1 — same
-- shape as qkit.pricing (qkit/supabase/migrations/0010_monetization.sql),
-- minus event_pass_cents: stockkit has no day-pass concept
-- (docs/business/2026-07-30-cross-kit-pricing-and-billing-plan.md's own
-- decision to keep per-day pricing qkit-only).
CREATE TABLE stockkit.pricing (
  id            INT         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  monthly_cents INT         NOT NULL DEFAULT 0,
  currency      TEXT        NOT NULL DEFAULT 'SGD',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seeded at the raised price ($19.99/mo) directly — see
-- docs/business/2026-08-15-per-kit-pricing-rationale.md's stockkit section
-- for the rationale (Zoho Inventory $29/mo is the cheapest real comparator
-- found; this stays ~31% below it).
INSERT INTO stockkit.pricing (id, monthly_cents)
  VALUES (1, 1999)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE stockkit.pricing ENABLE ROW LEVEL SECURITY;

-- Prices aren't secret; a public read keeps the vendor plan page simple.
-- No write policy exists — writes go through the service-role setPricing
-- action only.
CREATE POLICY "pricing_public_select" ON stockkit.pricing
  FOR SELECT USING (true);

GRANT SELECT ON stockkit.pricing TO anon, authenticated;
GRANT ALL ON stockkit.pricing TO service_role;
```

- [ ] **Step 2: Apply it locally**

Run: `supabase migration up` (or this repo's equivalent local-apply
command — check `package.json`/`AGENTS.md` if that isn't it).
Expected: migration applies with no error; `\d stockkit.pricing` in
`psql`/Supabase Studio shows the new table, and `SELECT * FROM
stockkit.pricing;` returns one row with `monthly_cents = 1999`.

- [ ] **Step 3: Update the hand-maintained type**

In `src/lib/types.ts`, add a `pricing` entry to
`Database['stockkit']['Tables']`, mirroring the `admin_audit`/`admins`
entries' shape:

```ts
pricing: {
  Row: {
    id: number;
    monthly_cents: number;
    currency: string;
    updated_at: string;
  };
  Insert: {
    id?: number;
    monthly_cents?: number;
    currency?: string;
    updated_at?: string;
  };
  Update: {
    id?: number;
    monthly_cents?: number;
    currency?: string;
    updated_at?: string;
  };
  Relationships: [];
};
```

Add `export type Pricing = Database['stockkit']['Tables']['pricing']['Row'];`
alongside the other type exports at the bottom of the file (next to
`Vendor`, `Product`, etc.).

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (nothing consumes the new type yet).

- [ ] **Step 5: Update the migrations README**

In `supabase/migrations/README.md`: bump "14 files, `0000` through `0013`"
to "15 files, `0000` through `0014`", and add a bullet for
`0014_stockkit_pricing.sql` in the same per-file description style as the
existing entries (creates the single-row `pricing` table, seeds it at
$19.99/mo, public-select RLS policy, service-role-only writes).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0014_stockkit_pricing.sql src/lib/types.ts supabase/migrations/README.md
git commit -m "feat: add stockkit.pricing table, seeded at \$19.99/mo"
```

---

### Task 2: `PricingConfig` + `DEFAULT_PRICING` config module

**Files:**

- Create: `src/lib/pricing.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `export interface PricingConfig { monthly_cents: number;
currency: string }`, `export const DEFAULT_PRICING: PricingConfig` —
  consumed by Task 3 (`admin-data.ts`), Task 4 (`pricing-section.tsx`), and
  Task 6 (`dashboard/plan/page.tsx`).

- [ ] **Step 1: Write the module**

```ts
// src/lib/pricing.ts
export interface PricingConfig {
  monthly_cents: number;
  currency: string;
}

/**
 * Fallback when the `pricing` row can't be read (network hiccup, RLS
 * misconfiguration, a pre-migration deploy window). Deliberately NOT
 * zeroed, unlike qkit's own DEFAULT_PRICING: qkit uses 0 to signal a real
 * "pre-Stripe beta, price genuinely unset" state its offer page branches
 * on. stockkit has no such beta framing — Pro is already a live, charged
 * tier — so a vendor hitting this fallback must still see a real price,
 * not $0.00/mo or a "Free" label on a page telling them they're on Pro.
 * Seeded to match the live migration value at introduction time
 * (supabase/migrations/0014_stockkit_pricing.sql). This is a defensive
 * fallback only, not synced automatically by future admin price edits —
 * the `pricing` row is always present after migration 0014 runs, so this
 * path should essentially never be hit in practice.
 */
export const DEFAULT_PRICING: PricingConfig = {
  monthly_cents: 1999,
  currency: 'SGD',
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pricing.ts
git commit -m "feat: add stockkit PricingConfig/DEFAULT_PRICING module"
```

---

### Task 3: `currentPricing()` in the admin data layer

**Files:**

- Modify: `src/lib/admin-data.ts`
- Modify: `src/lib/admin-data.test.ts`

**Interfaces:**

- Consumes: `PricingConfig`, `DEFAULT_PRICING` from `@/lib/pricing` (Task 2).
- Produces: `export async function currentPricing(): Promise<PricingConfig>`
  — consumed by Task 5 (`admin/page.tsx`).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/admin-data.test.ts` (match this file's existing mock
conventions for `createServiceClient`/`.from()` chains — check the
existing `platformTotals`/`listVendors` tests in the same file for the
exact mock shape before writing these):

```ts
describe('currentPricing', () => {
  it('returns the live pricing row', async () => {
    // mock supabase.from('pricing').select(...).eq('id', 1).maybeSingle()
    // to resolve { data: { monthly_cents: 1999, currency: 'SGD' }, error: null }
    const { currentPricing } = await import('./admin-data');
    const result = await currentPricing();
    expect(result).toEqual({ monthly_cents: 1999, currency: 'SGD' });
  });

  it('falls back to DEFAULT_PRICING when the row is missing', async () => {
    // mock the same chain to resolve { data: null, error: null }
    const { currentPricing } = await import('./admin-data');
    const { DEFAULT_PRICING } = await import('@/lib/pricing');
    const result = await currentPricing();
    expect(result).toEqual(DEFAULT_PRICING);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/admin-data.test.ts`
Expected: FAIL — `currentPricing` doesn't exist yet.

- [ ] **Step 3: Implement**

In `src/lib/admin-data.ts`, add the import and function:

```ts
import { DEFAULT_PRICING, type PricingConfig } from '@/lib/pricing';

/** The live monthly price, for the admin pricing form and its fallback. */
export async function currentPricing(): Promise<PricingConfig> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('pricing')
    .select('monthly_cents, currency')
    .eq('id', 1)
    .maybeSingle();
  return data ?? DEFAULT_PRICING;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/admin-data.test.ts`
Expected: PASS, including all pre-existing tests in this file (no
regressions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-data.ts src/lib/admin-data.test.ts
git commit -m "feat: add currentPricing to the admin data layer"
```

---

### Task 4: `setPricing` server action

**Files:**

- Modify: `src/app/admin/actions.ts`
- Modify: `src/app/admin/actions.test.ts`

**Interfaces:**

- Consumes: `MAX_MONEY_CENTS` from `@/lib/schemas` (existing).
- Produces: `pricingFormSchema`, `export type PricingFormInput`,
  `export async function setPricing(input: PricingFormInput):
Promise<ActionResult>` — consumed by Task 4b's `pricing-section.tsx`.

- [ ] **Step 1: Write the failing tests**

Add to `src/app/admin/actions.test.ts`, reusing this file's existing
`vi.hoisted` mock scaffolding (`createServiceClientMock`, `fromMock`,
`updateMock`, `updateEqMock`, `insertMock`, `revalidatePathMock`) — extend
`fromMock`'s `mockImplementation` to also handle `table === 'pricing'`
returning `{ update: updateMock }`, same shape it already gives `vendors`:

```ts
describe('setPricing', () => {
  it('updates the pricing row, records an audit row, and revalidates both pages', async () => {
    const { setPricing } = await import('./actions');

    const result = await setPricing({ monthly_cents: 1999 });

    expect(result).toEqual({ success: true });
    expect(fromMock).toHaveBeenCalledWith('pricing');
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ monthly_cents: 1999 }));
    expect(updateEqMock).toHaveBeenCalledWith('id', 1);
    expect(insertMock).toHaveBeenCalledWith({
      admin_id: 'admin-1',
      action: 'set_pricing',
      target_id: null,
      detail: { monthly_cents: 1999 },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin');
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/plan');
  });

  it('rejects a negative price before touching the database', async () => {
    const { setPricing } = await import('./actions');
    const result = await setPricing({ monthly_cents: -100 });
    expect(result).toEqual({ success: false, error: 'Invalid input' });
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it('rejects a price above MAX_MONEY_CENTS', async () => {
    const { MAX_MONEY_CENTS } = await import('@/lib/schemas');
    const { setPricing } = await import('./actions');
    const result = await setPricing({ monthly_cents: MAX_MONEY_CENTS + 1 });
    expect(result).toEqual({ success: false, error: 'Invalid input' });
  });

  it('returns a friendly error and logs when the update fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: { message: 'connection reset' } });

    const { setPricing } = await import('./actions');
    const result = await setPricing({ monthly_cents: 1999 });

    expect(result).toEqual({ success: false, error: 'Could not update pricing' });
    expect(logged).toHaveBeenCalledWith('setPricing failed', 'connection reset');
    logged.mockRestore();
  });

  it('propagates requireAdmin rejecting a non-admin caller before any write', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('NEXT_NOT_FOUND'));
    const { setPricing } = await import('./actions');
    await expect(setPricing({ monthly_cents: 1999 })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });
});
```

Adjust the exact mock-chain wiring for the `update(...).eq('id', 1)` call
(no `.select().maybeSingle()` after it, unlike `setVendorPlan` — `setPricing`
only checks `error`, not a returned row) to match whatever this file's
`updateMock`/`updateEqMock` chain actually resolves to after Step 2 shows
you the real failure — the existing `setVendorPlan` tests are the
reference shape, not a literal template, since `setPricing`'s update chain
is one link shorter.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/app/admin/actions.test.ts`
Expected: FAIL — `setPricing` doesn't exist yet.

- [ ] **Step 3: Implement**

In `src/app/admin/actions.ts`, add the import and schema near the top
(alongside the existing `setVendorPlanSchema`):

```ts
import { MAX_MONEY_CENTS } from '@/lib/schemas';

const pricingFormSchema = z.object({
  monthly_cents: z.number().int().nonnegative().max(MAX_MONEY_CENTS),
});
export type PricingFormInput = z.infer<typeof pricingFormSchema>;
```

Then, below `setVendorPlan`:

```ts
/**
 * Update the single pricing row shown on the vendor plan page. Admin-only:
 * requireAdmin() 404s non-admins before any write. Service-role client
 * because migration 0014 gives `pricing` no write policy — every write
 * goes through this action.
 */
export async function setPricing(input: PricingFormInput): Promise<ActionResult> {
  const { user } = await requireAdmin();

  const parsed = pricingFormSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from('pricing')
    .update({ monthly_cents: parsed.data.monthly_cents, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) {
    console.error('setPricing failed', error.message);
    return { success: false, error: 'Could not update pricing' };
  }

  await recordAudit(user.id, 'set_pricing', null, { monthly_cents: parsed.data.monthly_cents });

  revalidatePath(PAGE_ROUTES.ADMIN);
  revalidatePath(PAGE_ROUTES.PLAN);
  return { success: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/app/admin/actions.test.ts`
Expected: PASS, all tests including the pre-existing `setVendorPlan` suite.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/actions.ts src/app/admin/actions.test.ts
git commit -m "feat: add setPricing admin server action"
```

---

### Task 5: `PricingSection` admin wrapper component

**Files:**

- Create: `src/app/admin/pricing-section.tsx`
- Create: `src/app/admin/pricing-section.dom.test.tsx`

**Interfaces:**

- Consumes: `PricingForm` from `@merqo/ui` (Task 0), `setPricing` from
  `./actions` (Task 4), `PricingConfig` from `@/lib/pricing` (Task 2).
- Produces: `export function PricingSection({ initial }: { initial:
PricingConfig })` — consumed by Task 6's `admin/page.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/admin/pricing-section.dom.test.tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { setPricingMock, refreshMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  setPricingMock: vi.fn(),
  refreshMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('./actions', () => ({ setPricing: setPricingMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock('sonner', () => ({ toast: { success: toastSuccessMock, error: toastErrorMock } }));

import { PricingSection } from './pricing-section';

beforeEach(() => {
  setPricingMock.mockReset();
  refreshMock.mockReset();
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
});

describe('PricingSection', () => {
  it('renders the form pre-filled from the initial price', () => {
    render(<PricingSection initial={{ monthly_cents: 1999, currency: 'SGD' }} />);
    expect(screen.getByLabelText(/monthly \(sgd\)/i)).toHaveValue('19.99');
  });

  it('saves, toasts success, and refreshes on a successful save', async () => {
    setPricingMock.mockResolvedValue({ success: true });
    render(<PricingSection initial={{ monthly_cents: 1999, currency: 'SGD' }} />);
    fireEvent.change(screen.getByLabelText(/monthly \(sgd\)/i), { target: { value: '24.99' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(setPricingMock).toHaveBeenCalledWith({ monthly_cents: 2499 }));
    expect(toastSuccessMock).toHaveBeenCalledWith('Pricing updated');
    expect(refreshMock).toHaveBeenCalled();
  });

  it('toasts the server error, once, when setPricing returns a failure', async () => {
    setPricingMock.mockResolvedValue({ success: false, error: 'Could not update pricing' });
    render(<PricingSection initial={{ monthly_cents: 1999, currency: 'SGD' }} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('Could not update pricing'));
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/app/admin/pricing-section.dom.test.tsx`
Expected: FAIL — `./pricing-section` doesn't exist yet.

- [ ] **Step 3: Implement**

```tsx
// src/app/admin/pricing-section.tsx
'use client';

import { PricingForm } from '@merqo/ui';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import type { PricingConfig } from '@/lib/pricing';
import { setPricing } from './actions';

/**
 * Adapter between this app's own action/toast/refresh plumbing and
 * @merqo/ui's presentational PricingForm. onSave throws (rather than
 * toasting inline) on a failed setPricing call, so the failure routes
 * through PricingForm's own onError exactly once — see this plan's Global
 * Constraints.
 */
export function PricingSection({ initial }: { initial: PricingConfig }) {
  const router = useRouter();

  return (
    <PricingForm
      fields={[{ key: 'monthly_cents', label: `Monthly (${initial.currency})` }]}
      initial={{ values: { monthly_cents: initial.monthly_cents }, currency: initial.currency }}
      onSave={async (values) => {
        const result = await setPricing({ monthly_cents: values.monthly_cents ?? 0 });
        if (!result.success) throw new Error(result.error);
        toast.success('Pricing updated');
        router.refresh();
      }}
      onError={(err) =>
        toast.error(err instanceof Error ? err.message : 'Could not update pricing')
      }
      helpText="Shown on the vendor plan page."
    />
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/app/admin/pricing-section.dom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/pricing-section.tsx src/app/admin/pricing-section.dom.test.tsx
git commit -m "feat: add PricingSection admin wrapper for @merqo/ui PricingForm"
```

---

### Task 6: Wire `PricingSection` into `/admin`

**Files:**

- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/admin-overview-page.dom.test.tsx`
- Modify: `src/app/admin/README.md`

**Interfaces:**

- Consumes: `currentPricing` (Task 3), `PricingSection` (Task 5).
- Produces: nothing new — this is the last piece of the admin-facing surface.

- [ ] **Step 1: Update the existing test's mock**

In `admin-overview-page.dom.test.tsx`, add `currentPricing` to the
`vi.mock('@/lib/admin-data', ...)` factory:

```ts
currentPricing: vi.fn(async () => ({ monthly_cents: 1999, currency: 'SGD' })),
```

Add a new test asserting the pricing section renders:

```ts
it('renders the pricing section with the live price', async () => {
  render(await AdminOverviewPage());
  expect(screen.getByLabelText(/monthly \(sgd\)/i)).toHaveValue('19.99');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/admin/admin-overview-page.dom.test.tsx`
Expected: FAIL — `page.tsx` doesn't call `currentPricing()` yet, and even
with the mock added, no pricing section renders.

- [ ] **Step 3: Wire it into the page**

In `src/app/admin/page.tsx`:

```ts
import { currentPricing, platformTotals, recentActivity } from '@/lib/admin-data';
import { PricingSection } from './pricing-section';
```

Add `currentPricing()` to the existing `Promise.all`:

```ts
const [totals, activity, pricing] = await Promise.all([
  platformTotals(),
  recentActivity(15),
  currentPricing(),
]);
```

Add a new section below the existing "Recent activity" section (same
`<section className="space-y-3">` / `<h2>` pattern already used there):

```tsx
<section className="space-y-3">
  <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">Pricing</h2>
  <PricingSection initial={pricing} />
</section>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/app/admin/admin-overview-page.dom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Update the admin README**

In `src/app/admin/README.md`'s Contents list: extend the `actions.ts`
bullet to mention `setPricing`; add a new bullet for `pricing-section.tsx`
(the `@merqo/ui` `PricingForm` adapter); extend the `page.tsx` bullet to
mention it now also fetches `currentPricing()` and renders the new
Pricing section.

- [ ] **Step 6: Full check**

Run: `pnpm check && pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/page.tsx src/app/admin/admin-overview-page.dom.test.tsx src/app/admin/README.md
git commit -m "feat: wire PricingSection into the admin overview page"
```

---

### Task 7: Vendor-facing plan page reads the live price

**Files:**

- Modify: `src/app/dashboard/plan/page.tsx`
- Modify: `src/app/dashboard/plan/README.md`

**Interfaces:**

- Consumes: `DEFAULT_PRICING` from `@/lib/pricing` (Task 2), `formatPrice`
  from `@/lib/schemas` (existing).
- Produces: nothing new — `PlanPage`'s existing signature is unchanged,
  only its internal price source changes.

- [ ] **Step 1: Remove the hardcoded constant**

Delete `const PRO_PRICE = '$14/mo';` from `src/app/dashboard/plan/page.tsx`.

- [ ] **Step 2: Read the live price**

Add, alongside the existing `vendorRow` read (same `createServerClient()`
instance already in scope — this is a vendor's own read of a
publicly-readable row, not a service-role read):

```ts
import { DEFAULT_PRICING } from '@/lib/pricing';
import { formatPrice } from '@/lib/schemas';
```

```ts
const { data: pricingRow } = await supabase
  .from('pricing')
  .select('monthly_cents, currency')
  .eq('id', 1)
  .maybeSingle();
const pricing = pricingRow ?? DEFAULT_PRICING;
const monthlyPrice = `${formatPrice(pricing.monthly_cents)}/mo`;
```

- [ ] **Step 3: Replace every `PRO_PRICE` reference**

Change `<span className="font-mono">{PRO_PRICE}</span>` to
`<span className="font-mono">{monthlyPrice}</span>` — keep the
`font-mono` wrapper (this app's ledger typographic convention for every
quantity/cost figure).

- [ ] **Step 4: Manual check**

Run: `pnpm dev`, sign in as a Free test vendor, visit `/dashboard/plan`.
Expected: the upgrade paragraph shows `$19.99/mo` (from the migration
0014 seed), not `$14/mo`.

- [ ] **Step 5: Update the plan-page README**

In `src/app/dashboard/plan/README.md`'s `page.tsx` bullet: note the price
now comes from a live read of the `pricing` table (falling back to
`DEFAULT_PRICING`), not a hardcoded constant — mirroring the equivalent
sentence already in qkit's own `dashboard/plan/README.md`.

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/plan/page.tsx src/app/dashboard/plan/README.md
git commit -m "feat: read the live monthly price on the vendor plan page"
```

---

### Task 8: Remove the false "coming soon" feature-list line

**Files:**

- Modify: `src/lib/plan.ts`
- Modify: `src/lib/plan.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `resolvePlanView`'s existing signature/return type is
  unchanged — Pro's `features` array just loses its fourth, false entry.

- [ ] **Step 1: Write the failing test change**

In `src/lib/plan.test.ts`, update the "renders Pro as unlimited text
lines, CSV export, and no upgrade CTA" test: remove the fourth expected
array entry (`{ kind: 'text', text: 'Valuation trend reports (coming soon)' }`)
so the expected array has exactly three items.

Add a new, explicit regression-guard test right after it:

```ts
it('never advertises the unbuilt valuation-trend feature on Pro', () => {
  const view = resolvePlanView('pro', ENTITLEMENTS.pro);
  const hasComingSoonClaim = view.features.some(
    (f) => f.kind === 'text' && /coming soon/i.test(f.text)
  );
  expect(hasComingSoonClaim).toBe(false);
});
```

This second test is deliberately broader than an exact-array match — it
guards against _any_ future "coming soon" feature claim being reintroduced
on the Pro plan, not just this specific string.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/plan.test.ts`
Expected: FAIL — both the updated array-length assertion and the new
regression-guard test fail against the current `resolvePlanView`, which
still pushes the false line.

- [ ] **Step 3: Implement**

In `src/lib/plan.ts`, delete this block from `resolvePlanView`:

```ts
if (plan === 'pro') features.push({ kind: 'text', text: 'Valuation trend reports (coming soon)' });
```

Pro's `features` array is now built from exactly the three real
entitlement fields already above it in the function (unlimited products,
full movement history, CSV export) — no fourth, unconditional push.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/plan.test.ts`
Expected: PASS.

- [ ] **Step 5: Confirm no other reference exists**

Run: `grep -rn "Valuation trend\|coming soon" src/`
Expected: no hits in `src/` (the only prior reference was the deleted
line; the two 2026-07-30 spec/plan docs and the historical
`.superpowers/sdd/` artifact are outside `src/` and are left as-is, per
this repo's docs-are-history convention — not edited).

- [ ] **Step 6: Commit**

```bash
git add src/lib/plan.ts src/lib/plan.test.ts
git commit -m "fix: stop advertising the unbuilt valuation-trend feature on Pro"
```

---

### Task 9: Copy audit — confirm no other price references remain

**Files:** none expected to change (verification task); fix anything the
search below turns up.

- [ ] **Step 1: Repo-wide search for the old price**

```bash
grep -rn '14/mo\|\$14' src/ docs/ --include=*.tsx --include=*.ts --include=*.md
```

Expected, after Task 7: no remaining live-code hits in `src/` (the
`PRO_PRICE` constant is gone). The two 2026-07-30 `docs/superpowers/`
files are expected hits (historical record, not edited — see Task 8 Step
5's note). If this search turns up anything else — a landing-page string,
a README quoting the old price, an email/support-copy template — fix it
in this task; the spec's own copy audit found none beyond these, but
re-verify rather than trusting that audit blindly, since code may have
moved between spec-writing and implementation.

- [ ] **Step 2: Search landing components specifically**

```bash
grep -rln '/mo\|pricing\|Pro plan\|\$[0-9]' src/components/landing/
```

Expected: no hits referencing a Pro price (stockkit's landing page has
never quoted a price, confirmed in the design spec's copy audit) — if this
now returns something, it was added since the spec was written; update it
to `$19.99/mo` or remove the hardcoded figure in favor of the same live
read pattern from Task 7, whichever fits the surrounding copy.

- [ ] **Step 3: Commit, if anything changed**

Only commit if Steps 1–2 found something to fix; otherwise this task ends
with the repo already clean and needs no commit.

---

### Task 10: Full verification gate

**Files:** none.

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: PASS, no regressions anywhere (products, plan, admin, admin-data,
pricing-section, dashboard-nav, etc.).

- [ ] **Step 2: Full check**

Run: `pnpm check`
Expected: PASS (prettier, eslint, tsc --noEmit, route-logging check).

- [ ] **Step 3: Production build**

Run: `pnpm build`
Expected: PASS — this repo's convention requires a full Next.js build
before shipping client-side changes, since `pnpm check`/`pnpm test` miss
client/server bundle-boundary errors (`PricingSection` is a new client
component importing from `@merqo/ui`; this is exactly the kind of change
that check misses). Confirm `/admin` and `/dashboard/plan` both appear in
the route list with no build warnings about the new files.

- [ ] **Step 4: RLS isolation check**

Run: `supabase test db` (or this repo's equivalent — check
`AGENTS.md`/`package.json` for the exact command)
Expected: PASS, including any new `stockkit.pricing` case added to
`supabase/tests/rls.test.sql` per the design spec's Testing section
(public SELECT works, a non-service-role write is rejected).

- [ ] **Step 5: Manual smoke check**

Run: `pnpm dev`. As an admin, visit `/admin`, confirm the Pricing section
shows `19.99`, change it to something else, save, confirm the toast and
that `/dashboard/plan` (as a Free test vendor) reflects the new price
after a refresh. As a Pro test vendor, confirm the feature list no longer
shows any "coming soon" line.

- [ ] **Step 6: Final commit, if anything was fixed during verification**

If Steps 1–5 surface anything, fix it and commit; if everything already
passes cleanly from the per-task commits, this step is a no-op.

---

## Self-Review Notes

- **Spec coverage:** every numbered item in the design spec's "What
  changes" section maps to a task here — migration (Task 1), config
  module (Task 2), admin data layer (Task 3), server action (Task 4),
  admin wrapper component (Task 5), admin page wiring (Task 6), vendor
  plan page (Task 7), feature-list fix (Task 8), copy audit (Task 9), full
  verification (Task 10). The `@merqo/ui` dependency bump got its own task
  (Task 0) since every later task blocks on it.
- **Placeholder scan:** none — every task has a real failing-test-first
  step and a real implementation, not a stub. Task 9 is intentionally a
  verification-only task (may produce zero diff) rather than assuming the
  spec's own copy audit is still accurate at implementation time.
- **TDD discipline:** every code-producing task (1, 3, 4, 5, 6, 7, 8)
  follows write-failing-test → confirm-fail → implement → confirm-pass,
  consistent with this repo's `superpowers:test-driven-development`
  convention and the reference plan's (`2026-07-30-plan-tier-page.md`)
  own shape.
- **Ordering rationale:** Task 0 (dependency) before Task 5 (the component
  that imports it) — but Tasks 1–4 (migration, config, data layer, action)
  don't need `@merqo/ui` at all and could technically run before or in
  parallel with Task 0; kept in this order anyway so a reader implementing
  serially never hits a missing-import error mid-task.
- **Divergence from the qkit reference implementation, both flagged in
  the design spec and repeated here so an implementer following only this
  plan doesn't need to cross-reference:** the Zod schema stays local to
  `admin/actions.ts` (this repo's own convention), and `DEFAULT_PRICING`
  is seeded non-zero (unlike qkit's zeroed fallback) because stockkit has
  no beta framing that zero would need to signal.
- **Scope boundary:** Task 8 removes a false claim; it adds no new
  feature. No task in this plan builds a valuation/trend view.
