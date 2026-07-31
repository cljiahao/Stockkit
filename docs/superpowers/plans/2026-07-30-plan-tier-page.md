# stockkit Plan Tier Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give stockkit a Free/Pro vendor-tier concept (20-product cap on
Free, unlimited + CSV export on Pro) with a `/dashboard/plan` page and a
"Plan" nav item, matching the pattern qkit and paykit already ship.

**Architecture:** One new `plan` column on `stockkit.vendors` (default
`'free'`). A small entitlements module (`src/lib/plan.ts`) mirrors qkit's
shape. Gating happens in existing server actions (`saveProduct`,
`getProductMovements`) plus one new action (`exportProductMovementsCsv`).
Upgrade requests go through the existing `merqo.submit_support_message`
RPC (`src/lib/merqo-support.ts`) — no payment processor, no new table.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase
(`@supabase/ssr`), Zod, Vitest + Testing Library, shadcn/ui.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`.
- Validate all user input with Zod at every boundary (forms + server actions).
- Authorization lives in RLS policies, not app code — but this plan adds
  no new RLS-sensitive surface (the `plan` column read is covered by the
  existing `vendors_self_select` policy).
- Comment hygiene: own-line comments only, no trailing inline comments
  (`no-inline-comments: error`); no committed dead/commented-out code
  (`sonarjs/no-commented-code: error`).
- `font-mono` on every quantity/cost figure shown to the vendor (this
  repo's one deliberate typographic signature) — apply it to the plan
  page's price display.
- After editing the schema, update `src/lib/types.ts` to match (this repo
  has no `supabase gen types` step — types are hand-maintained).
- Design doc for this feature: `docs/superpowers/specs/2026-07-30-plan-tier-page-design.md`.
  Pricing/philosophy source of truth: `../../../docs/business/2026-07-30-cross-kit-pricing-and-billing-plan.md`.

---

### Task 1: `plan` column + type update

**Files:**

- Create: `supabase/migrations/0009_vendor_plan.sql`
- Modify: `src/lib/types.ts:11-31` (the `vendors` table shape)

**Interfaces:**

- Produces: `Vendor.plan: 'free' | 'pro'` — every later task reads this
  field off a `Vendor` row.

- [ ] **Step 1: Write the migration**

```sql
-- 0009_vendor_plan.sql
-- Free/Pro vendor tier. Default 'free' — every existing vendor stays Free
-- until manually upgraded (no self-serve billing yet, see
-- docs/business/2026-07-30-cross-kit-pricing-and-billing-plan.md).
ALTER TABLE stockkit.vendors
  ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'pro'));
```

- [ ] **Step 2: Apply it locally**

Run: `supabase migration up` (or this repo's equivalent local-apply
command — check `package.json`/`AGENTS.md` for the exact one if
`supabase migration up` isn't it).
Expected: migration applies with no error; `\d stockkit.vendors` in
`psql`/Supabase Studio shows the new `plan` column.

- [ ] **Step 3: Update the hand-maintained type**

In `src/lib/types.ts`, add `plan: 'free' | 'pro';` to the `vendors.Row`
type, `plan?: 'free' | 'pro';` to `Insert` (has a DB default), and
`plan?: 'free' | 'pro';` to `Update`.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no consumer references `plan` yet, so nothing should break).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0009_vendor_plan.sql src/lib/types.ts
git commit -m "feat: add plan column to stockkit.vendors"
```

---

### Task 2: Entitlements module

**Files:**

- Create: `src/lib/plan.ts`
- Test: `src/lib/plan.test.ts`

**Interfaces:**

- Consumes: nothing (pure module).
- Produces: `export type Tier = 'free' | 'pro'`, `export interface
Entitlement { tier: Tier; maxActiveProducts: number | null;
movementHistoryLimit: number | null; csvExport: boolean }`,
  `export const ENTITLEMENTS: Record<Tier, Entitlement>`,
  `export function normalizePlan(value: unknown): Tier`. Task 3 and Task 4
  consume `ENTITLEMENTS`; Task 5 consumes all of the above.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/plan.test.ts
import { describe, expect, it } from 'vitest';
import { ENTITLEMENTS, normalizePlan } from './plan';

describe('normalizePlan', () => {
  it('returns "pro" only for the exact string "pro"', () => {
    expect(normalizePlan('pro')).toBe('pro');
  });

  it('coerces anything else to "free"', () => {
    expect(normalizePlan('free')).toBe('free');
    expect(normalizePlan(undefined)).toBe('free');
    expect(normalizePlan(null)).toBe('free');
    expect(normalizePlan('PRO')).toBe('free');
    expect(normalizePlan(123)).toBe('free');
  });
});

describe('ENTITLEMENTS', () => {
  it('caps Free at 20 products, 10-row movement history, no CSV export', () => {
    expect(ENTITLEMENTS.free).toEqual({
      tier: 'free',
      maxActiveProducts: 20,
      movementHistoryLimit: 10,
      csvExport: false,
    });
  });

  it('gives Pro unlimited products and history, plus CSV export', () => {
    expect(ENTITLEMENTS.pro).toEqual({
      tier: 'pro',
      maxActiveProducts: null,
      movementHistoryLimit: null,
      csvExport: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/plan.test.ts`
Expected: FAIL — `Cannot find module './plan'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/plan.ts
export type Tier = 'free' | 'pro';

/**
 * A vendor's resolved capabilities. `null` on a cap means unlimited —
 * `null` (not Infinity) so the object serializes cleanly across the
 * server->client boundary for gating UI. Mirrors qkit's src/lib/plan.ts
 * shape, sized to stockkit's 2 real gates.
 */
export interface Entitlement {
  tier: Tier;
  maxActiveProducts: number | null;
  movementHistoryLimit: number | null;
  csvExport: boolean;
}

const FREE: Entitlement = {
  tier: 'free',
  maxActiveProducts: 20,
  movementHistoryLimit: 10,
  csvExport: false,
};

const PRO: Entitlement = {
  tier: 'pro',
  maxActiveProducts: null,
  movementHistoryLimit: null,
  csvExport: true,
};

export const ENTITLEMENTS: Record<Tier, Entitlement> = { free: FREE, pro: PRO };

/**
 * Coerce an untrusted plan value to a known Tier. Anything that isn't
 * exactly 'pro' degrades to 'free', so gating never crashes on a bad or
 * missing value.
 */
export function normalizePlan(value: unknown): Tier {
  return value === 'pro' ? 'pro' : 'free';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/plan.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan.ts src/lib/plan.test.ts
git commit -m "feat: add stockkit Free/Pro entitlements module"
```

---

### Task 3: Product-cap gate in `saveProduct`

**Files:**

- Modify: `src/app/dashboard/products/actions.ts:28-88` (the `saveProduct`
  insert branch only — never the update branch)
- Test: Create `src/app/dashboard/products/actions.test.ts`

**Interfaces:**

- Consumes: `ENTITLEMENTS`, `normalizePlan` from `@/lib/plan` (Task 2).
- Produces: no new exports — `saveProduct`'s existing signature/return
  type (`SaveProductResult`) is unchanged, it just gains a new failure
  case.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/dashboard/products/actions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getUserMock,
  fromMock,
  selectMock,
  eqMock,
  headMock,
  insertMock,
  insertSelectMock,
  singleMock,
  updateMock,
  updateEqMock,
  updateSelectMock,
  maybeSingleMock,
  createServerClientMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  headMock: vi.fn(),
  insertMock: vi.fn(),
  insertSelectMock: vi.fn(),
  singleMock: vi.fn(),
  updateMock: vi.fn(),
  updateEqMock: vi.fn(),
  updateSelectMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

function freshProductRow() {
  return {
    name: 'Kopi O',
    unit: 'unit',
    unit_cost_cents: 100,
    on_hand: 0,
    low_stock_threshold: 0,
    is_active: true,
  };
}

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: 'v1' } } });

  // vendors plan lookup: from('vendors').select('plan').eq('id', ...).single()
  singleMock.mockReset().mockResolvedValue({ data: { plan: 'free' }, error: null });

  // active-product count: from('products').select('id', {count:'exact', head:true}).eq('vendor_id',...).eq('is_active', true)
  headMock.mockReset().mockResolvedValue({ count: 0, error: null });
  eqMock.mockReset().mockReturnValue({ eq: eqMock, single: singleMock, head: headMock });
  selectMock.mockReset().mockReturnValue({ eq: eqMock, single: singleMock });

  insertSelectMock.mockReset().mockReturnValue({ single: singleMock });
  insertMock.mockReset().mockReturnValue({ select: insertSelectMock });

  updateSelectMock.mockReset().mockReturnValue({ maybeSingle: maybeSingleMock });
  updateEqMock.mockReset().mockReturnValue({ select: updateSelectMock });
  updateMock.mockReset().mockReturnValue({ eq: updateEqMock });
  maybeSingleMock.mockReset().mockResolvedValue({ data: { id: 'p1' }, error: null });

  fromMock.mockReset().mockImplementation((table: string) => ({
    select: selectMock,
    insert: insertMock,
    update: updateMock,
  }));

  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    from: fromMock,
  });
});

describe('saveProduct — active-product cap', () => {
  it('rejects a new product on Free once the vendor already has 20 active products', async () => {
    singleMock
      .mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'p-new' }, error: null });
    headMock.mockResolvedValue({ count: 20, error: null });

    const { saveProduct } = await import('./actions');
    const result = await saveProduct(freshProductRow());

    expect(result).toEqual({
      success: false,
      error: "You've hit the Free plan's 20-product limit. Upgrade to Pro for unlimited products.",
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('allows a new product on Free when under the cap', async () => {
    singleMock
      .mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'p-new' }, error: null });
    headMock.mockResolvedValue({ count: 19, error: null });

    const { saveProduct } = await import('./actions');
    const result = await saveProduct(freshProductRow());

    expect(result).toEqual({ success: true, productId: 'p-new' });
  });

  it('allows unlimited new products on Pro regardless of count', async () => {
    singleMock
      .mockResolvedValueOnce({ data: { plan: 'pro' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'p-new' }, error: null });
    headMock.mockResolvedValue({ count: 500, error: null });

    const { saveProduct } = await import('./actions');
    const result = await saveProduct(freshProductRow());

    expect(result).toEqual({ success: true, productId: 'p-new' });
  });

  it('never checks the cap when updating an existing product', async () => {
    const { saveProduct } = await import('./actions');
    const result = await saveProduct({ ...freshProductRow(), id: 'p1' });

    expect(result).toEqual({ success: true, productId: 'p1' });
    expect(headMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/app/dashboard/products/actions.test.ts`
Expected: FAIL — the cap doesn't exist yet, so the over-cap test gets a
success result instead of the expected rejection.

- [ ] **Step 3: Implement the cap check**

In `src/app/dashboard/products/actions.ts`, add the import and insert the
check right before the existing insert block (after the `if (data.id)`
early-return branch, so it only runs on create):

```typescript
import { ENTITLEMENTS, normalizePlan } from '@/lib/plan';
```

Then, immediately before the `const { data: inserted, error } = await
supabase.from('products').insert(...)` block:

```typescript
const { data: vendorRow } = await supabase
  .from('vendors')
  .select('plan')
  .eq('id', user.id)
  .single();
const entitlement = ENTITLEMENTS[normalizePlan(vendorRow?.plan)];

if (entitlement.maxActiveProducts !== null) {
  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', user.id)
    .eq('is_active', true);
  if ((count ?? 0) >= entitlement.maxActiveProducts) {
    return {
      success: false,
      error: `You've hit the Free plan's ${entitlement.maxActiveProducts}-product limit. Upgrade to Pro for unlimited products.`,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/app/dashboard/products/actions.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Run the full existing product-form test suite to check for regressions**

Run: `pnpm vitest run src/app/dashboard/products`
Expected: PASS — `product-form.dom.test.tsx` and `stock-log-form.dom.test.tsx`
still pass unchanged (they don't exercise the cap path since their mocks
don't model the new `vendors`/`plan` lookup — if either breaks, check
whether they mock `supabase.from` narrowly enough that the new `vendors`
select call needs a matching mock added there too).

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/products/actions.ts src/app/dashboard/products/actions.test.ts
git commit -m "feat: cap new products at 20 on the Free plan"
```

---

### Task 4: Movement-history plan-based limit + CSV export

**Files:**

- Modify: `src/app/dashboard/products/actions.ts` (`getProductMovements`)
- Modify: `src/app/dashboard/products/actions.test.ts` (extend from Task 3)

**Interfaces:**

- Consumes: `ENTITLEMENTS`, `normalizePlan` from `@/lib/plan` (Task 2).
- Produces: `getProductMovements` keeps its existing signature/return
  type. New: `export async function exportProductMovementsCsv(productId:
string): Promise<ActionResult<{ csv: string }>>` — Task 5's plan page
  doesn't consume this directly (it lives on the product detail view, out
  of this plan's UI-wiring scope beyond the action itself; wiring a
  download button onto `product-detail.tsx` is a natural follow-up but is
  UI polish, not required for the plan-tier feature to be complete —
  skip it here and note it as a follow-up in the final commit message if
  time-boxed).

- [ ] **Step 1: Write the failing tests**

Add to `src/app/dashboard/products/actions.test.ts`:

```typescript
describe('getProductMovements — plan-based history limit', () => {
  it('caps at 10 rows on Free', async () => {
    singleMock.mockResolvedValueOnce({ data: { plan: 'free' }, error: null });
    const orderMock = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    eqMock.mockReturnValueOnce({ order: orderMock });
    selectMock.mockReturnValueOnce({ eq: eqMock });

    const { getProductMovements } = await import('./actions');
    await getProductMovements('11111111-1111-1111-1111-111111111111');

    const limitMock = orderMock.mock.results[0]!.value.limit;
    expect(limitMock).toHaveBeenCalledWith(10);
  });

  it('fetches unlimited rows on Pro (no .limit call)', async () => {
    singleMock.mockResolvedValueOnce({ data: { plan: 'pro' }, error: null });
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    eqMock.mockReturnValueOnce({ order: orderMock });
    selectMock.mockReturnValueOnce({ eq: eqMock });

    const { getProductMovements } = await import('./actions');
    await getProductMovements('11111111-1111-1111-1111-111111111111');

    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});

describe('exportProductMovementsCsv', () => {
  it('rejects on Free with a friendly error', async () => {
    singleMock.mockResolvedValueOnce({ data: { plan: 'free' }, error: null });

    const { exportProductMovementsCsv } = await import('./actions');
    const result = await exportProductMovementsCsv('11111111-1111-1111-1111-111111111111');

    expect(result).toEqual({
      success: false,
      error: 'CSV export is a Pro feature. Upgrade to export your full stock history.',
    });
  });

  it('returns CSV content on Pro', async () => {
    singleMock.mockResolvedValueOnce({ data: { plan: 'pro' }, error: null });
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'm1',
          created_at: '2026-07-01T00:00:00Z',
          reason: 'restock',
          delta: 5,
          note: null,
        },
      ],
      error: null,
    });
    eqMock.mockReturnValueOnce({ order: orderMock });
    selectMock.mockReturnValueOnce({ eq: eqMock });

    const { exportProductMovementsCsv } = await import('./actions');
    const result = await exportProductMovementsCsv('11111111-1111-1111-1111-111111111111');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.csv).toContain('date,reason,delta,note');
      expect(result.csv).toContain('restock');
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/app/dashboard/products/actions.test.ts`
Expected: FAIL — `getProductMovements` still hardcodes `.limit(10)`
unconditionally (so the Pro no-limit test fails), and
`exportProductMovementsCsv` doesn't exist yet.

- [ ] **Step 3: Implement**

Replace the existing `getProductMovements` body's final query (the part
after the `if (!z.string().uuid()...)` guard) with a plan-aware version,
and add the new export action below it:

```typescript
async function vendorEntitlement(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  vendorId: string
) {
  const { data } = await supabase.from('vendors').select('plan').eq('id', vendorId).single();
  return ENTITLEMENTS[normalizePlan(data?.plan)];
}

export async function getProductMovements(productId: string): Promise<GetMovementsResult> {
  if (!z.string().uuid().safeParse(productId).success)
    return { success: false, error: 'Invalid product' };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const entitlement = await vendorEntitlement(supabase, user.id);
  let query = supabase
    .from('stock_movements')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  if (entitlement.movementHistoryLimit !== null) {
    query = query.limit(entitlement.movementHistoryLimit);
  }
  const { data, error } = await query;
  if (error) return { success: false, error: 'Could not load history' };

  return { success: true, movements: data ?? [] };
}

type ExportCsvResult = ActionResult<{ csv: string }>;

/** Full stock-movement ledger for one product, Pro-only. */
export async function exportProductMovementsCsv(productId: string): Promise<ExportCsvResult> {
  if (!z.string().uuid().safeParse(productId).success)
    return { success: false, error: 'Invalid product' };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const entitlement = await vendorEntitlement(supabase, user.id);
  if (!entitlement.csvExport) {
    return {
      success: false,
      error: 'CSV export is a Pro feature. Upgrade to export your full stock history.',
    };
  }

  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  if (error) return { success: false, error: 'Could not export history' };

  const rows = (data ?? []).map((m) =>
    [m.created_at, m.reason, String(m.delta), m.note ?? ''].join(',')
  );
  const csv = ['date,reason,delta,note', ...rows].join('\n');
  return { success: true, csv };
}
```

Note the test's mock chain assumes `.select().eq().order()` returns a
thenable directly when unlimited, and `.select().eq().order().limit()`
when capped — since `query.limit(...)` is only called conditionally, the
implementation above builds the query with the Supabase query builder's
chainable `.limit()`, which is safe to call conditionally in real Supabase
JS (it returns the same builder type either way) — the test's mock
structure mirrors that by having `order` return an object with both a
`limit` method and being awaitable itself. If the actual Supabase client
mock shape in this codebase differs, adjust the test mocks to match the
project's existing `products/actions.test.ts`-equivalent conventions
rather than the sketch above verbatim — the sketch establishes intent and
assertions, the exact mock plumbing should match whatever pattern
Step 1's author finds already works after running Step 2.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/app/dashboard/products/actions.test.ts`
Expected: PASS, all tests from Task 3 and Task 4

- [ ] **Step 5: Typecheck and full test suite**

Run: `pnpm check && pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/products/actions.ts src/app/dashboard/products/actions.test.ts
git commit -m "feat: gate movement history depth and CSV export by plan"
```

---

### Task 5: Plan page + upgrade CTA + server action

**Files:**

- Create: `src/app/actions/plan.ts`
- Test: `src/app/actions/plan.test.ts`
- Create: `src/app/dashboard/plan/page.tsx`
- Create: `src/app/dashboard/plan/upgrade-cta.tsx`
- Modify: `src/lib/constants/routes.ts` (add `PLAN` route)

**Interfaces:**

- Consumes: `submitSupportMessage` from `@/lib/merqo-support` (existing),
  `ENTITLEMENTS`/`normalizePlan` from `@/lib/plan` (Task 2), `BackButton`
  from `@/components/back-button` (existing, ported earlier this session),
  `ActionResult` from `@/lib/action-result` (existing).
- Produces: `export async function requestProUpgradeAction():
Promise<ActionResult>` — Task 6 doesn't consume this, only the page/nav
  link to `/dashboard/plan` matters there.

- [ ] **Step 1: Write the failing test for the server action**

```typescript
// src/app/actions/plan.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUserMock, submitSupportMessageMock, createServerClientMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  submitSupportMessageMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}));
vi.mock('@/lib/merqo-support', () => ({
  submitSupportMessage: submitSupportMessageMock,
}));

beforeEach(() => {
  getUserMock.mockReset();
  submitSupportMessageMock.mockReset().mockResolvedValue(undefined);
  createServerClientMock.mockReset().mockResolvedValue({ auth: { getUser: getUserMock } });
});

describe('requestProUpgradeAction', () => {
  it('files a billing support message for the signed-in vendor', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'v1' } } });

    const { requestProUpgradeAction } = await import('./plan');
    const result = await requestProUpgradeAction();

    expect(result).toEqual({ success: true });
    expect(submitSupportMessageMock).toHaveBeenCalledWith(
      expect.anything(),
      'billing',
      'Requesting an upgrade to the Pro plan.'
    );
  });

  it('rejects when no vendor is signed in', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const { requestProUpgradeAction } = await import('./plan');
    const result = await requestProUpgradeAction();

    expect(result).toEqual({ success: false, error: 'Please sign in first' });
    expect(submitSupportMessageMock).not.toHaveBeenCalled();
  });

  it('returns a friendly error if the RPC throws', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'v1' } } });
    submitSupportMessageMock.mockRejectedValue(new Error('rpc down'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { requestProUpgradeAction } = await import('./plan');
    const result = await requestProUpgradeAction();

    expect(result).toEqual({ success: false, error: 'Could not send your request' });
    consoleError.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/actions/plan.test.ts`
Expected: FAIL — `./plan` doesn't exist.

- [ ] **Step 3: Implement the server action**

```typescript
// src/app/actions/plan.ts
'use server';

import type { ActionResult } from '@/lib/action-result';
import { submitSupportMessage } from '@/lib/merqo-support';
import { createServerClient } from '@/lib/supabase/server';

/**
 * "Ask us to upgrade to Pro" CTA on the plan page. stockkit has no
 * self-serve billing yet — this files the request through the same
 * merqo.submit_support_message mechanism the account-menu "Get help"
 * flow already uses (category "billing"), mirroring paykit's identical
 * pattern (src/app/actions/plan.ts there).
 */
export async function requestProUpgradeAction(): Promise<ActionResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Please sign in first' };

  try {
    await submitSupportMessage(supabase, 'billing', 'Requesting an upgrade to the Pro plan.');
  } catch (err) {
    console.error('requestProUpgradeAction failed', err instanceof Error ? err.message : err);
    return { success: false, error: 'Could not send your request' };
  }
  return { success: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/app/actions/plan.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Add the `PLAN` route constant**

In `src/lib/constants/routes.ts`, add `PLAN: '/dashboard/plan',` to
`PAGE_ROUTES`.

- [ ] **Step 6: Build the upgrade CTA component**

```typescript
// src/app/dashboard/plan/upgrade-cta.tsx
'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { requestProUpgradeAction } from '@/app/actions/plan';

/**
 * Interest CTA for the Pro plan. Files an in-product request (no payment
 * provider — stockkit has no self-serve billing yet); Pro is granted
 * manually. Mirrors paykit's identical UpgradeCta pattern.
 */
export function UpgradeCta() {
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      const res = await requestProUpgradeAction();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Request sent. We'll set you up shortly.");
    });
  }

  return (
    <Button size="sm" disabled={pending} onClick={onClick} className="mt-3 rounded-lg">
      {pending ? 'Sending…' : 'Ask us to upgrade to Pro'}
    </Button>
  );
}
```

- [ ] **Step 7: Build the plan page**

```typescript
// src/app/dashboard/plan/page.tsx
import { redirect } from 'next/navigation';

import { BackButton } from '@/components/back-button';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { ENTITLEMENTS, normalizePlan } from '@/lib/plan';
import { createServerClient } from '@/lib/supabase/server';
import { UpgradeCta } from './upgrade-cta';

export const revalidate = 0;

const PRO_PRICE = '$14/mo';

export default async function PlanPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: vendorRow } = await supabase
    .from('vendors')
    .select('plan')
    .eq('id', user.id)
    .single();
  const plan = normalizePlan(vendorRow?.plan);
  const entitlement = ENTITLEMENTS[plan];

  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <BackButton href={PAGE_ROUTES.DASHBOARD} label="Dashboard" />
      <header>
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
          Your account
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Plan</h1>
      </header>

      <div className="border-border rounded-xl border p-4">
        <p className="text-sm font-medium">
          Current plan: <span className="capitalize">{plan}</span>
        </p>
      </div>

      <div className="border-border rounded-xl border p-4">
        <p className="text-sm font-medium">{plan === 'pro' ? 'Pro' : 'Free'}</p>
        <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
          <li>
            {entitlement.maxActiveProducts === null
              ? 'Unlimited products'
              : `Up to ${entitlement.maxActiveProducts} active products`}
          </li>
          <li>
            {entitlement.movementHistoryLimit === null
              ? 'Full stock movement history'
              : `Last ${entitlement.movementHistoryLimit} stock movements per product`}
          </li>
          {entitlement.csvExport && <li>CSV export</li>}
          {plan === 'pro' && <li>Valuation trend reports (coming soon)</li>}
        </ul>
        {plan === 'free' && (
          <div className="mt-3">
            <p className="text-muted-foreground text-sm">
              Ask us to upgrade your account to Pro for unlimited products, full history, and CSV
              export, <span className="font-mono">{PRO_PRICE}</span>.
            </p>
            <UpgradeCta />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Manual check**

Run: `pnpm dev`, sign in as a test vendor, visit `/dashboard/plan`.
Expected: page renders, shows "Current plan: free", the Free feature
list (20 products, 10 movements, no CSV export line), and the upgrade
button; clicking it shows a success toast.

- [ ] **Step 9: Typecheck and lint**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/app/actions/plan.ts src/app/actions/plan.test.ts src/app/dashboard/plan/page.tsx src/app/dashboard/plan/upgrade-cta.tsx src/lib/constants/routes.ts
git commit -m "feat: add stockkit plan page with Pro upgrade request"
```

---

### Task 6: Nav "Plan" item

**Files:**

- Modify: `src/app/dashboard/dashboard-nav.tsx` (top comment + dropdown items)
- Modify: `src/app/dashboard/dashboard-nav.dom.test.tsx` (existing file, extend)

**Interfaces:**

- Consumes: `PAGE_ROUTES.PLAN` (Task 5).
- Produces: nothing new — this is the last piece of the user-facing surface.

- [ ] **Step 1: Write the failing test**

Find the existing test in `dashboard-nav.dom.test.tsx` that asserts the
Profile link renders (search for `'Profile'` or `href.*profile`), and add
a sibling assertion immediately after it in the same `it` block or a new
one following the same pattern already used in that file:

```typescript
it('renders a Plan link to /dashboard/plan', async () => {
  render(<DashboardNav vendorName="Test Vendor" />);
  await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
  const planLink = screen.getByRole('menuitem', { name: /plan/i });
  expect(planLink).toHaveAttribute('href', '/dashboard/plan');
});
```

Adjust the exact `render`/query calls to match this file's actual existing
conventions (import list, whether `DashboardNav` needs more props, how
the dropdown is opened in other tests in the same file) — copy the
pattern from the neighboring Profile-link test rather than inventing a
new one.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/dashboard/dashboard-nav.dom.test.tsx`
Expected: FAIL — no "Plan" menu item exists yet.

- [ ] **Step 3: Add the Plan item and remove the stale comment**

In `dashboard-nav.tsx`, update the top comment block (remove the last
sentence: `No Plan item — stockkit has no vendor-tier concept (sanctioned
skip, see this plan's Global Constraints).`), and add a new
`DropdownMenuItem` between the existing Profile item and the "Get help"
item:

```typescript
              <DropdownMenuItem asChild>
                <Link href={PAGE_ROUTES.PLAN} className="cursor-pointer">
                  <Wallet className="size-4" />
                  Plan
                </Link>
              </DropdownMenuItem>
```

Add `Wallet` to the existing `lucide-react` import list (alongside
`LifeBuoy, LogOut, Menu, MessageSquarePlus, User, X`), and import
`PAGE_ROUTES` if not already imported (it already is, per the file's
existing `LINKS` array).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/app/dashboard/dashboard-nav.dom.test.tsx`
Expected: PASS

- [ ] **Step 5: Full check**

Run: `pnpm check && pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/dashboard-nav.tsx src/app/dashboard/dashboard-nav.dom.test.tsx
git commit -m "feat: add Plan item to dashboard nav"
```

---

### Task 7: Update the locked cross-kit nav-standard doc

**Files:**

- Modify: `../../../docs/business/2026-07-21-dashboard-nav-standard.md`
  (the per-kit gap-checklist table's stockkit row)

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update the table row**

Find the row:

```
| stockkit | full nav rebuilt: burger, mobile panel, avatar dropdown, Profile/Get help (mailto, interim)/Feedback (drawer)/Sign out — no Plan item, correctly (no vendor-tier concept) | nothing |
```

Change it to:

```
| stockkit | full nav rebuilt: burger, mobile panel, avatar dropdown, Profile/Plan/Get help (mailto, interim)/Feedback (drawer)/Sign out | nothing |
```

- [ ] **Step 2: Commit**

This file lives outside any git repo (top-level `docs/business/` is flat
files, not version-controlled — confirmed via `git rev-parse
--show-toplevel` failing there). No commit step — just save the edit.

---

## Final check

- [ ] Run `pnpm build` in `stockkit/` (this project's convention requires
      a full Next.js build before shipping client-side changes, since
      `pnpm check`/`pnpm test` miss client/server bundle-boundary errors).
      Expected: PASS, `/dashboard/plan` appears in the route list.
- [ ] Run `pnpm test` one final time for the whole suite.
      Expected: PASS, no regressions in `products/actions.test.ts`,
      `dashboard-nav.dom.test.tsx`, or elsewhere.
