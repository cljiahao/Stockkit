# Linked Product Consumption (Raw Material + Bundles) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `products` row declare that producing/assembling one unit of
itself consumes units of one or more other `products` rows, and record that
consumption atomically alongside the parent's own stock movement — serving
both the raw-material→finished-good case (stickers, roasted coffee, 3D
prints) and the bundle/composite-product case (a "pack of 5" consuming 5
units of its component) with one shared mechanism.

**Architecture:** A single join table (`stockkit.product_components`) links
a parent product to N component products with a per-unit consumption ratio.
A single RPC (`stockkit.record_linked_movement`) replaces
`record_stock_movement` for any product that has component rows: it applies
the caller's delta to the parent, and — only when that delta is positive
(the product grew, i.e. it was produced/assembled) — fans out a proportional
(optionally overridden, for real-yield variance) consumption to each
component, all inside one transaction. A negative delta (waste, a sale
decrementing already-produced stock, a downward adjustment) never re-touches
components, since they already left stock when the parent was produced. Every
row written by one call shares a `linked_movement_id` so the ledger can
display them as one event.

**Tech Stack:** Postgres (Supabase), pgTAP, Next.js 16 Server Actions, Zod,
Vitest, React (client components), shadcn/ui.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore` (AGENTS.md).
- Every user input validated with Zod at the server-action boundary (AGENTS.md).
- Authorization lives in RLS policies, never app code (AGENTS.md).
- `supabase/migrations/` and `src/lib/types.ts` must be updated together, every time the schema changes (AGENTS.md).
- Comment hygiene: own-line comments only, no trailing inline comments (AGENTS.md, `no-inline-comments: error`).
- `font-mono` on every quantity/cost figure shown to the vendor (AGENTS.md).
- `ActionResult<T>` is the return shape for every server action (`src/lib/action-result.ts`).
- This plan reconciles `docs/superpowers/specs/2026-07-26-raw-material-finished-good-linking-design.md` and the bundles portion of `docs/superpowers/specs/2026-07-26-product-variants-and-bundles-design.md` into one mechanism — it deliberately does NOT implement that second spec's variant-grouping portion (`parent_product_id`/`variant_label`), which is a separate, unrelated plan.
- Design decision (a resolution of an open question both source specs left unresolved): fan-out only triggers when the parent's delta is **positive**. A negative-delta movement on a linked product only ever touches the parent row, exactly like a plain `record_stock_movement` call — this avoids double-decrementing components that already left stock at production/assembly time.

---

## Task 1: `product_components` table + RLS + no-nesting trigger

**Files:**

- Create: `supabase/migrations/0006_product_components.sql`
- Test: `supabase/tests/rls.test.sql` (extend existing file, not a new one — this is the project's one pgTAP suite)

**Interfaces:**

- Produces: table `stockkit.product_components (parent_product_id uuid, component_product_id uuid, quantity_per_unit numeric, created_at timestamptz)`, primary key `(parent_product_id, component_product_id)`.

- [ ] **Step 1: Write the failing pgTAP assertions**

Confirm the current assertion count first:

Run: `grep -c "select \(ok\|is_empty\|isnt_empty\|lives_ok\|throws_ok\|results_eq\)(" supabase/tests/rls.test.sql`
Expected: `27` (matches the file's current `select plan(27);`)

Add this block right before the final `-- ── Act as anon ──` section of `supabase/tests/rls.test.sql` (so it still runs as Vendor A, before the role switches to anon), and bump `select plan(27);` at the top of the file to `select plan(34);` (7 new assertions below):

```sql
-- ── product_components: RLS + no-nesting ────────────────────────────────────
select ok(
  (select relrowsecurity from pg_class where oid = 'stockkit.product_components'::regclass),
  'RLS on product_components');

select lives_ok(
  $$ insert into stockkit.product_components (parent_product_id, component_product_id, quantity_per_unit)
     values ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000c0003', 2) $$,
  'A can link two of its own products');

select throws_ok(
  $$ insert into stockkit.product_components (parent_product_id, component_product_id, quantity_per_unit)
     values ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000c0002', 1) $$,
  '42501',
  null,
  'A cannot link B''s product as a component (WITH CHECK rejects cross-vendor component)');

select is_empty(
  $$ select 1 from stockkit.product_components
     where parent_product_id = '00000000-0000-0000-0000-0000000c0001'
       and component_product_id = '00000000-0000-0000-0000-0000000c0002' $$,
  'the cross-vendor insert above did not land any row');

select throws_ok(
  $$ insert into stockkit.product_components (parent_product_id, component_product_id, quantity_per_unit)
     values ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000c0001', 1) $$,
  '23514',
  null,
  'a product cannot be its own component (CHECK violation)');

select throws_ok(
  $$ insert into stockkit.product_components (parent_product_id, component_product_id, quantity_per_unit)
     values ('00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-0000000c0001', 1) $$,
  'P0001',
  null,
  'a component cannot itself become a parent elsewhere (no nested linking)');

select isnt_empty(
  $$ select 1 from stockkit.product_components
     where parent_product_id = '00000000-0000-0000-0000-0000000c0001' $$,
  'A can read its own product_components row');
```

This references a third product (`...c0003`) that doesn't exist in the current fixtures yet — add it alongside the existing `A Product`/`B Product` fixture insert near the top of the file:

```sql
insert into stockkit.products (id, vendor_id, name, unit_cost_cents, on_hand, low_stock_threshold)
values
  ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-00000000000a', 'A Product', 100, 10, 2),
  ('00000000-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-00000000000b', 'B Product', 200, 5, 1),
  ('00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-00000000000a', 'A Raw Material', 50, 100, 10);
```

Run: `supabase test db`
Expected: FAIL — `stockkit.product_components` does not exist yet.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/0006_product_components.sql
--
-- Links a "parent" product (a finished good being produced, or a bundle
-- being assembled) to the component product(s) it consumes per unit
-- produced/assembled. One join table serves both the raw-material and
-- bundle cases — see stockkit.record_linked_movement (0007) for how the
-- fan-out actually applies this ratio.

CREATE TABLE stockkit.product_components (
  parent_product_id     UUID        NOT NULL REFERENCES stockkit.products(id) ON DELETE CASCADE,
  component_product_id  UUID        NOT NULL REFERENCES stockkit.products(id) ON DELETE RESTRICT,
  quantity_per_unit      NUMERIC     NOT NULL CHECK (quantity_per_unit > 0),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (parent_product_id, component_product_id),
  CHECK (parent_product_id <> component_product_id)
);

-- ON DELETE RESTRICT on the component side: deleting a product that's still
-- someone's declared component is blocked, forcing the vendor to unlink
-- first — matches the app's existing bias toward explicit state changes.
-- ON DELETE CASCADE on the parent side: deleting a parent product cleans up
-- its own component links (nothing else references them).

grant select, insert, update, delete on stockkit.product_components to authenticated;
grant all on stockkit.product_components to service_role;

ALTER TABLE stockkit.product_components ENABLE ROW LEVEL SECURITY;

-- Both the parent AND the referenced component must belong to the caller —
-- a bare FK doesn't enforce that, only vendor_id columns with RLS do, and
-- product_components has neither column itself, so ownership is checked via
-- EXISTS against products (which IS scoped by vendor_id).
CREATE POLICY "product_components_vendor_all" ON stockkit.product_components
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM stockkit.products
      WHERE id = parent_product_id AND vendor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stockkit.products
      WHERE id = parent_product_id AND vendor_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM stockkit.products
      WHERE id = component_product_id AND vendor_id = auth.uid()
    )
  );

-- No multi-level linking: a component can't itself have components, and a
-- parent can't itself be used as someone else's component. This is a
-- cross-row invariant RLS can't express, so it's a trigger, not a CHECK.
CREATE OR REPLACE FUNCTION stockkit.prevent_nested_components()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM stockkit.product_components WHERE parent_product_id = NEW.component_product_id
  ) THEN
    RAISE EXCEPTION 'component_product_id cannot itself have components (no nested linking)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM stockkit.product_components WHERE component_product_id = NEW.parent_product_id
  ) THEN
    RAISE EXCEPTION 'parent_product_id cannot itself be used as a component elsewhere (no nested linking)';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER product_components_no_nesting
  BEFORE INSERT OR UPDATE ON stockkit.product_components
  FOR EACH ROW EXECUTE FUNCTION stockkit.prevent_nested_components();

-- Grouping key so every stock_movements row written by one
-- record_linked_movement call (0007) can be displayed as one ledger event.
ALTER TABLE stockkit.stock_movements
  ADD COLUMN linked_movement_id UUID;

-- 'consumed' is written only by record_linked_movement (0007) for the
-- component side of a fan-out — never user-selectable, same status as
-- 'initial'. CHECK constraints on a column can't be altered in place, so
-- this drops and recreates it with the added value.
ALTER TABLE stockkit.stock_movements
  DROP CONSTRAINT stock_movements_reason_check;

ALTER TABLE stockkit.stock_movements
  ADD CONSTRAINT stock_movements_reason_check
  CHECK (reason IN ('restock', 'waste', 'adjustment', 'initial', 'consumed'));
```

Before running this, confirm the constraint name assumed above is correct
(0001 defines it as an inline, unnamed `CHECK` on the `reason` column, which
Postgres names `<table>_<column>_check` by default):

Run: `supabase db diff --schema stockkit` after applying `0000`-`0005` to a
scratch database, or `psql -c "\d stockkit.stock_movements"` and read off the
constraint name under "Check constraints". If it differs from
`stock_movements_reason_check`, use the actual name in the `DROP CONSTRAINT`
line above.

- [ ] **Step 3: Apply and verify**

Run: `supabase test db`
Expected: PASS — all 34 assertions green.

- [ ] **Step 4: Update `src/lib/types.ts`**

Add the new table and reason value:

```typescript
// src/lib/types.ts — replace the existing StockMovementReason line
export type StockMovementReason = 'restock' | 'waste' | 'adjustment' | 'initial' | 'consumed';
```

Add a new table entry inside `Database['stockkit']['Tables']`, after `products`:

```typescript
      product_components: {
        Row: {
          parent_product_id: string;
          component_product_id: string;
          quantity_per_unit: number;
          created_at: string;
        };
        Insert: {
          parent_product_id: string;
          component_product_id: string;
          quantity_per_unit: number;
          created_at?: string;
        };
        Update: {
          parent_product_id?: string;
          component_product_id?: string;
          quantity_per_unit?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_components_parent_product_id_fkey';
            columns: ['parent_product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_components_component_product_id_fkey';
            columns: ['component_product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
```

Add `linked_movement_id: string | null;` to `stock_movements`'s `Row`, and
`linked_movement_id?: string | null;` to its `Insert`/`Update`.

Also add a named export near the bottom of the file:

```typescript
export type ProductComponent = Database['stockkit']['Tables']['product_components']['Row'];
```

Run: `pnpm typecheck`
Expected: PASS (no consumers reference these fields yet, so nothing else should break).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_product_components.sql supabase/tests/rls.test.sql src/lib/types.ts
git commit -m "feat(db): add product_components table for linked-product consumption"
```

---

## Task 2: `record_linked_movement` RPC

**Files:**

- Create: `supabase/migrations/0007_record_linked_movement.sql`
- Test: `supabase/tests/rls.test.sql` (extend further)

**Interfaces:**

- Consumes: `stockkit.product_components` (Task 1), `stockkit.products`, `stockkit.stock_movements` (existing).
- Produces: `stockkit.record_linked_movement(p_parent_product_id uuid, p_parent_delta numeric, p_reason text, p_note text DEFAULT NULL, p_unit_cost_cents integer DEFAULT NULL, p_component_overrides jsonb DEFAULT NULL) RETURNS stockkit.products` — same return shape as the existing `record_stock_movement`, so callers switch between them without changing how they read the result.

- [ ] **Step 1: Write the failing pgTAP assertions**

Append to `supabase/tests/rls.test.sql`, still acting as Vendor A (before the
anon section), and bump `select plan(34);` to `select plan(39);`:

```sql
-- ── record_linked_movement: fan-out + atomicity ─────────────────────────────
select lives_ok(
  $$ select stockkit.record_linked_movement(
       '00000000-0000-0000-0000-0000000c0001'::uuid, 5, 'restock', 'produced 5', 150, null
     ) $$,
  'A can call record_linked_movement on its own linked product');

select results_eq(
  $$ select on_hand from stockkit.products where id = '00000000-0000-0000-0000-0000000c0001' $$,
  $$ values (15::numeric) $$,
  'parent on_hand grew by the produced amount (10 + 5)');

select results_eq(
  $$ select on_hand from stockkit.products where id = '00000000-0000-0000-0000-0000000c0003' $$,
  $$ values (90::numeric) $$,
  'component on_hand shrank by delta * quantity_per_unit (100 - 5*2)');

select results_eq(
  $$ select count(distinct linked_movement_id) from stockkit.stock_movements
     where product_id in ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000c0003')
       and linked_movement_id is not null $$,
  $$ values (1::bigint) $$,
  'the parent and component movements share one linked_movement_id');

select throws_ok(
  $$ select stockkit.record_linked_movement(
       '00000000-0000-0000-0000-0000000c0001'::uuid, 1000, 'restock', null, null, null
     ) $$,
  'P0001',
  null,
  'a fan-out that would take the component below zero rolls back the whole call');

select results_eq(
  $$ select on_hand from stockkit.products where id = '00000000-0000-0000-0000-0000000c0001' $$,
  $$ values (15::numeric) $$,
  'the failed call above did not partially apply — parent on_hand unchanged');
```

Run: `supabase test db`
Expected: FAIL — `stockkit.record_linked_movement` does not exist yet.

- [ ] **Step 2: Write the RPC**

```sql
-- supabase/migrations/0007_record_linked_movement.sql
--
-- Replaces record_stock_movement for any product with product_components
-- rows. Applies p_parent_delta to the parent exactly like
-- record_stock_movement; when p_parent_delta > 0 (the product was produced/
-- assembled), also fans out a proportional consumption to every declared
-- component, all in one transaction. A negative delta (waste, a sale
-- decrementing already-produced stock, a downward adjustment) never
-- re-touches components — they already left stock when the parent was
-- produced, so re-applying the ratio on the way down would double-count it.
--
-- p_component_overrides lets the caller supply the ACTUAL amount consumed
-- for one or more components (keyed by component_product_id as text),
-- overriding the stored quantity_per_unit estimate — real yield varies
-- (see the raw-material spec). Any component without an override falls back
-- to -1 * p_parent_delta * quantity_per_unit.
CREATE OR REPLACE FUNCTION stockkit.record_linked_movement(
  p_parent_product_id uuid,
  p_parent_delta numeric,
  p_reason text,
  p_note text DEFAULT NULL,
  p_unit_cost_cents integer DEFAULT NULL,
  p_component_overrides jsonb DEFAULT NULL
) RETURNS stockkit.products
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = stockkit
AS $$
DECLARE
  v_product stockkit.products;
  v_group_id uuid := gen_random_uuid();
  v_component RECORD;
  v_component_delta numeric;
BEGIN
  UPDATE stockkit.products
  SET on_hand = on_hand + p_parent_delta, updated_at = now()
  WHERE id = p_parent_product_id AND vendor_id = auth.uid()
  RETURNING * INTO v_product;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found or not owned by caller';
  END IF;

  IF v_product.on_hand < 0 THEN
    RAISE EXCEPTION 'stock movement would take % below zero', v_product.name;
  END IF;

  INSERT INTO stockkit.stock_movements
    (vendor_id, product_id, delta, reason, note, unit_cost_cents, linked_movement_id)
  VALUES
    (v_product.vendor_id, p_parent_product_id, p_parent_delta, p_reason, p_note, p_unit_cost_cents, v_group_id);

  IF p_parent_delta > 0 THEN
    FOR v_component IN
      SELECT component_product_id, quantity_per_unit
      FROM stockkit.product_components
      WHERE parent_product_id = p_parent_product_id
    LOOP
      v_component_delta := COALESCE(
        (p_component_overrides ->> v_component.component_product_id::text)::numeric,
        -1 * p_parent_delta * v_component.quantity_per_unit
      );

      UPDATE stockkit.products
      SET on_hand = on_hand + v_component_delta, updated_at = now()
      WHERE id = v_component.component_product_id AND vendor_id = auth.uid()
      RETURNING * INTO v_product;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'component product not found or not owned by caller';
      END IF;

      IF v_product.on_hand < 0 THEN
        RAISE EXCEPTION 'stock movement would take % below zero', v_product.name;
      END IF;

      INSERT INTO stockkit.stock_movements
        (vendor_id, product_id, delta, reason, note, unit_cost_cents, linked_movement_id)
      VALUES
        (v_product.vendor_id, v_component.component_product_id, v_component_delta, 'consumed', p_note, NULL, v_group_id);
    END LOOP;

    SELECT * INTO v_product FROM stockkit.products WHERE id = p_parent_product_id;
  END IF;

  RETURN v_product;
END;
$$;

GRANT EXECUTE ON FUNCTION stockkit.record_linked_movement(uuid, numeric, text, text, integer, jsonb) TO authenticated;
```

- [ ] **Step 3: Verify**

Run: `supabase test db`
Expected: PASS — all 39 assertions green.

- [ ] **Step 4: Update `src/lib/types.ts`**

Add to `Database['stockkit']['Functions']`, alongside `record_stock_movement`:

```typescript
      record_linked_movement: {
        Args: {
          p_parent_product_id: string;
          p_parent_delta: number;
          p_reason: string;
          p_note?: string | null;
          p_unit_cost_cents?: number | null;
          p_component_overrides?: Record<string, number> | null;
        };
        Returns: Database['stockkit']['Tables']['products']['Row'];
      };
```

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_record_linked_movement.sql supabase/tests/rls.test.sql src/lib/types.ts
git commit -m "feat(db): add record_linked_movement RPC for atomic component fan-out"
```

---

## Task 3: Zod schema + `saveProductComponents`/`getProductComponents` server actions

**Files:**

- Modify: `src/lib/schemas.ts`
- Modify: `src/app/dashboard/products/actions.ts`
- Create: `src/app/dashboard/products/actions.test.ts`

**Interfaces:**

- Consumes: `ProductComponent` type (Task 1), `ActionResult<T>` (`src/lib/action-result.ts`).
- Produces: `productComponentSchema` (Zod), `saveProductComponents(parentProductId: string, components: {component_product_id: string, quantity_per_unit: number}[]): Promise<ActionResult>`, `getProductComponents(parentProductId: string): Promise<ActionResult<{components: ProductComponent[]}>>`. Later tasks (5, 6) call these by name.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/dashboard/products/actions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUserMock, fromMock, createServerClientMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: 'vendor-1' } } });
  fromMock.mockReset();
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    from: fromMock,
  });
});

describe('saveProductComponents', () => {
  it('rejects a component list with an invalid quantity_per_unit', async () => {
    const { saveProductComponents } = await import('./actions');
    const result = await saveProductComponents('11111111-1111-1111-1111-111111111111', [
      { component_product_id: '22222222-2222-2222-2222-222222222222', quantity_per_unit: 0 },
    ]);
    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('deletes existing links then inserts the new list', async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({
      delete: () => ({ eq: deleteEq }),
      insert,
    });

    const { saveProductComponents } = await import('./actions');
    const result = await saveProductComponents('11111111-1111-1111-1111-111111111111', [
      { component_product_id: '22222222-2222-2222-2222-222222222222', quantity_per_unit: 2 },
    ]);

    expect(result).toEqual({ success: true });
    expect(deleteEq).toHaveBeenCalledWith(
      'parent_product_id',
      '11111111-1111-1111-1111-111111111111'
    );
    expect(insert).toHaveBeenCalledWith([
      {
        parent_product_id: '11111111-1111-1111-1111-111111111111',
        component_product_id: '22222222-2222-2222-2222-222222222222',
        quantity_per_unit: 2,
      },
    ]);
  });

  it('returns an error without touching the DB when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { saveProductComponents } = await import('./actions');
    const result = await saveProductComponents('11111111-1111-1111-1111-111111111111', []);
    expect(result).toEqual({ success: false, error: 'Not authenticated' });
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe('getProductComponents', () => {
  it('returns the linked components for a product', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          parent_product_id: '1',
          component_product_id: '2',
          quantity_per_unit: 3,
          created_at: 'now',
        },
      ],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    const { getProductComponents } = await import('./actions');
    const result = await getProductComponents('11111111-1111-1111-1111-111111111111');

    expect(result.success).toBe(true);
    if (result.success) expect(result.components).toHaveLength(1);
  });
});
```

Run: `pnpm test actions.test.ts`
Expected: FAIL — `saveProductComponents`/`getProductComponents`/`productComponentSchema` don't exist yet.

- [ ] **Step 2: Add the Zod schema**

Add to `src/lib/schemas.ts`, after `stockMovementFormSchema`:

```typescript
export const productComponentSchema = z.object({
  component_product_id: z.string().uuid(),
  quantity_per_unit: z.number().positive('Quantity must be greater than zero'),
});
export type ProductComponentInput = z.infer<typeof productComponentSchema>;

export const productComponentsListSchema = z.array(productComponentSchema).max(20);
```

- [ ] **Step 3: Add the server actions**

Add to `src/app/dashboard/products/actions.ts`, after `saveProduct`:

```typescript
import { productComponentsListSchema } from '@/lib/schemas';
import type { ProductComponent } from '@/lib/types';

/**
 * Replaces a product's full component list (delete-then-insert, inside the
 * Supabase client's own request — not a DB transaction, since this is a
 * low-stakes edit-time operation, not a stock-affecting one; record_linked_
 * movement, not this action, is what needs real atomicity).
 */
export async function saveProductComponents(
  parentProductId: string,
  components: { component_product_id: string; quantity_per_unit: number }[]
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(parentProductId).success)
    return { success: false, error: 'Invalid product' };
  const parsed = productComponentsListSchema.safeParse(components);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Check the component list' };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error: deleteError } = await supabase
    .from('product_components')
    .delete()
    .eq('parent_product_id', parentProductId);
  if (deleteError) return { success: false, error: 'Could not save components' };

  if (parsed.data.length > 0) {
    const { error: insertError } = await supabase.from('product_components').insert(
      parsed.data.map((c) => ({
        parent_product_id: parentProductId,
        component_product_id: c.component_product_id,
        quantity_per_unit: c.quantity_per_unit,
      }))
    );
    if (insertError) return { success: false, error: 'Could not save components' };
  }

  revalidatePath('/dashboard', 'layout');
  return { success: true };
}

type GetComponentsResult = ActionResult<{ components: ProductComponent[] }>;

/** RLS-scoped list of a product's declared components, ordered by creation. */
export async function getProductComponents(parentProductId: string): Promise<GetComponentsResult> {
  if (!z.string().uuid().safeParse(parentProductId).success)
    return { success: false, error: 'Invalid product' };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('product_components')
    .select('*')
    .eq('parent_product_id', parentProductId)
    .order('created_at');
  if (error) return { success: false, error: 'Could not load components' };

  return { success: true, components: data ?? [] };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schemas.ts src/app/dashboard/products/actions.ts src/app/dashboard/products/actions.test.ts
git commit -m "feat: add saveProductComponents/getProductComponents server actions"
```

---

## Task 4: `recordLinkedMovement` server action

**Files:**

- Modify: `src/app/dashboard/products/actions.ts`
- Modify: `src/app/dashboard/products/actions.test.ts`
- Modify: `src/lib/schemas.ts`

**Interfaces:**

- Consumes: `stockMovementFormSchema` shape (existing), `record_linked_movement` RPC (Task 2).
- Produces: `linkedMovementFormSchema` (Zod), `recordLinkedMovement(input: LinkedMovementFormInput): Promise<RecordMovementResult>` — same `RecordMovementResult` type `recordStockMovement` already returns, so `StockLogForm` (Task 6) can switch between the two without changing its success-handling code.

- [ ] **Step 1: Write the failing test**

Append to `src/app/dashboard/products/actions.test.ts`:

```typescript
describe('recordLinkedMovement', () => {
  it('calls the RPC with parsed input and component overrides', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'p1', on_hand: 15 }, error: null });
    createServerClientMock.mockResolvedValue({
      auth: { getUser: getUserMock },
      rpc,
    });

    const { recordLinkedMovement } = await import('./actions');
    const result = await recordLinkedMovement({
      product_id: '11111111-1111-1111-1111-111111111111',
      delta: 5,
      reason: 'restock',
      note: undefined,
      unit_cost_cents: 150,
      component_overrides: { '22222222-2222-2222-2222-222222222222': -12 },
    });

    expect(result).toEqual({ success: true, product: { id: 'p1', on_hand: 15 } });
    expect(rpc).toHaveBeenCalledWith('record_linked_movement', {
      p_parent_product_id: '11111111-1111-1111-1111-111111111111',
      p_parent_delta: 5,
      p_reason: 'restock',
      p_note: null,
      p_unit_cost_cents: 150,
      p_component_overrides: { '22222222-2222-2222-2222-222222222222': -12 },
    });
  });

  it('maps a below-zero RPC error to a friendly message', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'stock movement would take X below zero' },
    });
    createServerClientMock.mockResolvedValue({ auth: { getUser: getUserMock }, rpc });

    const { recordLinkedMovement } = await import('./actions');
    const result = await recordLinkedMovement({
      product_id: '11111111-1111-1111-1111-111111111111',
      delta: 5,
      reason: 'restock',
    });

    expect(result).toEqual({ success: false, error: 'Not enough stock — check the quantity' });
  });
});
```

Run: `pnpm test actions.test.ts`
Expected: FAIL — `recordLinkedMovement` doesn't exist.

- [ ] **Step 2: Add the Zod schema**

Add to `src/lib/schemas.ts`, after `stockMovementFormSchema`:

```typescript
export const linkedMovementFormSchema = z.object({
  product_id: z.string().uuid(),
  delta: z.number().refine((n) => n !== 0, 'Enter a nonzero quantity'),
  reason: z.enum(['restock', 'waste', 'adjustment']),
  note: z.string().max(500).optional(),
  unit_cost_cents: z.number().int().nonnegative().optional(),
  // Actual amount consumed per component, keyed by component_product_id —
  // overrides the stored quantity_per_unit estimate for real yield variance.
  // Only meaningful when delta > 0 (see record_linked_movement, 0007).
  component_overrides: z.record(z.string().uuid(), z.number()).optional(),
});
export type LinkedMovementFormInput = z.infer<typeof linkedMovementFormSchema>;
```

- [ ] **Step 3: Add the server action**

Add to `src/app/dashboard/products/actions.ts`, after `recordStockMovement`:

```typescript
import { linkedMovementFormSchema } from '@/lib/schemas';

/**
 * Records a movement on a product that has declared components (Task 1/2) —
 * calls record_linked_movement instead of record_stock_movement so a
 * positive delta (production/assembly) fans out consumption atomically. A
 * negative delta behaves identically to recordStockMovement (record_linked_
 * movement only fans out when p_parent_delta > 0), so callers can always use
 * this action for a product that has any component rows, regardless of the
 * movement's direction.
 */
export async function recordLinkedMovement(
  input: LinkedMovementFormInput
): Promise<RecordMovementResult> {
  const parsed = linkedMovementFormSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Check the movement details',
    };
  const data = parsed.data;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: product, error } = await supabase.rpc('record_linked_movement', {
    p_parent_product_id: data.product_id,
    p_parent_delta: data.delta,
    p_reason: data.reason,
    p_note: data.note ?? null,
    p_unit_cost_cents: data.unit_cost_cents ?? null,
    p_component_overrides: data.component_overrides ?? null,
  });

  if (error) {
    if (error.message.includes('below zero'))
      return { success: false, error: 'Not enough stock — check the quantity' };
    if (error.message.includes('not found or not owned'))
      return { success: false, error: 'Product not found' };
    console.error('recordLinkedMovement failed', error.message);
    return { success: false, error: 'Could not record stock movement' };
  }
  if (!product) return { success: false, error: 'Could not record stock movement' };

  revalidatePath('/dashboard', 'layout');
  return { success: true, product };
}
```

- [ ] **Step 4: Run tests, typecheck**

Run: `pnpm test actions.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts src/app/dashboard/products/actions.ts src/app/dashboard/products/actions.test.ts
git commit -m "feat: add recordLinkedMovement server action"
```

---

## Task 5: "Consists of" section in `ProductForm`

**Files:**

- Modify: `src/app/dashboard/products/product-form.tsx`
- Modify: `src/app/dashboard/products/product-form.dom.test.tsx`

**Interfaces:**

- Consumes: `saveProductComponents`/`getProductComponents` (Task 3), `productComponentSchema` (Task 3).
- Produces: nothing new consumed by later tasks — this is a leaf UI task.

- [ ] **Step 1: Write the failing test**

Add to `src/app/dashboard/products/product-form.dom.test.tsx` (existing file — follow its established render/mock setup):

```typescript
it('lets an existing product add a component row and save it', async () => {
  const user = userEvent.setup();
  vi.mocked(getProductComponents).mockResolvedValue({ success: true, components: [] });
  vi.mocked(saveProductComponents).mockResolvedValue({ success: true });

  render(
    <ProductForm
      product={{ ...baseProduct, id: 'p1' }}
      onSaved={vi.fn()}
    />
  );

  await user.click(await screen.findByRole('button', { name: /add component/i }));
  await user.type(screen.getByLabelText(/component product/i), 'raw-material-id');
  await user.type(screen.getByLabelText(/quantity per unit/i), '2');
  await user.click(screen.getByRole('button', { name: /save components/i }));

  await waitFor(() =>
    expect(saveProductComponents).toHaveBeenCalledWith('p1', [
      { component_product_id: 'raw-material-id', quantity_per_unit: 2 },
    ])
  );
});
```

(Match this test's exact mocking mechanics — `vi.mock('./actions', ...)`,
existing `baseProduct` fixture, existing render helpers — to whatever
`product-form.dom.test.tsx` already establishes; the assertions above are
the contract, not the literal file diff.)

Run: `pnpm test product-form.dom.test.tsx`
Expected: FAIL — no "Add component" control exists yet.

- [ ] **Step 2: Implement**

Add to `src/app/dashboard/products/product-form.tsx`, only rendered when
`!isNew` (a component list needs an existing product id to attach to):

```tsx
import { useEffect, useState } from 'react';
import { getProductComponents, saveProductComponents } from './actions';
import type { ProductComponent } from '@/lib/types';

// Inside ProductForm, alongside the other useState hooks:
const [components, setComponents] = useState<
  { component_product_id: string; quantity_per_unit: number }[]
>([]);
const { pending: savingComponents, run: runSaveComponents } = useAsyncAction();

useEffect(() => {
  if (!product) return;
  let cancelled = false;
  void getProductComponents(product.id).then((result) => {
    if (cancelled) return;
    if (result.success) {
      setComponents(
        result.components.map((c: ProductComponent) => ({
          component_product_id: c.component_product_id,
          quantity_per_unit: c.quantity_per_unit,
        }))
      );
    }
  });
  return () => {
    cancelled = true;
  };
}, [product]);

function addComponentRow() {
  setComponents((prev) => [...prev, { component_product_id: '', quantity_per_unit: 1 }]);
}

function updateComponentRow(index: number, patch: Partial<(typeof components)[number]>) {
  setComponents((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
}

function removeComponentRow(index: number) {
  setComponents((prev) => prev.filter((_, i) => i !== index));
}

function onSaveComponents() {
  if (!product) return;
  return runSaveComponents(async () => {
    const result = await saveProductComponents(product.id, components);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success('Components saved');
  });
}
```

And in the JSX, after the "Active" switch block, only when `!isNew`:

```tsx
{
  !isNew && (
    <div className="border-border space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Consists of</p>
      <p className="text-muted-foreground text-xs">
        Producing one unit of this product consumes these components — see the Log stock tab.
      </p>
      {components.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            aria-label="Component product"
            placeholder="Component product ID"
            value={c.component_product_id}
            onChange={(e) => updateComponentRow(i, { component_product_id: e.target.value })}
          />
          <Input
            aria-label="Quantity per unit"
            type="number"
            min={0.01}
            step="any"
            className="w-28 font-mono"
            value={c.quantity_per_unit}
            onChange={(e) => updateComponentRow(i, { quantity_per_unit: Number(e.target.value) })}
          />
          <Button type="button" variant="outline" size="icon" onClick={() => removeComponentRow(i)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={addComponentRow}>
          Add component
        </Button>
        <Button type="button" onClick={onSaveComponents} disabled={savingComponents}>
          {savingComponents ? 'Saving…' : 'Save components'}
        </Button>
      </div>
    </div>
  );
}
```

`aria-label="Component product"` is a placeholder input for a product id
today — a searchable product picker is a real UX gap this task deliberately
leaves for a follow-up polish pass, since the plan's scope is the mechanism
working end-to-end, not the picker's UX.

- [ ] **Step 3: Run tests, typecheck, lint**

Run: `pnpm test product-form.dom.test.tsx && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/products/product-form.tsx src/app/dashboard/products/product-form.dom.test.tsx
git commit -m "feat: add component list editor to ProductForm"
```

---

## Task 6: `StockLogForm` uses `recordLinkedMovement` when components exist

**Files:**

- Modify: `src/app/dashboard/products/stock-log-form.tsx`
- Modify: `src/app/dashboard/products/stock-log-form.dom.test.tsx`

**Interfaces:**

- Consumes: `recordLinkedMovement` (Task 4), `getProductComponents` (Task 3).

- [ ] **Step 1: Write the failing test**

Add to `src/app/dashboard/products/stock-log-form.dom.test.tsx`:

```typescript
it('calls recordLinkedMovement with per-component overrides when the product has components', async () => {
  const user = userEvent.setup();
  vi.mocked(getProductComponents).mockResolvedValue({
    success: true,
    components: [
      {
        parent_product_id: 'p1',
        component_product_id: 'raw-1',
        quantity_per_unit: 2,
        created_at: 'now',
      },
    ],
  });
  vi.mocked(recordLinkedMovement).mockResolvedValue({
    success: true,
    product: { ...baseProduct, id: 'p1', on_hand: 15 },
  });

  render(<StockLogForm product={{ ...baseProduct, id: 'p1' }} onRecorded={vi.fn()} />);

  await user.click(await screen.findByRole('button', { name: /increase quantity/i }));
  await user.click(await screen.findByRole('button', { name: /increase quantity/i }));
  await user.click(await screen.findByRole('button', { name: /increase quantity/i }));
  await user.click(await screen.findByRole('button', { name: /increase quantity/i }));
  await user.clear(screen.getByLabelText(/raw-1 actually used/i));
  await user.type(screen.getByLabelText(/raw-1 actually used/i), '9');
  await user.click(screen.getByRole('button', { name: /restock/i }));

  await waitFor(() =>
    expect(recordLinkedMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 'p1',
        delta: 5,
        component_overrides: { 'raw-1': -9 },
      })
    )
  );
  expect(recordStockMovement).not.toHaveBeenCalled();
});
```

(Adapt to this test file's existing render/mock scaffolding, same note as Task 5.)

Run: `pnpm test stock-log-form.dom.test.tsx`
Expected: FAIL — the component-override input doesn't exist, and the form
still always calls `recordStockMovement`.

- [ ] **Step 2: Implement**

Add to `src/app/dashboard/products/stock-log-form.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { getProductComponents, recordLinkedMovement } from './actions';
import type { ProductComponent } from '@/lib/types';

// Inside StockLogForm, alongside existing useState hooks:
const [linkedComponents, setLinkedComponents] = useState<ProductComponent[]>([]);
const [componentActuals, setComponentActuals] = useState<Record<string, number>>({});

useEffect(() => {
  let cancelled = false;
  void getProductComponents(product.id).then((result) => {
    if (!cancelled && result.success) setLinkedComponents(result.components);
  });
  return () => {
    cancelled = true;
  };
}, [product.id]);

// Keep each component's default estimate (quantity_per_unit * quantity) in
// sync as the vendor changes the produced quantity, unless they've already
// typed their own actual-usage override for that component.
useEffect(() => {
  setComponentActuals((prev) => {
    const next: Record<string, number> = {};
    for (const c of linkedComponents) {
      next[c.component_product_id] = prev[c.component_product_id] ?? c.quantity_per_unit * quantity;
    }
    return next;
  });
}, [linkedComponents, quantity]);
```

Change `onSubmit` so a linked product with `reason === 'restock'` calls
`recordLinkedMovement` instead of `recordStockMovement`:

```tsx
return run(async () => {
  const result =
    linkedComponents.length > 0 && reason === 'restock'
      ? await recordLinkedMovement({
          ...parsed.data,
          component_overrides: Object.fromEntries(
            linkedComponents.map((c) => [
              c.component_product_id,
              -1 * (componentActuals[c.component_product_id] ?? 0),
            ])
          ),
        })
      : await recordStockMovement(parsed.data);
  if (!result.success) {
    toast.error(result.error);
    return;
  }
  toast.success(`${REASON_LABEL[reason]} recorded`);
  setQuantity(1);
  setNote('');
  onRecorded(result.product);
});
```

And in the JSX, after the quantity input, only when `linkedComponents.length > 0 && reason === 'restock'`:

```tsx
{
  linkedComponents.length > 0 && reason === 'restock' && (
    <div className="space-y-2">
      <p className="text-sm font-medium">Components used</p>
      {linkedComponents.map((c) => (
        <div key={c.component_product_id} className="flex items-center gap-2">
          <Label htmlFor={`component-actual-${c.component_product_id}`} className="flex-1 text-xs">
            {c.component_product_id} actually used
          </Label>
          <Input
            id={`component-actual-${c.component_product_id}`}
            type="number"
            min={0}
            step="any"
            className="w-28 font-mono"
            value={componentActuals[c.component_product_id] ?? 0}
            onChange={(e) =>
              setComponentActuals((prev) => ({
                ...prev,
                [c.component_product_id]: Number(e.target.value) || 0,
              }))
            }
          />
        </div>
      ))}
    </div>
  );
}
```

(The test's `raw-1 actually used` label match assumes the component id is
shown directly — same placeholder-ID caveat as Task 5's product picker.)

- [ ] **Step 3: Run tests, typecheck, lint**

Run: `pnpm test stock-log-form.dom.test.tsx && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/products/stock-log-form.tsx src/app/dashboard/products/stock-log-form.dom.test.tsx
git commit -m "feat: StockLogForm calls recordLinkedMovement for products with components"
```

---

## Task 7: Group linked movements in `MovementHistory`

**Files:**

- Modify: `src/app/dashboard/products/movement-history.tsx`
- Modify: `src/app/dashboard/products/movement-history.dom.test.tsx` (create if it doesn't exist yet — check first)

**Interfaces:**

- Consumes: `StockMovement.linked_movement_id` (Task 1).

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/dashboard/products/movement-history.dom.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MovementHistory } from './movement-history';

vi.mock('./actions', () => ({
  getProductMovements: vi.fn().mockResolvedValue({
    success: true,
    movements: [
      {
        id: 'm1',
        vendor_id: 'v1',
        product_id: 'p1',
        delta: 5,
        reason: 'restock',
        note: null,
        unit_cost_cents: 150,
        linked_movement_id: 'g1',
        created_at: '2026-07-26T00:00:00Z',
      },
      {
        id: 'm2',
        vendor_id: 'v1',
        product_id: 'raw-1',
        delta: -12,
        reason: 'consumed',
        note: null,
        unit_cost_cents: null,
        linked_movement_id: 'g1',
        created_at: '2026-07-26T00:00:00Z',
      },
    ],
  }),
}));

describe('MovementHistory', () => {
  it('shows a "linked" indicator on rows sharing a linked_movement_id', async () => {
    render(<MovementHistory productId="p1" refreshKey={0} />);
    expect(await screen.findAllByText(/linked/i)).toHaveLength(2);
  });
});
```

Run: `pnpm test movement-history.dom.test.tsx`
Expected: FAIL — no "linked" indicator exists yet.

- [ ] **Step 2: Implement**

Modify `REASON_LABEL` and the row markup in `src/app/dashboard/products/movement-history.tsx`:

```tsx
const REASON_LABEL: Record<string, string> = {
  restock: 'Restock',
  waste: 'Waste',
  adjustment: 'Adjustment',
  initial: 'Initial balance',
  consumed: 'Consumed',
};
```

```tsx
<div className="min-w-0">
  <p className="text-sm font-medium">
    {REASON_LABEL[m.reason] ?? m.reason}
    {m.linked_movement_id && (
      <span className="text-muted-foreground ml-2 text-xs font-normal">· linked</span>
    )}
  </p>
  <p className="text-muted-foreground truncate text-xs">
    {new Date(m.created_at).toLocaleString()}
    {m.note ? ` · ${m.note}` : ''}
  </p>
</div>
```

- [ ] **Step 3: Run tests, typecheck, lint**

Run: `pnpm test movement-history.dom.test.tsx && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/products/movement-history.tsx src/app/dashboard/products/movement-history.dom.test.tsx
git commit -m "feat: show linked-movement indicator in MovementHistory"
```

---

## Task 8: Docs

**Files:**

- Modify: `CHANGELOG.md`
- Modify: `src/app/dashboard/products/README.md`
- Modify: `supabase/migrations/README.md`
- Modify: `supabase/README.md` (if the migration count summary lives there — check first)

- [ ] **Step 1: Update `CHANGELOG.md`**

Add under `## Unreleased`:

```markdown
- Added `stockkit.product_components` + `stockkit.record_linked_movement`:
  a product can now declare that producing/assembling one unit of itself
  consumes units of other products, recorded atomically alongside its own
  stock movement (raw-material-to-finished-good and bundle/composite-product
  cases share this one mechanism). `ProductForm` gained a "Consists of"
  editor; `StockLogForm` lets a vendor override the estimated component
  usage per production run for real-yield variance.
```

- [ ] **Step 2: Update `src/app/dashboard/products/README.md`**

Add a paragraph describing `product_components`/`record_linked_movement` and
the "Consists of" section, referencing this plan's migration numbers
(`0006`/`0007`).

- [ ] **Step 3: Update `supabase/migrations/README.md`**

Add `0006`/`0007` bullets following the existing per-migration bullet
convention (see `0008`'s bullet for the tour-seen column as the most recent
example of that format).

- [ ] **Step 4: Verify no readme-coupling warnings**

Run: `git status --short` after staging, and confirm every directory with
changed files across Tasks 1-8 also has its README staged in this task or an
earlier one.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md src/app/dashboard/products/README.md supabase/migrations/README.md
git commit -m "docs: document product_components and record_linked_movement"
```

---

## Self-Review

**Spec coverage:**

- Raw-material spec §3 (migration, RPC, atomicity, yield-actual override) — Tasks 1, 2, 6. ✓.
- Raw-material spec's `component_qty_per_unit` UI default/estimate — Task 6's `componentActuals` prefill. ✓.
- Bundles spec §"Chosen design" (`bundle_components` table, RLS, no-nesting, fan-out RPC) — Tasks 1, 2, unified into `product_components`/`record_linked_movement`. ✓.
- Bundles spec's "Bundle contents" UI — Task 5's "Consists of" editor (renamed to serve both framings, per the Global Constraints reconciliation decision). ✓.
- Both specs' testing sections (RLS cross-vendor, atomicity, nesting rejection) — Tasks 1-2's pgTAP additions. ✓.
- Both specs' "out of scope" sections (multi-level BOMs, bundle-of-bundles, dye-lot batches, auto-costing) — deliberately not implemented; no task references them.
- Bundles spec's open question ("should a bundle's own on_hand be meaningful") — resolved by the Global Constraints' positive-delta-only fan-out rule, stated explicitly rather than left open.
- Bundles spec's `'sale'`-reason gap — deliberately NOT addressed here; that's the separate `2026-07-26-customer-return-movement-reason-design.md` plan's territory (this plan only adds `'consumed'`, which is never user-facing).

**Placeholder scan:** No "TBD"/"TODO" in any task. Two explicit, named scope
cuts are called out inline (Task 5's plain-text product-id input instead of
a searchable picker; Task 6's matching plain-text component display) — these
are deliberate, stated simplifications, not unfinished placeholders, and
don't block the mechanism from working end-to-end.

**Type consistency:** `ProductComponent` (Task 1) is the single type every
later task imports — checked Tasks 3, 5, 6, 7 all reference it identically.
`RecordMovementResult` (existing type from `recordStockMovement`) is reused
by `recordLinkedMovement` (Task 4) rather than a new type, so `StockLogForm`
(Task 6) doesn't need a type-level branch. `linked_movement_id` is spelled
identically across the migration (Task 1), `types.ts` (Task 1), and
`movement-history.tsx` (Task 7).

**Scope check:** Eight tasks, one migration pair, one shared mechanism. Right-sized for one plan — variant grouping (the other half of the bundles spec) is correctly excluded as its own separate plan.
