# Stock-Take / Cycle-Count Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a vendor count every active product in one pass and submit the whole batch as one atomic, traceable session, instead of N separate one-at-a-time `adjustment` movements with no shared marker or variance summary.

**Architecture:** A new `stockkit.stock_take_sessions` table groups movements via a nullable `session_id` FK added to `stock_movements`. A new `stockkit.record_stock_take(p_note, p_lines)` RPC creates the session and applies every counted line inside one function body (one implicit transaction — a bad line rolls back the entire session, including the session row itself). The Next.js side follows the exact same layering as the existing products feature: Zod schema → server action calling the RPC → a client component checklist page.

**Tech Stack:** Next.js 16 Server Components + Server Actions, Supabase (`@supabase/ssr`, Postgres RLS), Zod, Vitest + Testing Library, pgTAP (`supabase test db`).

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`.
- Validate all user input with Zod at every boundary (forms + server actions).
- Authorization lives in RLS policies, not app code — never widen a policy to "fix" a query.
- Use the service-role client only when genuinely bypassing RLS is required — nothing in this feature needs it; every read/write here goes through the RLS-scoped `createServerClient()`.
- After editing the schema, update both `supabase/migrations/` and `src/lib/types.ts`.
- Comment hygiene: own-line comments only (no trailing inline comments); no committed dead/commented-out code.
- `font-mono` on every quantity/cost figure shown to the vendor.
- Tests: `*.dom.test.tsx` for full RTL+jsdom component-render tests, `*.test.ts` for logic-only tests.

---

## File Structure

- Create: `supabase/migrations/0006_stock_take_sessions.sql` — table, column, RLS, grants.
- Create: `supabase/migrations/0007_record_stock_take.sql` — the RPC.
- Modify: `supabase/tests/rls.test.sql` — new fixtures/assertions for the table and RPC.
- Modify: `src/lib/types.ts` — `stock_take_sessions` table shape, `session_id` on `stock_movements`, `record_stock_take` function shape, `StockTakeSession` export.
- Create: `src/lib/stock-take.ts` — pure `computeVariance` helper + `VarianceLine`/`StockTakeLine` types.
- Create: `src/lib/stock-take.test.ts` — unit tests for `computeVariance`.
- Modify: `src/lib/schemas.ts` — `stockTakeLineSchema`/`stockTakeFormSchema`.
- Modify: `src/lib/schemas.test.ts` — validation tests for the new schema.
- Create: `src/app/dashboard/stock-take/actions.ts` — `recordStockTake` server action.
- Create: `src/app/dashboard/stock-take/actions.test.ts` — mocked-Supabase tests for the action.
- Create: `src/app/dashboard/stock-take/page.tsx` — server-fetch page (`revalidate = 0`).
- Create: `src/app/dashboard/stock-take/stock-take-checklist.tsx` — client checklist + variance summary.
- Create: `src/app/dashboard/stock-take/stock-take-checklist.dom.test.tsx` — RTL tests.
- Modify: `src/lib/constants/routes.ts` — `PAGE_ROUTES.STOCK_TAKE`.
- Modify: `src/app/dashboard/products/products-workspace.tsx` — entry-point link (products currently has no other nav path either; it's reached only via the overview page's "View all products" link, so a "Start a stock take" link from the products workspace header follows the same established pattern).
- Modify: `README.md`, `src/app/dashboard/README.md`, `supabase/migrations/README.md`, `supabase/README.md`, `CHANGELOG.md` — doc coupling (this repo's CI hard-gates README-per-changed-folder and a CHANGELOG entry for any `src/` change).
- Create: `src/app/dashboard/stock-take/README.md`.

---

### Task 1: Migration — `stock_take_sessions` table + RLS + pgTAP

**Files:**

- Create: `supabase/migrations/0006_stock_take_sessions.sql`
- Modify: `src/lib/types.ts`
- Modify: `supabase/tests/rls.test.sql`

**Interfaces:**

- Produces: table `stockkit.stock_take_sessions(id uuid pk, vendor_id uuid, started_at timestamptz, completed_at timestamptz null, note text null)`; new nullable column `stockkit.stock_movements.session_id uuid references stock_take_sessions(id)`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0006_stock_take_sessions.sql
-- Groups a batch physical-count session's stock_movements rows so a vendor
-- can see "what changed in this count" instead of scattered ad-hoc
-- adjustments. session_id is nullable on stock_movements — every other
-- movement reason (restock/waste/adjustment/initial) leaves it null.
CREATE TABLE stockkit.stock_take_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     UUID        NOT NULL REFERENCES stockkit.vendors(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  note          TEXT
);

ALTER TABLE stockkit.stock_movements
  ADD COLUMN session_id UUID REFERENCES stockkit.stock_take_sessions(id);

ALTER TABLE stockkit.stock_take_sessions ENABLE ROW LEVEL SECURITY;

grant select, insert, update on stockkit.stock_take_sessions to authenticated;
grant all on stockkit.stock_take_sessions to service_role;

-- vendor-owns-own-row, matching products_vendor_all's shape.
CREATE POLICY "stock_take_sessions_vendor_all" ON stockkit.stock_take_sessions
  FOR ALL
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());
```

- [ ] **Step 2: Update `src/lib/types.ts`**

Add to `Database['stockkit']['Tables']` (alongside the existing `feedback` entry):

```typescript
stock_take_sessions: {
  Row: {
    id: string;
    vendor_id: string;
    started_at: string;
    completed_at: string | null;
    note: string | null;
  };
  Insert: {
    id?: string;
    vendor_id: string;
    started_at?: string;
    completed_at?: string | null;
    note?: string | null;
  };
  Update: {
    id?: string;
    vendor_id?: string;
    started_at?: string;
    completed_at?: string | null;
    note?: string | null;
  };
  Relationships: [
    {
      foreignKeyName: 'stock_take_sessions_vendor_id_fkey';
      columns: ['vendor_id'];
      referencedRelation: 'vendors';
      referencedColumns: ['id'];
    },
  ];
};
```

Add `session_id: string | null;` to `stock_movements`'s `Row`, `session_id?: string | null;` to its `Insert`/`Update`, and add this entry to `stock_movements`'s `Relationships` array (alongside the existing two):

```typescript
{
  foreignKeyName: 'stock_movements_session_id_fkey';
  columns: ['session_id'];
  referencedRelation: 'stock_take_sessions';
  referencedColumns: ['id'];
},
```

Add near the bottom, alongside the other type exports:

```typescript
export type StockTakeSession = Database['stockkit']['Tables']['stock_take_sessions']['Row'];
```

- [ ] **Step 3: Run typecheck to confirm the type edit compiles**

Run: `pnpm typecheck`
Expected: no errors (this is a pure type addition, nothing consumes it yet).

- [ ] **Step 4: Add pgTAP fixtures/assertions**

In `supabase/tests/rls.test.sql`, change the plan count from `select plan(27);` to `select plan(36);` (9 new assertions added below).

Immediately after the existing RLS-enabled checks near the top (after the `RLS on feedback` line), add:

```sql
select ok((select relrowsecurity from pg_class where oid = 'stockkit.stock_take_sessions'::regclass), 'RLS on stock_take_sessions');
```

Immediately before the `-- ── Act as Vendor B ...` section comment (so this still runs while acting as Vendor A), add:

```sql
-- ── stock_take_sessions + record_stock_take (added 2026-07-26) ──────────────
insert into stockkit.products (id, vendor_id, name, unit_cost_cents, on_hand, low_stock_threshold)
values ('00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-00000000000a', 'Stock-take Product', 150, 20, 5);

select lives_ok(
  $$ select stockkit.record_stock_take(
       'Nightly count',
       '[{"product_id":"00000000-0000-0000-0000-0000000c0003","counted_qty":18}]'::jsonb) $$,
  'A can run a stock take on its own product');

select is(
  (select on_hand from stockkit.products where id = '00000000-0000-0000-0000-0000000c0003'),
  18::numeric,
  'stock take applied the counted quantity');

select is(
  (select count(*)::int from stockkit.stock_movements
   where product_id = '00000000-0000-0000-0000-0000000c0003' and reason = 'adjustment' and session_id is not null),
  1,
  'stock take wrote one session-tagged adjustment movement');

select throws_ok(
  $$ select stockkit.record_stock_take(
       'Bad line',
       '[{"product_id":"00000000-0000-0000-0000-0000000c0003","counted_qty":5},
         {"product_id":"00000000-0000-0000-0000-0000000c0002","counted_qty":1}]'::jsonb) $$,
  'P0001',
  null,
  'a stock take touching a product A does not own rolls back the whole call');

select is(
  (select on_hand from stockkit.products where id = '00000000-0000-0000-0000-0000000c0003'),
  18::numeric,
  'the valid line from the failed stock take was rolled back too (still 18, not 5)');

select is(
  (select count(*)::int from stockkit.stock_take_sessions where note = 'Bad line'),
  0,
  'the session row from the failed stock take was rolled back too');

select throws_ok(
  $$ insert into stockkit.stock_take_sessions (vendor_id, note) values ('00000000-0000-0000-0000-00000000000b', 'sneaky') $$,
  '42501',
  null,
  'A cannot insert a stock_take_sessions row owned by B');
```

In the `-- ── Act as Vendor B ...` section, add this alongside the existing two Vendor-B assertions:

```sql
select is_empty(
  $$ select 1 from stockkit.stock_take_sessions where vendor_id = '00000000-0000-0000-0000-00000000000a' $$,
  'B cannot read A''s stock_take_sessions rows');
```

Note: `throws_ok`'s `'P0001'` is Postgres's default SQLSTATE for a plpgsql `RAISE EXCEPTION` with no explicit code — matches how `record_stock_movement`'s own exceptions would surface, distinct from the `'42501'` (permission denied) code used for RLS/grant failures elsewhere in this file. This step requires Task 2's RPC to exist first — see the ordering note in Task 2.

- [ ] **Step 5: Run the pgTAP suite** (only possible once Task 2's RPC also exists — see Task 2 Step 5 for the actual run command; this migration alone doesn't need its own separate pgTAP run)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0006_stock_take_sessions.sql src/lib/types.ts
git commit -m "feat: add stock_take_sessions table and session_id column"
```

(The `rls.test.sql` edit is committed together with Task 2's RPC, since the new assertions call the Task 2 RPC and can't be verified independently — see Task 2 Step 6.)

---

### Task 2: Migration — `record_stock_take` RPC

**Files:**

- Create: `supabase/migrations/0007_record_stock_take.sql`
- Modify: `src/lib/types.ts`

**Interfaces:**

- Consumes: `stockkit.stock_take_sessions`, `stockkit.products` (Task 1).
- Produces: `stockkit.record_stock_take(p_note text, p_lines jsonb) RETURNS stockkit.stock_take_sessions` — callable via `supabase.rpc('record_stock_take', { p_note, p_lines })` where `p_lines` is `[{ product_id: string, counted_qty: number }]`.

- [ ] **Step 1: Write the RPC migration**

```sql
-- supabase/migrations/0007_record_stock_take.sql
-- Bulk write path for a stock-take session: creates the session row, then
-- applies every counted line inside the same function body (one implicit
-- transaction), so any single bad line — a product not found/not owned, or
-- a negative count slipping past client-side validation — rolls back the
-- entire session, including the session row itself. Mirrors
-- record_stock_movement's per-line below-zero guard, but sets on_hand
-- directly to the counted value rather than applying a delta, since a
-- stock-take's input is an absolute count, not a relative change.
CREATE OR REPLACE FUNCTION stockkit.record_stock_take(
  p_note text,
  p_lines jsonb
) RETURNS stockkit.stock_take_sessions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = stockkit
AS $$
DECLARE
  v_session stockkit.stock_take_sessions;
  v_line jsonb;
  v_product_id uuid;
  v_counted_qty numeric;
  v_product stockkit.products;
  v_delta numeric;
BEGIN
  INSERT INTO stockkit.stock_take_sessions (vendor_id, note)
  VALUES (auth.uid(), p_note)
  RETURNING * INTO v_session;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := (v_line->>'product_id')::uuid;
    v_counted_qty := (v_line->>'counted_qty')::numeric;

    IF v_counted_qty < 0 THEN
      RAISE EXCEPTION 'counted quantity cannot be negative';
    END IF;

    SELECT * INTO v_product FROM stockkit.products
    WHERE id = v_product_id AND vendor_id = auth.uid()
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product not found or not owned by caller';
    END IF;

    v_delta := v_counted_qty - v_product.on_hand;
    IF v_delta = 0 THEN
      CONTINUE;
    END IF;

    UPDATE stockkit.products
    SET on_hand = v_counted_qty, updated_at = now()
    WHERE id = v_product_id;

    INSERT INTO stockkit.stock_movements (vendor_id, product_id, delta, reason, session_id)
    VALUES (auth.uid(), v_product_id, v_delta, 'adjustment', v_session.id);
  END LOOP;

  UPDATE stockkit.stock_take_sessions
  SET completed_at = now()
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION stockkit.record_stock_take(text, jsonb) TO authenticated;
```

- [ ] **Step 2: Update `src/lib/types.ts`**

Add to `Database['stockkit']['Functions']` (alongside `record_stock_movement`):

```typescript
record_stock_take: {
  Args: {
    p_note: string | null;
    p_lines: Json;
  }
  Returns: Database['stockkit']['Tables']['stock_take_sessions']['Row'];
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Apply both migrations locally and run the pgTAP suite**

Run (requires local Supabase CLI + Docker):

```bash
supabase db reset
supabase test db
```

Expected: all 36 assertions pass, including the 9 added in Task 1 Step 4 that exercise this RPC.

If no local Supabase CLI is available in this environment (see AGENTS.md's "Project-Specific Notes" — no live Supabase project is configured in the dev/CI environment this app was built in), skip running it locally; CI's `db (migrations + pgTAP RLS)` job runs this same suite against a real Postgres instance on every push.

- [ ] **Step 5: Run the full app test suite + lint + typecheck**

Run: `pnpm check`
Expected: all pass (this task only touches SQL + types, not app logic, but confirms nothing else broke).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0007_record_stock_take.sql src/lib/types.ts supabase/tests/rls.test.sql
git commit -m "feat: add record_stock_take RPC for atomic batch counting"
```

---

### Task 3: `computeVariance` pure helper

**Files:**

- Create: `src/lib/stock-take.ts`
- Create: `src/lib/stock-take.test.ts`

**Interfaces:**

- Produces: `computeVariance(lines: StockTakeLine[]): VarianceLine[]`, `StockTakeLine`, `VarianceLine` — consumed by Task 5's server action and Task 6's checklist component.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/stock-take.test.ts
import { describe, expect, it } from 'vitest';
import { computeVariance } from './stock-take';

describe('computeVariance', () => {
  it('returns a delta for a line whose count differs from current on-hand', () => {
    const result = computeVariance([{ productId: 'p1', currentOnHand: 10, countedQty: 8 }]);
    expect(result).toEqual([{ productId: 'p1', delta: -2 }]);
  });

  it('omits a line whose count matches current on-hand (no-op)', () => {
    const result = computeVariance([{ productId: 'p1', currentOnHand: 10, countedQty: 10 }]);
    expect(result).toEqual([]);
  });

  it('handles a mix of over, under, and unchanged lines', () => {
    const result = computeVariance([
      { productId: 'over', currentOnHand: 5, countedQty: 7 },
      { productId: 'under', currentOnHand: 5, countedQty: 2 },
      { productId: 'same', currentOnHand: 5, countedQty: 5 },
    ]);
    expect(result).toEqual([
      { productId: 'over', delta: 2 },
      { productId: 'under', delta: -3 },
    ]);
  });

  it('returns an empty array for an empty input', () => {
    expect(computeVariance([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test stock-take.test.ts`
Expected: FAIL — `Cannot find module './stock-take'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/stock-take.ts
export interface StockTakeLine {
  productId: string;
  currentOnHand: number;
  countedQty: number;
}

export interface VarianceLine {
  productId: string;
  delta: number;
}

/**
 * Lines whose counted quantity differs from the current on-hand value — a
 * matching count is a no-op and is omitted, matching record_stock_take's own
 * skip-zero-delta behavior in the database.
 */
export function computeVariance(lines: StockTakeLine[]): VarianceLine[] {
  return lines
    .map((l) => ({ productId: l.productId, delta: l.countedQty - l.currentOnHand }))
    .filter((v) => v.delta !== 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test stock-take.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stock-take.ts src/lib/stock-take.test.ts
git commit -m "feat: add computeVariance pure helper for stock-take diffing"
```

---

### Task 4: `stockTakeFormSchema`

**Files:**

- Modify: `src/lib/schemas.ts`
- Modify: `src/lib/schemas.test.ts`

**Interfaces:**

- Consumes: nothing new (pure Zod, same file as `productFormSchema`/`stockMovementFormSchema`).
- Produces: `stockTakeLineSchema`, `stockTakeFormSchema`, `type StockTakeFormInput` — consumed by Task 5's server action and Task 6's checklist component.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/schemas.test.ts`:

```typescript
import { stockTakeFormSchema } from './schemas';

describe('stockTakeFormSchema', () => {
  it('accepts a single valid line', () => {
    const result = stockTakeFormSchema.safeParse({
      lines: [
        { productId: '11111111-1111-1111-1111-111111111111', currentOnHand: 10, countedQty: 8 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty lines array', () => {
    const result = stockTakeFormSchema.safeParse({ lines: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Count at least one product');
    }
  });

  it('rejects a negative countedQty', () => {
    const result = stockTakeFormSchema.safeParse({
      lines: [
        { productId: '11111111-1111-1111-1111-111111111111', currentOnHand: 10, countedQty: -1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-uuid productId', () => {
    const result = stockTakeFormSchema.safeParse({
      lines: [{ productId: 'not-a-uuid', currentOnHand: 10, countedQty: 8 }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts an optional note', () => {
    const result = stockTakeFormSchema.safeParse({
      note: 'Nightly count',
      lines: [
        { productId: '11111111-1111-1111-1111-111111111111', currentOnHand: 10, countedQty: 8 },
      ],
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test schemas.test.ts`
Expected: FAIL — `stockTakeFormSchema` is not exported from `./schemas`.

- [ ] **Step 3: Write the implementation**

In `src/lib/schemas.ts`, add near `stockMovementFormSchema`:

```typescript
export const stockTakeLineSchema = z.object({
  productId: z.string().uuid(),
  currentOnHand: z.number().nonnegative(),
  countedQty: z.number().nonnegative(),
});

export const stockTakeFormSchema = z.object({
  note: z.string().max(500).optional(),
  lines: z.array(stockTakeLineSchema).min(1, 'Count at least one product'),
});
export type StockTakeFormInput = z.infer<typeof stockTakeFormSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test schemas.test.ts`
Expected: PASS, all `stockTakeFormSchema` tests green alongside the existing `passwordChangeSchema` tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts src/lib/schemas.test.ts
git commit -m "feat: add stockTakeFormSchema"
```

---

### Task 5: `recordStockTake` server action

**Files:**

- Create: `src/app/dashboard/stock-take/actions.ts`
- Create: `src/app/dashboard/stock-take/actions.test.ts`

**Interfaces:**

- Consumes: `stockTakeFormSchema`/`StockTakeFormInput` (Task 4), `computeVariance`/`VarianceLine` (Task 3), `StockTakeSession` (Task 1), `createServerClient` (`@/lib/supabase/server`), `ActionResult<T>` (`@/lib/action-result`).
- Produces: `recordStockTake(input: StockTakeFormInput): Promise<ActionResult<{ session: StockTakeSession; variance: VarianceLine[] }>>` — consumed by Task 6's checklist component.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/dashboard/stock-take/actions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUserMock, rpcMock, createServerClientMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  rpcMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const SESSION = {
  id: 's1',
  vendor_id: 'v1',
  started_at: '2026-07-26T00:00:00Z',
  completed_at: '2026-07-26T00:00:01Z',
  note: 'Nightly count',
};

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: 'v1' } } });
  rpcMock.mockReset().mockResolvedValue({ data: SESSION, error: null });
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
  });
});

describe('recordStockTake', () => {
  it('calls the RPC with mapped lines and returns the session plus computed variance', async () => {
    const { recordStockTake } = await import('./actions');
    const result = await recordStockTake({
      note: 'Nightly count',
      lines: [
        { productId: '00000000-0000-0000-0000-0000000c0001', currentOnHand: 10, countedQty: 8 },
        { productId: '00000000-0000-0000-0000-0000000c0002', currentOnHand: 5, countedQty: 5 },
      ],
    });

    expect(rpcMock).toHaveBeenCalledWith('record_stock_take', {
      p_note: 'Nightly count',
      p_lines: [
        { product_id: '00000000-0000-0000-0000-0000000c0001', counted_qty: 8 },
        { product_id: '00000000-0000-0000-0000-0000000c0002', counted_qty: 5 },
      ],
    });
    expect(result).toEqual({
      success: true,
      session: SESSION,
      variance: [{ productId: '00000000-0000-0000-0000-0000000c0001', delta: -2 }],
    });
  });

  it('returns an error for an empty lines array without calling the RPC', async () => {
    const { recordStockTake } = await import('./actions');
    const result = await recordStockTake({ lines: [] });
    expect(result.success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns an error without calling the RPC when there's no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { recordStockTake } = await import('./actions');
    const result = await recordStockTake({
      lines: [
        { productId: '00000000-0000-0000-0000-0000000c0001', currentOnHand: 10, countedQty: 8 },
      ],
    });
    expect(result).toEqual({ success: false, error: 'Not authenticated' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('maps the RPC ownership error to a friendly message', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'product not found or not owned by caller' },
    });
    const { recordStockTake } = await import('./actions');
    const result = await recordStockTake({
      lines: [
        { productId: '00000000-0000-0000-0000-0000000c0001', currentOnHand: 10, countedQty: 8 },
      ],
    });
    expect(result).toEqual({ success: false, error: 'A product in this count could not be found' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/app/dashboard/stock-take/actions.test.ts`
Expected: FAIL — `Cannot find module './actions'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/app/dashboard/stock-take/actions.ts
'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/action-result';
import { stockTakeFormSchema, type StockTakeFormInput } from '@/lib/schemas';
import { computeVariance, type VarianceLine } from '@/lib/stock-take';
import { createServerClient } from '@/lib/supabase/server';
import type { StockTakeSession } from '@/lib/types';

type RecordStockTakeResult = ActionResult<{ session: StockTakeSession; variance: VarianceLine[] }>;

/**
 * Submits a batch of counted quantities as one atomic stock-take session via
 * stockkit.record_stock_take (migration 0007). Variance is computed here
 * from the submitted before/after pairs, not re-derived from the RPC's
 * return value — the RPC only returns the session row.
 */
export async function recordStockTake(input: StockTakeFormInput): Promise<RecordStockTakeResult> {
  const parsed = stockTakeFormSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Check the stock take details',
    };
  const data = parsed.data;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: session, error } = await supabase.rpc('record_stock_take', {
    p_note: data.note ?? null,
    p_lines: data.lines.map((l) => ({ product_id: l.productId, counted_qty: l.countedQty })),
  });

  if (error) {
    if (error.message.includes('not found or not owned'))
      return { success: false, error: 'A product in this count could not be found' };
    console.error('recordStockTake failed', error.message);
    return { success: false, error: 'Could not record stock take' };
  }
  if (!session) return { success: false, error: 'Could not record stock take' };

  revalidatePath('/dashboard', 'layout');
  return { success: true, session, variance: computeVariance(data.lines) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/app/dashboard/stock-take/actions.test.ts`
Expected: PASS, all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/stock-take/actions.ts src/app/dashboard/stock-take/actions.test.ts
git commit -m "feat: add recordStockTake server action"
```

---

### Task 6: Checklist page + entry point

**Files:**

- Create: `src/app/dashboard/stock-take/page.tsx`
- Create: `src/app/dashboard/stock-take/stock-take-checklist.tsx`
- Create: `src/app/dashboard/stock-take/stock-take-checklist.dom.test.tsx`
- Modify: `src/lib/constants/routes.ts`
- Modify: `src/app/dashboard/products/products-workspace.tsx`

**Interfaces:**

- Consumes: `recordStockTake` (Task 5), `stockTakeFormSchema` (Task 4), `computeVariance`/`VarianceLine` (Task 3), `Product` (`@/lib/types`), `useAsyncAction` (`@/hooks`).
- Produces: route `/dashboard/stock-take`; `PAGE_ROUTES.STOCK_TAKE`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/dashboard/stock-take/stock-take-checklist.dom.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/types';
import { StockTakeChecklist } from './stock-take-checklist';

const { recordStockTakeMock } = vi.hoisted(() => ({
  recordStockTakeMock: vi.fn(),
}));

vi.mock('./actions', () => ({
  recordStockTake: recordStockTakeMock,
}));

afterEach(() => cleanup());

beforeEach(() => {
  recordStockTakeMock.mockReset();
});

const PRODUCTS: Product[] = [
  {
    id: '00000000-0000-0000-0000-0000000c0001',
    vendor_id: 'v1',
    name: 'Widget',
    unit: 'unit',
    unit_cost_cents: 100,
    on_hand: 10,
    low_stock_threshold: 2,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

describe('StockTakeChecklist', () => {
  it('shows an empty message with no products', () => {
    render(<StockTakeChecklist products={[]} />);
    expect(screen.getByText(/no active products to count yet/i)).toBeTruthy();
  });

  it('disables submit until at least one count is entered', () => {
    render(<StockTakeChecklist products={PRODUCTS} />);
    expect(screen.getByRole('button', { name: /submit count/i })).toBeDisabled();
  });

  it('submits only the entered lines and shows the variance summary', async () => {
    recordStockTakeMock.mockResolvedValue({
      success: true,
      session: { id: 's1', vendor_id: 'v1', started_at: '', completed_at: '', note: null },
      variance: [{ productId: PRODUCTS[0].id, delta: -2 }],
    });
    render(<StockTakeChecklist products={PRODUCTS} />);

    fireEvent.change(screen.getByLabelText(/counted quantity for widget/i), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit count/i }));

    await waitFor(() => {
      expect(recordStockTakeMock).toHaveBeenCalledWith({
        lines: [{ productId: PRODUCTS[0].id, currentOnHand: 10, countedQty: 8 }],
      });
    });
    await waitFor(() => {
      expect(screen.getByText(/stock take complete/i)).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test stock-take-checklist.dom.test.tsx`
Expected: FAIL — `Cannot find module './stock-take-checklist'`.

- [ ] **Step 3: Add the route constant**

In `src/lib/constants/routes.ts`, add to `PAGE_ROUTES`:

```typescript
STOCK_TAKE: '/dashboard/stock-take',
```

- [ ] **Step 4: Write the checklist component**

```tsx
// src/app/dashboard/stock-take/stock-take-checklist.tsx
'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAsyncAction } from '@/hooks';
import { stockTakeFormSchema } from '@/lib/schemas';
import { computeVariance, type VarianceLine } from '@/lib/stock-take';
import type { Product } from '@/lib/types';
import { recordStockTake } from './actions';

interface Props {
  products: Product[];
}

/**
 * Counted-quantity inputs default blank (not pre-filled with current on_hand)
 * so submitting without touching a row can't accidentally record a false
 * "recount matched" — forces an actual count rather than an accidental
 * no-op tab-through, per the stock-take spec's UI note.
 */
export function StockTakeChecklist({ products }: Props) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [variance, setVariance] = useState<VarianceLine[] | null>(null);
  const { pending, run } = useAsyncAction();

  const enteredLines = useMemo(
    () =>
      products
        .filter((p) => (counts[p.id] ?? '').trim() !== '')
        .map((p) => ({
          productId: p.id,
          currentOnHand: p.on_hand,
          countedQty: Number(counts[p.id]),
        })),
    [products, counts]
  );

  function onSubmit() {
    const parsed = stockTakeFormSchema.safeParse({ lines: enteredLines });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Enter at least one count');
      return;
    }

    return run(async () => {
      const result = await recordStockTake(parsed.data);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Stock take recorded');
      setVariance(result.variance);
    });
  }

  if (variance) {
    const over = variance.filter((v) => v.delta > 0).length;
    const under = variance.filter((v) => v.delta < 0).length;
    return (
      <div className="border-border mt-8 rounded-xl border p-6">
        <p className="text-lg font-semibold">Stock take complete</p>
        <p className="text-muted-foreground mt-1 text-sm">
          <span className="font-mono">{over}</span> over, <span className="font-mono">{under}</span>{' '}
          under, <span className="font-mono">{products.length - variance.length}</span> unchanged.
        </p>
      </div>
    );
  }

  if (products.length === 0) {
    return <p className="text-muted-foreground mt-8 text-sm">No active products to count yet.</p>;
  }

  return (
    <div className="mt-8 space-y-2">
      {products.map((p) => {
        const raw = counts[p.id] ?? '';
        const diff = raw.trim() === '' ? null : Number(raw) - p.on_hand;
        return (
          <div
            key={p.id}
            className="border-border flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
          >
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-muted-foreground font-mono text-xs">
                on hand: {p.on_hand} {p.unit}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                className="h-10 w-24 text-center font-mono"
                placeholder="Count"
                value={raw}
                onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))}
                aria-label={`Counted quantity for ${p.name}`}
              />
              {diff !== null && (
                <span
                  className={
                    diff === 0
                      ? 'text-muted-foreground font-mono text-sm'
                      : diff > 0
                        ? 'text-stock-ok font-mono text-sm'
                        : 'text-stock-out font-mono text-sm'
                  }
                >
                  {diff > 0 ? `+${diff}` : diff}
                </span>
              )}
            </div>
          </div>
        );
      })}
      <Button className="w-full" disabled={pending || enteredLines.length === 0} onClick={onSubmit}>
        {pending ? 'Submitting…' : `Submit count (${enteredLines.length})`}
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Write the page**

```tsx
// src/app/dashboard/stock-take/page.tsx
import { redirect } from 'next/navigation';

import { createServerClient } from '@/lib/supabase/server';
import { StockTakeChecklist } from './stock-take-checklist';

// Current on-hand values must always be fresh when starting a count.
export const revalidate = 0;

export default async function StockTakePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name');

  return (
    <div className="max-w-site mx-auto w-full px-6 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Stock take</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Count what&apos;s actually on the shelf and reconcile it in one pass.
      </p>
      <StockTakeChecklist products={data ?? []} />
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test stock-take-checklist.dom.test.tsx`
Expected: PASS, all 3 tests.

- [ ] **Step 7: Add the entry-point link**

In `src/app/dashboard/products/products-workspace.tsx`, add an import for `Link` from `next/link` and `PAGE_ROUTES` from `@/lib/constants/routes`, then add a link next to the existing "Add product" buttons in the header row:

```tsx
<Button variant="outline" asChild>
  <Link href={PAGE_ROUTES.STOCK_TAKE}>Start a stock take</Link>
</Button>
```

Place it before the two "Add product" `Button`s in the header `div` (the `flex items-center justify-between gap-4` row).

- [ ] **Step 8: Run the full check**

Run: `pnpm check`
Expected: prettier, eslint, typecheck, and route-logging all pass. (`stock-take` isn't under `src/app/api`, so the route-logging check doesn't apply to it.)

- [ ] **Step 9: Commit**

```bash
git add src/app/dashboard/stock-take/page.tsx src/app/dashboard/stock-take/stock-take-checklist.tsx src/app/dashboard/stock-take/stock-take-checklist.dom.test.tsx src/lib/constants/routes.ts src/app/dashboard/products/products-workspace.tsx
git commit -m "feat: add stock-take checklist page and entry point"
```

---

### Task 7: Docs — README/CHANGELOG coupling

This repo's CI hard-gates a README update for every changed folder and a CHANGELOG entry for any `src/` change (see this session's earlier PR, which failed both gates on the first push) — do this task before considering the feature done, not as an afterthought.

**Files:**

- Create: `src/app/dashboard/stock-take/README.md`
- Modify: `src/app/dashboard/README.md`
- Modify: `README.md`
- Modify: `supabase/migrations/README.md`
- Modify: `supabase/README.md`
- Modify: `CHANGELOG.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Write `src/app/dashboard/stock-take/README.md`**

```markdown
# src/app/dashboard/stock-take

Batch physical-count reconciliation. `page.tsx` fetches every active
product fresh (`revalidate = 0`); `stock-take-checklist.tsx` is a client
checklist — counted-quantity inputs default blank (not pre-filled with
`on_hand`) so an untouched row is correctly treated as "not counted this
session," not an accidental zero-variance count. Submitting posts every
entered line at once via `recordStockTake` (`actions.ts`), which calls
`stockkit.record_stock_take` (migration `0007`) — one atomic call covering
every counted product, rolling back entirely if any line fails (e.g. a
product deleted mid-session). On success, a variance summary (over/under/
unchanged counts) replaces the checklist.

Reached from the products workspace ("Start a stock take"), the same way
the products page itself has no direct nav-dropdown entry — reachable only
via a link from an adjacent page.

## Parent

[dashboard](../README.md)
```

- [ ] **Step 2: Update `src/app/dashboard/README.md`**

Add a sentence noting the new route, e.g. append after the existing `products/` mention:

```markdown
`stock-take/` is the batch physical-count reconciliation page (own README),
reached via a link from the products workspace.
```

- [ ] **Step 3: Update root `README.md`**

In the `## Routes` table, add a row:

```markdown
| `/dashboard/stock-take` | vendor (auth) | batch physical-count reconciliation, one session at a time |
```

In `## Data model`, add a bullet after `stock_movements`:

```markdown
- `stock_take_sessions` — one row per batch count, created by
  `stockkit.record_stock_take`; `stock_movements.session_id` (nullable)
  groups every movement written by that session.
```

In `## Structure` → `### Contents`, add a bullet for `src/app/dashboard/stock-take/` referencing its own README, matching the existing `products/` bullet's "own README" pattern.

- [ ] **Step 4: Update `supabase/migrations/README.md`**

Add entries for `0006_stock_take_sessions.sql` and `0007_record_stock_take.sql`, following the existing per-migration bullet format (see the `0008_vendor_tour_seen.sql`-style entries already in this file for the expected shape — one bullet per migration, one sentence on what it adds and why).

- [ ] **Step 5: Update `supabase/README.md`**

If its migration count/range is mentioned anywhere, bump it to reflect `0000`-`0007`.

- [ ] **Step 6: Update `CHANGELOG.md`**

Add under `## Unreleased`:

```markdown
- Added a stock-take / cycle-count session: `/dashboard/stock-take` lets a
  vendor count every active product in one pass and submit the batch
  atomically via a new `stockkit.record_stock_take` RPC, instead of N
  separate one-at-a-time `adjustment` movements. A completed session shows
  a variance summary (over/under/unchanged); every movement it writes is
  tagged with a shared `session_id` for later grouping.
```

- [ ] **Step 7: Run the full check**

Run: `pnpm check`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/app/dashboard/stock-take/README.md src/app/dashboard/README.md README.md supabase/migrations/README.md supabase/README.md CHANGELOG.md
git commit -m "docs: document the stock-take feature"
```

---

## Self-Review

**Spec coverage:** every section of `2026-07-26-stock-take-cycle-count-design.md`'s "Chosen design" is covered — the sessions table + `session_id` FK (Task 1), the RPC with per-line atomicity (Task 2), the server action + Zod schema (Tasks 4-5), and the checklist UI with live diff + variance summary (Task 6). The spec's two open questions (partial counts allowed; no dedicated session-history view yet) are both resolved as designed: `enteredLines` filters to only touched rows (partial allowed), and there's no session-list page in this plan (deferred, per the spec's own "leaning: ledger is sufficient for v1" note).

**Placeholder scan:** no TBD/TODO markers; every step has real code or an exact shell command.

**Type consistency:** `StockTakeLine`/`VarianceLine` (Task 3) are used identically in Task 5's action and Task 6's component; `StockTakeFormInput`/`stockTakeFormSchema` (Task 4) match the shape both `recordStockTake` and the checklist's `safeParse` call expect; `StockTakeSession` (Task 1's types.ts edit) matches the RPC's actual return shape used in Task 5's mocked test fixture.

**Scope check:** this plan implements only the stock-take spec. It does not touch the raw-material/bundles or variant-grouping specs — those are separate plans, and this plan's Task 6 entry-point change to `products-workspace.tsx` is additive only (one new button), not a restructure of that file.
