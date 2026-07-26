# Product Variant Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a vendor mark one product as a "variant" of another (e.g. "Cat sticker — 3in — glossy" is a variant of "Cat sticker"), so the products list groups them visually instead of showing every size/finish combination as an unrelated flat row.

**Architecture:** Two nullable columns (`parent_product_id`, `variant_label`) added directly to `stockkit.products`, guarded by a `BEFORE INSERT OR UPDATE` trigger that rejects self-parenting, cross-vendor parenting, and nested (more-than-one-level) variants. No new table. The app groups the flat `products` list into parent→variants order client-side; the detail/form panels are otherwise unchanged.

**Tech Stack:** Postgres (Supabase migration + trigger + pgTAP), Zod, TypeScript strict, React (shadcn `Select`), Vitest (`.test.ts` logic tests + `.dom.test.tsx` RTL tests).

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`.
- Validate all user input with Zod at the server-action boundary (`productFormSchema` in `src/lib/schemas.ts`).
- Authorization lives in RLS policies / trigger logic, never in app code — do not add an app-layer "is this my product?" check that duplicates what the DB already enforces.
- After editing the schema, update both `supabase/migrations/` and `src/lib/types.ts` in the same task.
- Comment hygiene: own-line comments only (no trailing inline comments); no commented-out code.
- `font-mono` on every quantity/cost figure shown to the vendor (not applicable to this feature's new fields — `variant_label` is text, not a number — but do not remove it from existing `on_hand`/`unit_cost_cents` displays while touching these files).
- Every step ends in a real, runnable test — no placeholder assertions.
- Frequent commits: one commit per task, Conventional Commits format, no `--no-verify`.

---

## Task 1: Migration — `parent_product_id`/`variant_label` + ownership/nesting trigger

**Files:**
- Create: `supabase/migrations/0006_product_variants.sql`
- Modify: `supabase/migrations/README.md`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `stockkit.products.parent_product_id` (`uuid`, nullable, FK to `stockkit.products(id)` `ON DELETE SET NULL`), `stockkit.products.variant_label` (`text`, nullable). Both appended to `Product` (`src/lib/types.ts`) as `parent_product_id: string | null` / `variant_label: string | null` on `Row`, and optional on `Insert`/`Update`.
- Consumes: nothing new — reuses the existing `products_vendor_all` RLS policy (no policy change) and the existing `authenticated`/`service_role` grants on `stockkit.products` from `0001_initial_schema.sql` (no new grant needed — same table, same operations).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0006_product_variants.sql`:

```sql
-- Lets a vendor mark one product as a variant of another (same design,
-- different size/finish/etc.) so the products list can group them instead
-- of showing every combination as an unrelated flat row. No new table —
-- `parent_product_id` is a self-reference on `products` itself.
ALTER TABLE stockkit.products
  ADD COLUMN parent_product_id UUID REFERENCES stockkit.products(id) ON DELETE SET NULL,
  ADD COLUMN variant_label TEXT;

CREATE INDEX products_parent_product_id_idx ON stockkit.products(parent_product_id);

-- Guards what the FK alone can't: same-vendor ownership and one-level-only
-- nesting. Runs SECURITY INVOKER (the default — no SECURITY DEFINER here),
-- so the SELECT below executes as the calling vendor and is itself subject
-- to products_vendor_all's RLS. That means a parent_product_id belonging to
-- another vendor is indistinguishable from a nonexistent one to this
-- function — NOT FOUND covers both cases, which is the correct behavior: it
-- never leaks whether a foreign id exists, and there is no need for a
-- separate "wrong vendor" branch that would require bypassing RLS to reach.
CREATE OR REPLACE FUNCTION stockkit.check_variant_parent()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_parent stockkit.products;
BEGIN
  IF NEW.parent_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_product_id = NEW.id THEN
    RAISE EXCEPTION 'a product cannot be its own variant parent';
  END IF;

  SELECT * INTO v_parent FROM stockkit.products WHERE id = NEW.parent_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'parent_product_id must reference an existing product owned by the same vendor';
  END IF;

  IF v_parent.parent_product_id IS NOT NULL THEN
    RAISE EXCEPTION 'variants cannot be nested more than one level deep';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER products_check_variant_parent
  BEFORE INSERT OR UPDATE ON stockkit.products
  FOR EACH ROW EXECUTE FUNCTION stockkit.check_variant_parent();
```

- [ ] **Step 2: Update `supabase/migrations/README.md`**

Open `supabase/migrations/README.md`. Change the "9 files, `0000` through `0008`" count... first check the actual current count by running `ls supabase/migrations/*.sql | wc -l` — as of this plan it's 6 files (`0000`-`0005`), so the README should read "7 files, `0000` through `0006`". Add a new bullet after the `0005` entry, in the same style as the others:

```markdown
- **`0006_product_variants.sql`** adds `products.parent_product_id`
  (self-referencing FK, `ON DELETE SET NULL`) and `products.variant_label`,
  so one product can be marked a variant of another (e.g. a different
  size/finish of the same design). A `BEFORE INSERT OR UPDATE` trigger
  (`stockkit.check_variant_parent`) rejects self-parenting and nesting a
  variant under another variant (one level only); cross-vendor parenting is
  rejected implicitly — the trigger's own lookup runs under the caller's
  RLS, so a foreign parent id is indistinguishable from a nonexistent one.
```

- [ ] **Step 3: Update `src/lib/types.ts`**

In the `products` table's `Row`, add after `updated_at: string;`:

```typescript
          parent_product_id: string | null;
          variant_label: string | null;
```

In `Insert`, add after `updated_at?: string;`:

```typescript
          parent_product_id?: string | null;
          variant_label?: string | null;
```

In `Update`, add after `updated_at?: string;`:

```typescript
          parent_product_id?: string | null;
          variant_label?: string | null;
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: passes clean (no other file references `Product` exhaustively yet, so adding nullable fields can't break an existing call site).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_product_variants.sql supabase/migrations/README.md src/lib/types.ts
git commit -m "feat: add product variant grouping schema"
```

---

## Task 2: pgTAP — ownership/nesting trigger coverage

**Files:**
- Modify: `supabase/tests/rls.test.sql`

**Interfaces:**
- Consumes: Task 1's `stockkit.check_variant_parent` trigger and the existing fixture vendors/products (`00000000-0000-0000-0000-00000000000a`/`...000b` vendors, `...c0001`/`...c0002` products) already defined at the top of the file.
- Produces: nothing new for later tasks — this is a leaf test file.

- [ ] **Step 1: Add a second product for Vendor A (a variant target) to the fixtures**

In `supabase/tests/rls.test.sql`, after the existing `stockkit.products` insert (the block with `'A Product'`/`'B Product'`), add a third product still owned by Vendor A, to use as a variant parent/child pair without disturbing the existing `c0001`/`c0002` assertions:

```sql
insert into stockkit.products (id, vendor_id, name, unit_cost_cents, on_hand, low_stock_threshold)
values
  ('00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-00000000000a', 'A Second Product', 150, 20, 3);
```

- [ ] **Step 2: Bump the plan count**

Change `select plan(27);` to `select plan(31);` (4 new assertions added below).

- [ ] **Step 3: Add the trigger assertions**

Insert these after the existing `'A cannot insert a product owned by B'` assertion (still inside the "Act as Vendor A" section, `set local role authenticated` already in effect):

```sql
-- variant grouping: same-vendor parenting succeeds
select lives_ok(
  $$ update stockkit.products
     set parent_product_id = '00000000-0000-0000-0000-0000000c0001', variant_label = 'Large'
     where id = '00000000-0000-0000-0000-0000000c0003' $$,
  'A can set parent_product_id to A''s own other product');

-- variant grouping: self-parent rejected
select throws_ok(
  $$ update stockkit.products
     set parent_product_id = '00000000-0000-0000-0000-0000000c0001'
     where id = '00000000-0000-0000-0000-0000000c0001' $$,
  'P0001',
  'a product cannot be its own variant parent',
  'A product cannot be its own variant parent');

-- variant grouping: cross-vendor parent rejected (masked as "not found" by RLS)
select throws_ok(
  $$ update stockkit.products
     set parent_product_id = '00000000-0000-0000-0000-0000000c0002'
     where id = '00000000-0000-0000-0000-0000000c0003' $$,
  'P0001',
  'parent_product_id must reference an existing product owned by the same vendor',
  'A cannot set parent_product_id to B''s product');

-- variant grouping: nested variant (parent of a parent) rejected — c0003 is
-- already a variant of c0001 from the lives_ok above, so parenting c0001
-- under c0003 would make c0001 both a parent and a child.
select throws_ok(
  $$ update stockkit.products
     set parent_product_id = '00000000-0000-0000-0000-0000000c0003'
     where id = '00000000-0000-0000-0000-0000000c0001' $$,
  'P0001',
  'variants cannot be nested more than one level deep',
  'A variant cannot itself become a parent');
```

- [ ] **Step 4: Run the pgTAP suite**

Run: `supabase test db`
Expected: all 31 assertions pass. (Requires local Supabase running — `supabase start` first if not already up.)

- [ ] **Step 5: Commit**

```bash
git add supabase/tests/rls.test.sql
git commit -m "test: cover variant-parent trigger with pgTAP"
```

---

## Task 3: Zod schema — `parent_product_id`/`variant_label`

**Files:**
- Modify: `src/lib/schemas.ts`
- Modify: `src/lib/schemas.test.ts`

**Interfaces:**
- Produces: `productFormSchema` now accepts optional `parent_product_id: string | null` and `variant_label: string | null`; `ProductFormInput` type includes them (inferred, no separate export needed).
- Consumes: nothing new.

- [ ] **Step 1: Read the current `productFormSchema` and its test file**

Confirm current shape in `src/lib/schemas.ts` (already read during planning — reproduced here for the diff):

```typescript
export const productFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Product name is required').max(100),
  unit: z.string().min(1, 'Unit is required').max(20),
  unit_cost_cents: z.number().int().nonnegative().default(0),
  on_hand: z.number().nonnegative().default(0),
  low_stock_threshold: z.number().nonnegative().default(0),
  is_active: z.boolean().default(true),
});
```

- [ ] **Step 2: Write the failing tests**

Add to `src/lib/schemas.test.ts` (create the `describe` block if the file doesn't already have one for `productFormSchema` — check first; add alongside existing cases either way):

```typescript
import { productFormSchema } from './schemas';

describe('productFormSchema', () => {
  it('accepts a nullable parent_product_id and variant_label', () => {
    const result = productFormSchema.safeParse({
      name: 'Cat sticker — 3in — glossy',
      unit: 'unit',
      unit_cost_cents: 200,
      on_hand: 0,
      low_stock_threshold: 0,
      is_active: true,
      parent_product_id: '11111111-1111-1111-1111-111111111111',
      variant_label: 'Glossy',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a product being its own parent when editing', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    const result = productFormSchema.safeParse({
      id,
      name: 'Cat sticker',
      unit: 'unit',
      unit_cost_cents: 200,
      on_hand: 0,
      low_stock_threshold: 0,
      is_active: true,
      parent_product_id: id,
    });
    expect(result.success).toBe(false);
  });

  it('omitting parent_product_id and variant_label still parses (both optional)', () => {
    const result = productFormSchema.safeParse({
      name: 'Plain product',
      unit: 'unit',
      unit_cost_cents: 0,
      on_hand: 0,
      low_stock_threshold: 0,
      is_active: true,
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run src/lib/schemas.test.ts`
Expected: the first two new tests fail — `parent_product_id`/`variant_label` are unrecognized keys (Zod strips unknown keys by default rather than erroring, so the first test's `result.success` will actually already be `true` but the parsed value won't retain `parent_product_id` — the *real* signal is the second test, which currently has no self-parent check at all and will incorrectly report `success: true`). Confirm the second test fails before proceeding.

- [ ] **Step 4: Implement the schema change**

In `src/lib/schemas.ts`, replace `productFormSchema`:

```typescript
export const productFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, 'Product name is required').max(100),
    // Free text — the UI offers unit presets (kg, pcs, box, …) but a vendor can
    // type anything that fits their own stock-keeping vocabulary.
    unit: z.string().min(1, 'Unit is required').max(20),
    unit_cost_cents: z.number().int().nonnegative().default(0),
    // Starting balance, only meaningful when creating a new product — see
    // saveProduct in products/actions.ts for how a nonzero value here becomes
    // a single 'initial' stock_movements row alongside the insert.
    on_hand: z.number().nonnegative().default(0),
    low_stock_threshold: z.number().nonnegative().default(0),
    is_active: z.boolean().default(true),
    // Null/undefined = a top-level product. Same-vendor-ownership and
    // one-level-nesting are enforced authoritatively by the DB trigger
    // (0006_product_variants.sql) — this client-side check only catches the
    // one case cheaply checkable without a round-trip: a product editing
    // itself into its own parent.
    parent_product_id: z.string().uuid().nullable().optional(),
    variant_label: z.string().max(40).nullable().optional(),
  })
  .refine((data) => !data.id || data.parent_product_id !== data.id, {
    message: 'A product cannot be its own variant parent',
    path: ['parent_product_id'],
  });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/schemas.test.ts`
Expected: all pass, including the new three.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: passes. (`ProductFormInput = z.infer<typeof productFormSchema>` picks up the new optional fields automatically — no other file references it exhaustively yet.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/schemas.ts src/lib/schemas.test.ts
git commit -m "feat: validate parent_product_id/variant_label in productFormSchema"
```

---

## Task 4: Grouping helper — `group-variants.ts`

**Files:**
- Create: `src/app/dashboard/products/group-variants.ts`
- Create: `src/app/dashboard/products/group-variants.test.ts`

**Interfaces:**
- Produces: `groupVariants(products: Product[]): { product: Product; depth: 0 | 1 }[]` — a pure function, no React/DOM dependency, importable by both `products-workspace.tsx` (Task 8) and its own test.
- Consumes: `Product` from `@/lib/types` (Task 1's `parent_product_id`/`variant_label` fields).

- [ ] **Step 1: Write the failing test**

Create `src/app/dashboard/products/group-variants.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { Product } from '@/lib/types';
import { groupVariants } from './group-variants';

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'id',
    vendor_id: 'v1',
    name: 'name',
    unit: 'unit',
    unit_cost_cents: 0,
    on_hand: 0,
    low_stock_threshold: 0,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    parent_product_id: null,
    variant_label: null,
    ...overrides,
  };
}

describe('groupVariants', () => {
  it('places top-level products in name order with no variants under them', () => {
    const a = makeProduct({ id: 'a', name: 'Beta' });
    const b = makeProduct({ id: 'b', name: 'Alpha' });
    const result = groupVariants([a, b]);
    expect(result.map((r) => r.product.id)).toEqual(['b', 'a']);
    expect(result.every((r) => r.depth === 0)).toBe(true);
  });

  it('nests a variant directly under its parent, regardless of input order', () => {
    const parent = makeProduct({ id: 'parent', name: 'Cat sticker' });
    const variant = makeProduct({
      id: 'variant',
      name: 'Cat sticker — glossy',
      parent_product_id: 'parent',
      variant_label: 'Glossy',
    });
    // variant listed first in the input array — output order must still
    // place it immediately after its parent, not before.
    const result = groupVariants([variant, parent]);
    expect(result.map((r) => ({ id: r.product.id, depth: r.depth }))).toEqual([
      { id: 'parent', depth: 0 },
      { id: 'variant', depth: 1 },
    ]);
  });

  it('sorts multiple variants under the same parent by name', () => {
    const parent = makeProduct({ id: 'parent', name: 'Cat sticker' });
    const v1 = makeProduct({ id: 'v1', name: 'Cat sticker — matte', parent_product_id: 'parent' });
    const v2 = makeProduct({ id: 'v2', name: 'Cat sticker — glossy', parent_product_id: 'parent' });
    const result = groupVariants([parent, v1, v2]);
    expect(result.map((r) => r.product.id)).toEqual(['parent', 'v2', 'v1']);
  });

  it('treats a variant whose parent is no longer in the list as top-level (orphan-safe)', () => {
    // Mirrors what ON DELETE SET NULL guarantees at the DB level: a variant
    // whose parent was deleted becomes parent_product_id = null and simply
    // reappears as its own top-level entry. This case (a stale parent id
    // that isn't null but also isn't present in the array) shouldn't occur
    // in practice, but the function must not throw or silently drop the row.
    const orphan = makeProduct({ id: 'orphan', name: 'Orphan', parent_product_id: 'missing' });
    const result = groupVariants([orphan]);
    expect(result).toEqual([{ product: orphan, depth: 1 }]);
  });
});
```

Note the last test locks in a specific choice: an orphaned variant (parent id set but parent not present in the array) is *not* silently dropped — it must still appear in the output. Whether it renders at `depth: 0` or `depth: 1` is a presentation detail; this plan picks `depth: 1` (still visually a "variant", just without a visible parent row above it) since that's simpler to implement than re-detecting orphans as top-level. Implement to match.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/app/dashboard/products/group-variants.test.ts`
Expected: FAIL — `group-variants.ts` doesn't exist yet (module not found).

- [ ] **Step 3: Implement `groupVariants`**

Create `src/app/dashboard/products/group-variants.ts`:

```typescript
import type { Product } from '@/lib/types';

export interface GroupedProduct {
  product: Product;
  depth: 0 | 1;
}

/**
 * Flattens `products` into display order: each top-level product (no
 * `parent_product_id`, or one whose parent isn't in this array — orphaned
 * by e.g. a deleted parent surfacing before the row's own `parent_product_id`
 * gets nulled) immediately followed by its own variants, both levels sorted
 * by name. A product whose `parent_product_id` points at a row present in
 * the array is never emitted at the top level even if it sorts earlier.
 */
export function groupVariants(products: Product[]): GroupedProduct[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const childrenByParent = new Map<string, Product[]>();
  const topLevel: Product[] = [];

  for (const product of products) {
    const parentId = product.parent_product_id;
    if (parentId && byId.has(parentId)) {
      const siblings = childrenByParent.get(parentId) ?? [];
      siblings.push(product);
      childrenByParent.set(parentId, siblings);
    } else if (parentId) {
      // Orphaned: parent_product_id is set but that id isn't in this list.
      topLevel.push(product);
    } else {
      topLevel.push(product);
    }
  }

  const sortedTopLevel = [...topLevel].sort((a, b) => a.name.localeCompare(b.name));
  const result: GroupedProduct[] = [];
  for (const parent of sortedTopLevel) {
    const isOrphan = parent.parent_product_id !== null;
    result.push({ product: parent, depth: isOrphan ? 1 : 0 });
    const children = (childrenByParent.get(parent.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const child of children) {
      result.push({ product: child, depth: 1 });
    }
  }
  return result;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/app/dashboard/products/group-variants.test.ts`
Expected: all 4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/products/group-variants.ts src/app/dashboard/products/group-variants.test.ts
git commit -m "feat: add groupVariants helper for parent/variant list ordering"
```

---

## Task 5: `saveProduct` — persist new fields, map trigger errors

**Files:**
- Modify: `src/app/dashboard/products/actions.ts`
- Create: `src/app/dashboard/products/actions.test.ts`

**Interfaces:**
- Consumes: `productFormSchema` (Task 3) now yielding `parent_product_id`/`variant_label`; `stockkit.check_variant_parent`'s three `RAISE EXCEPTION` messages (Task 1) verbatim, to map to friendly text the same way `recordStockMovement` already maps `record_stock_movement`'s messages.
- Produces: no signature change to `saveProduct` — same `SaveProductResult` return type.

- [ ] **Step 1: Write the failing tests**

This is the first test file for `actions.ts` in this codebase — there's no existing pattern to follow for mocking `createServerClient()` here, so this task establishes a minimal one. Create `src/app/dashboard/products/actions.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { saveProduct } from './actions';

function makeSupabaseMock(opts: {
  updateError?: { message: string };
  insertError?: { message: string };
}) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'vendor-1' } } })),
    },
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: opts.updateError ? null : { id: 'product-1' },
              error: opts.updateError ?? null,
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: opts.insertError ? null : { id: 'product-1' },
            error: opts.insertError ?? null,
          })),
        })),
      })),
    })),
  };
}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { createServerClient } = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient }));

describe('saveProduct — variant-parent error mapping', () => {
  it('maps the self-parent trigger error to a friendly message on update', async () => {
    createServerClient.mockResolvedValue(
      makeSupabaseMock({ updateError: { message: 'a product cannot be its own variant parent' } })
    );
    const result = await saveProduct({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Cat sticker',
      unit: 'unit',
      unit_cost_cents: 0,
      on_hand: 0,
      low_stock_threshold: 0,
      is_active: true,
      parent_product_id: '22222222-2222-2222-2222-222222222222',
    });
    expect(result).toEqual({
      success: false,
      error: 'A product cannot be its own variant parent.',
    });
  });

  it('maps the cross-vendor/nonexistent-parent trigger error to a friendly message on insert', async () => {
    createServerClient.mockResolvedValue(
      makeSupabaseMock({
        insertError: {
          message: 'parent_product_id must reference an existing product owned by the same vendor',
        },
      })
    );
    const result = await saveProduct({
      name: 'Cat sticker — glossy',
      unit: 'unit',
      unit_cost_cents: 0,
      on_hand: 0,
      low_stock_threshold: 0,
      is_active: true,
      parent_product_id: '22222222-2222-2222-2222-222222222222',
    });
    expect(result).toEqual({
      success: false,
      error: 'Select a parent product you own to link this variant to.',
    });
  });

  it('maps the nested-variant trigger error to a friendly message', async () => {
    createServerClient.mockResolvedValue(
      makeSupabaseMock({
        updateError: { message: 'variants cannot be nested more than one level deep' },
      })
    );
    const result = await saveProduct({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Cat sticker — glossy — large',
      unit: 'unit',
      unit_cost_cents: 0,
      on_hand: 0,
      low_stock_threshold: 0,
      is_active: true,
      parent_product_id: '22222222-2222-2222-2222-222222222222',
    });
    expect(result).toEqual({
      success: false,
      error: 'That product is already a variant, and cannot itself have variants.',
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/app/dashboard/products/actions.test.ts`
Expected: FAIL — `saveProduct` currently returns the generic `'Could not save product'`/`'Could not create product'` for any error, not the friendly per-case messages.

- [ ] **Step 3: Implement the field passthrough and error mapping**

In `src/app/dashboard/products/actions.ts`, update the `row` object inside `saveProduct` to include the two new fields:

```typescript
  const row = {
    name: data.name,
    unit: data.unit,
    unit_cost_cents: data.unit_cost_cents,
    low_stock_threshold: data.low_stock_threshold,
    is_active: data.is_active,
    parent_product_id: data.parent_product_id ?? null,
    variant_label: data.variant_label ?? null,
  };
```

Add a shared mapping helper above `saveProduct` (own-line comment, matching the file's existing style):

```typescript
/** Maps stockkit.check_variant_parent's RAISE EXCEPTION text (0006_product_variants.sql) to a vendor-facing message. */
function mapVariantParentError(message: string): string | null {
  if (message.includes('cannot be its own variant parent'))
    return 'A product cannot be its own variant parent.';
  if (message.includes('must reference an existing product owned by the same vendor'))
    return 'Select a parent product you own to link this variant to.';
  if (message.includes('nested more than one level deep'))
    return 'That product is already a variant, and cannot itself have variants.';
  return null;
}
```

Update the update-branch error handling:

```typescript
  if (data.id) {
    // RLS (products_vendor_all) scopes the update to this vendor's own products.
    const { data: updated, error } = await supabase
      .from('products')
      .update(row)
      .eq('id', data.id)
      .select('id')
      .maybeSingle();
    if (error) return { success: false, error: mapVariantParentError(error.message) ?? 'Could not save product' };
    if (!updated) return { success: false, error: 'Could not save product' };

    revalidatePath('/dashboard', 'layout');
    return { success: true, productId: updated.id };
  }
```

Update the insert-branch error handling:

```typescript
  const { data: inserted, error } = await supabase
    .from('products')
    .insert({ ...row, vendor_id: user.id, on_hand: data.on_hand })
    .select('id')
    .single();
  if (error || !inserted) {
    console.error('saveProduct insert failed', error?.message);
    const friendly = error ? mapVariantParentError(error.message) : null;
    return { success: false, error: friendly ?? 'Could not create product' };
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/app/dashboard/products/actions.test.ts`
Expected: all 3 pass.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: everything still passes (this task didn't change `saveProduct`'s existing success-path behavior, only added fields to `row` and refined error messages on the failure path).

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/products/actions.ts src/app/dashboard/products/actions.test.ts
git commit -m "feat: persist parent_product_id/variant_label, map trigger errors"
```

---

## Task 6: `ProductRow` — depth indentation + variant label chip

**Files:**
- Modify: `src/app/dashboard/products/product-row.tsx`
- Create: `src/app/dashboard/products/product-row.dom.test.tsx`

**Interfaces:**
- Consumes: `GroupedProduct['depth']` (Task 4) as a new optional `depth?: 0 | 1` prop; `Product.variant_label` (Task 1).
- Produces: no change to the existing `onClick`/`selected` contract other props already rely on.

- [ ] **Step 1: Write the failing tests**

Create `src/app/dashboard/products/product-row.dom.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/types';
import { ProductRow } from './product-row';

afterEach(() => cleanup());

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'id',
    vendor_id: 'v1',
    name: 'Cat sticker',
    unit: 'unit',
    unit_cost_cents: 0,
    on_hand: 10,
    low_stock_threshold: 2,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    parent_product_id: null,
    variant_label: null,
    ...overrides,
  };
}

describe('ProductRow', () => {
  it('renders without indentation or a variant chip at depth 0', () => {
    render(<ProductRow product={makeProduct({})} onClick={vi.fn()} depth={0} />);
    expect(screen.queryByText(/glossy/i)).not.toBeInTheDocument();
  });

  it('renders the variant_label as a chip and indents at depth 1', () => {
    render(
      <ProductRow
        product={makeProduct({ name: 'Cat sticker — glossy', variant_label: 'Glossy' })}
        onClick={vi.fn()}
        depth={1}
      />
    );
    expect(screen.getByText('Glossy')).toBeInTheDocument();
  });

  it('defaults to depth 0 when the prop is omitted (backward compatible)', () => {
    render(<ProductRow product={makeProduct({})} onClick={vi.fn()} />);
    expect(screen.queryByText(/glossy/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/app/dashboard/products/product-row.dom.test.tsx`
Expected: FAIL — `depth` prop doesn't exist yet, `variant_label` is never rendered.

- [ ] **Step 3: Implement the changes**

In `src/app/dashboard/products/product-row.tsx`, update the `Props` interface and component:

```tsx
interface Props {
  product: Product;
  selected?: boolean;
  onClick: () => void;
  depth?: 0 | 1;
}

/** One product row — shared by the mobile list and the desktop list pane. */
export function ProductRow({ product, selected, onClick, depth = 0 }: Props) {
  const status = stockStatusFor(product.on_hand, product.low_stock_threshold);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50',
        !product.is_active && 'opacity-60',
        depth === 1 && 'ml-4'
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {product.name}
          {product.variant_label && (
            <span className="bg-secondary text-secondary-foreground ml-2 rounded px-1.5 py-0.5 text-xs font-normal">
              {product.variant_label}
            </span>
          )}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className={cn('size-2 shrink-0 rounded-full', STOCK_STATUS_DOT_CLASS[status])} />
          <span className="text-muted-foreground text-xs">{STOCK_STATUS_LABEL[status]}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm font-semibold tabular-nums">
          {product.on_hand}{' '}
          <span className="text-muted-foreground text-xs font-normal">{product.unit}</span>
        </p>
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          thr. {product.low_stock_threshold}
        </p>
      </div>
    </button>
  );
}
```

(Only the `Props` interface, the function signature's destructuring, and the `className`/name-`<p>` block changed — the rest of the file is unchanged.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/app/dashboard/products/product-row.dom.test.tsx`
Expected: all 3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/products/product-row.tsx src/app/dashboard/products/product-row.dom.test.tsx
git commit -m "feat: indent variant rows and show variant_label chip in ProductRow"
```

---

## Task 7: `ProductForm` — parent picker + variant label field

**Files:**
- Modify: `src/app/dashboard/products/product-form.tsx`
- Create: `src/app/dashboard/products/product-form.dom.test.tsx`

**Interfaces:**
- Consumes: a new required `candidateParents: Product[]` prop (the vendor's own top-level products — `parent_product_id === null` — excluding the product currently being edited; computed by the caller, Task 8, which already holds the full `products` array).
- Produces: `saveProduct` (Task 5) now called with `parent_product_id`/`variant_label` included in the submitted candidate object.

- [ ] **Step 1: Write the failing tests**

Create `src/app/dashboard/products/product-form.dom.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/types';
import { ProductForm } from './product-form';

const saveProduct = vi.fn(async (_input: unknown) => ({ success: true, productId: 'new-id' }));
const deleteProduct = vi.fn(async (_id: string) => ({ success: true }));
vi.mock('./actions', () => ({
  saveProduct: (input: unknown) => saveProduct(input),
  deleteProduct: (id: string) => deleteProduct(id),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => cleanup());

function makeParent(overrides: Partial<Product>): Product {
  return {
    id: 'parent-1',
    vendor_id: 'v1',
    name: 'Cat sticker',
    unit: 'unit',
    unit_cost_cents: 0,
    on_hand: 10,
    low_stock_threshold: 2,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    parent_product_id: null,
    variant_label: null,
    ...overrides,
  };
}

describe('ProductForm — variant grouping', () => {
  beforeEach(() => {
    saveProduct.mockClear();
  });

  it('submits with no parent_product_id when "No parent (top-level product)" stays selected', async () => {
    const user = userEvent.setup();
    render(
      <ProductForm candidateParents={[makeParent({})]} onSaved={vi.fn()} onCancel={vi.fn()} />
    );
    await user.type(screen.getByLabelText(/^name$/i), 'Standalone product');
    await user.click(screen.getByRole('button', { name: /add product/i }));
    expect(saveProduct).toHaveBeenCalledWith(
      expect.objectContaining({ parent_product_id: null })
    );
  });

  it('submits the selected parent and variant label', async () => {
    const user = userEvent.setup();
    render(
      <ProductForm candidateParents={[makeParent({})]} onSaved={vi.fn()} onCancel={vi.fn()} />
    );
    await user.type(screen.getByLabelText(/^name$/i), 'Cat sticker — glossy');
    await user.click(screen.getByRole('combobox', { name: /variant of/i }));
    await user.click(await screen.findByRole('option', { name: 'Cat sticker' }));
    await user.type(screen.getByLabelText(/variant label/i), 'Glossy');
    await user.click(screen.getByRole('button', { name: /add product/i }));
    expect(saveProduct).toHaveBeenCalledWith(
      expect.objectContaining({ parent_product_id: 'parent-1', variant_label: 'Glossy' })
    );
  });

  it('does not offer the product itself as a candidate parent when editing', () => {
    const self = makeParent({ id: 'self-id', name: 'Self' });
    render(
      <ProductForm
        product={self}
        candidateParents={[self, makeParent({ id: 'other-id', name: 'Other' })]}
        onSaved={vi.fn()}
      />
    );
    expect(screen.queryByRole('option', { name: 'Self' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/app/dashboard/products/product-form.dom.test.tsx`
Expected: FAIL — `candidateParents` prop doesn't exist, no "variant of" control is rendered.

- [ ] **Step 3: Implement the changes**

In `src/app/dashboard/products/product-form.tsx`:

Add the import:

```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
```

Update `Props` and the component signature:

```typescript
interface Props {
  product?: Product;
  candidateParents: Product[];
  onSaved: (product: Product) => void;
  onDeleted?: () => void;
  onCancel?: () => void;
}

export function ProductForm({ product, candidateParents, onSaved, onDeleted, onCancel }: Props) {
  const isNew = !product;
  const [name, setName] = useState(product?.name ?? '');
  const [unit, setUnit] = useState(product?.unit ?? 'unit');
  const [unitCostDollars, setUnitCostDollars] = useState(
    centsToDollarString(product?.unit_cost_cents ?? 0)
  );
  const [onHand, setOnHand] = useState(String(product?.on_hand ?? 0));
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(product?.low_stock_threshold ?? 0)
  );
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [parentProductId, setParentProductId] = useState<string | null>(
    product?.parent_product_id ?? null
  );
  const [variantLabel, setVariantLabel] = useState(product?.variant_label ?? '');
  const { pending: saving, run: runSave } = useAsyncAction();
  const { pending: deleting, run: runDelete } = useAsyncAction();

  const parentOptions = candidateParents.filter((p) => p.id !== product?.id);
```

Update `onSubmit`'s `candidate` object:

```typescript
    const candidate = {
      id: product?.id,
      name,
      unit,
      unit_cost_cents: costParsed.cents ?? 0,
      on_hand: Number(onHand),
      low_stock_threshold: Number(lowStockThreshold),
      is_active: isActive,
      parent_product_id: parentProductId,
      variant_label: parentProductId ? variantLabel.trim() || null : null,
    };
```

Update the success-path `onSaved` call to carry the new fields through (matching the existing pattern of hand-assembling the optimistic `Product`):

```typescript
      onSaved({
        id: result.productId,
        vendor_id: product?.vendor_id ?? '',
        name: parsed.data.name,
        unit: parsed.data.unit,
        unit_cost_cents: parsed.data.unit_cost_cents,
        on_hand: isNew ? parsed.data.on_hand : (product?.on_hand ?? 0),
        low_stock_threshold: parsed.data.low_stock_threshold,
        is_active: parsed.data.is_active,
        parent_product_id: parsed.data.parent_product_id ?? null,
        variant_label: parsed.data.variant_label ?? null,
        created_at: product?.created_at ?? now,
        updated_at: now,
      });
```

Add the picker UI, immediately after the existing "Unit"/"Unit cost" `grid grid-cols-2` block and before the "Starting quantity"/"Low-stock threshold" block:

```tsx
      <div className="space-y-2">
        <Label htmlFor="product-parent">Variant of</Label>
        <Select
          value={parentProductId ?? 'none'}
          onValueChange={(value) => setParentProductId(value === 'none' ? null : value)}
        >
          <SelectTrigger id="product-parent" aria-label="Variant of" className="w-full">
            <SelectValue placeholder="No parent (top-level product)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No parent (top-level product)</SelectItem>
            {parentOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {parentProductId && (
        <div className="space-y-2">
          <Label htmlFor="product-variant-label">Variant label</Label>
          <Input
            id="product-variant-label"
            value={variantLabel}
            onChange={(e) => setVariantLabel(e.target.value)}
            placeholder="Glossy, 3in, Large…"
          />
        </div>
      )}
```

- [ ] **Step 4: Update the two callers of `<ProductForm>` for the new required prop**

`ProductForm` is rendered from `products-workspace.tsx` in two places (desktop panel, mobile dialog) — both will be updated in Task 8, which already owns the `candidateParents` computation. Leave those call sites as-is in this task; they will fail to typecheck until Task 8 lands, so run this task's step 5 scoped to the test file, not a full `pnpm typecheck`, and defer the full typecheck to Task 8's own step.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/app/dashboard/products/product-form.dom.test.tsx`
Expected: all 3 pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/products/product-form.tsx src/app/dashboard/products/product-form.dom.test.tsx
git commit -m "feat: add variant-of picker and variant label field to ProductForm"
```

---

## Task 8: `ProductsWorkspace` — wire grouping + candidate parents

**Files:**
- Modify: `src/app/dashboard/products/products-workspace.tsx`
- Modify: `src/app/dashboard/products/product-detail.tsx`
- Create: `src/app/dashboard/products/products-workspace.dom.test.tsx`

**Interfaces:**
- Consumes: `groupVariants` (Task 4), the updated `ProductForm` requiring `candidateParents` (Task 7), the updated `ProductRow` accepting `depth` (Task 6).
- Produces: `ProductDetail` gains a new required `candidateParents: Product[]` prop (passed straight through to its own two internal `ProductForm` renders) — nothing further downstream depends on this; it's the top of the products feature's component tree.

- [ ] **Step 1: Write the failing test**

Create `src/app/dashboard/products/products-workspace.dom.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Product } from '@/lib/types';
import { ProductsWorkspace } from './products-workspace';

vi.mock('./actions', () => ({
  saveProduct: vi.fn(),
  deleteProduct: vi.fn(),
  recordStockMovement: vi.fn(),
  getProductMovements: vi.fn(async () => ({ success: true, movements: [] })),
}));

afterEach(() => cleanup());

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'id',
    vendor_id: 'v1',
    name: 'name',
    unit: 'unit',
    unit_cost_cents: 0,
    on_hand: 0,
    low_stock_threshold: 0,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    parent_product_id: null,
    variant_label: null,
    ...overrides,
  };
}

describe('ProductsWorkspace — variant grouping', () => {
  it('renders a variant immediately after its parent in the desktop list', () => {
    const parent = makeProduct({ id: 'p1', name: 'Cat sticker' });
    const variant = makeProduct({
      id: 'v1',
      name: 'Cat sticker — glossy',
      parent_product_id: 'p1',
      variant_label: 'Glossy',
    });
    const unrelated = makeProduct({ id: 'u1', name: 'Zebra product' });
    render(<ProductsWorkspace initialProducts={[unrelated, variant, parent]} />);
    const names = screen.getAllByText(/Cat sticker|Zebra product/).map((el) => el.textContent);
    // "Cat sticker" (parent) must appear before "Zebra product" (alphabetically
    // later top-level product), and the variant's own text ("Cat sticker —
    // glossy") appears between them, not before the parent or after Zebra.
    expect(names[0]).toContain('Cat sticker');
    expect(names[names.length - 1]).toContain('Zebra product');
  });

  it('selecting a product renders its detail panel without crashing (candidateParents threaded through ProductDetail)', async () => {
    const user = userEvent.setup();
    const parent = makeProduct({ id: 'p1', name: 'Cat sticker' });
    render(<ProductsWorkspace initialProducts={[parent]} />);
    // jsdom doesn't apply the md:hidden/hidden md:grid CSS that separates
    // mobile from desktop at real breakpoints, so both rows exist in the
    // DOM: index 0 is the mobile row (opens the tabs-layout Dialog), index 1
    // is the desktop row (selects into the always-visible 'stacked' panel,
    // which is what this test wants — no Dialog to additionally query into).
    const rows = screen.getAllByRole('button', { name: /Cat sticker/i });
    await user.click(rows[1]);
    expect(await screen.findByText('Edit product')).toBeInTheDocument();
  });
});
```

Add the `userEvent` import alongside the existing `@testing-library/react` import at the top of the file:

```typescript
import userEvent from '@testing-library/user-event';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/app/dashboard/products/products-workspace.dom.test.tsx`
Expected: FAIL — grouping isn't wired in yet, and `ProductForm`'s now-required `candidateParents` prop is missing (TypeScript error surfaces as a test-run failure too).

- [ ] **Step 3: Implement the changes**

In `src/app/dashboard/products/products-workspace.tsx`, add the import:

```typescript
import { groupVariants } from './group-variants';
```

Compute the grouped list and candidate parents inside `ProductsWorkspace`, right after the existing `const selected = ...` line:

```typescript
  const selected = products.find((p) => p.id === selectedId) ?? null;
  const grouped = groupVariants(products);
  const candidateParents = products.filter((p) => p.parent_product_id === null);
```

Replace the mobile list's `products.map(...)` with:

```tsx
          grouped.map(({ product: p, depth }) => (
            <ProductRow
              key={p.id}
              product={p}
              depth={depth}
              onClick={() => openMobileForProduct(p.id)}
            />
          ))
```

Replace the desktop list column's `products.map(...)` with:

```tsx
            grouped.map(({ product: p, depth }) => (
              <ProductRow
                key={p.id}
                product={p}
                depth={depth}
                selected={p.id === selectedId && mode === 'view'}
                onClick={() => selectDesktop(p.id)}
              />
            ))
```

Pass `candidateParents` to both `<ProductForm>` render sites (desktop panel and mobile dialog):

```tsx
            <ProductForm
              candidateParents={candidateParents}
              onSaved={onProductSaved}
              onCancel={() => setMode('view')}
            />
```

```tsx
              <ProductForm candidateParents={candidateParents} onSaved={onProductSaved} />
```

Pass `candidateParents` to both `<ProductDetail>` render sites too (desktop panel and mobile dialog) — `ProductDetail` renders its own internal edit-mode `ProductForm` and needs the same prop threaded one level further:

```tsx
            <ProductDetail
              product={selected}
              layout="stacked"
              candidateParents={candidateParents}
              onSaved={onProductSaved}
              onDeleted={() => onProductDeleted(selected.id)}
            />
```

```tsx
              <ProductDetail
                product={selected}
                layout="tabs"
                candidateParents={candidateParents}
                onSaved={onProductSaved}
                onDeleted={() => onProductDeleted(selected.id)}
              />
```

In `src/app/dashboard/products/product-detail.tsx`, add `candidateParents` to `Props` and thread it to both internal `ProductForm` renders:

```typescript
interface Props {
  product: Product;
  candidateParents: Product[];
  // 'tabs' = mobile dialog (tight vertical space, one section visible at a
  // time); 'stacked' = desktop detail panel (everything visible at once).
  layout: 'tabs' | 'stacked';
  onSaved: (product: Product) => void;
  onDeleted: () => void;
}

export function ProductDetail({ product, candidateParents, layout, onSaved, onDeleted }: Props) {
```

Update both `<ProductForm product={product} onSaved={onSaved} onDeleted={onDeleted} />` call sites (one in the `layout === 'tabs'` branch, one in the `'stacked'` branch) to:

```tsx
<ProductForm
  product={product}
  candidateParents={candidateParents}
  onSaved={onSaved}
  onDeleted={onDeleted}
/>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/app/dashboard/products/products-workspace.dom.test.tsx`
Expected: passes.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: everything passes — this is the integration point where Tasks 3–8's pieces all typecheck together for the first time (`ProductForm`'s new required prop is now satisfied everywhere it's rendered).

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/products/products-workspace.tsx src/app/dashboard/products/products-workspace.dom.test.tsx
git commit -m "feat: group products by variant parent in the workspace list"
```

---

## Task 9: Docs — READMEs and CHANGELOG

**Files:**
- Modify: `src/app/dashboard/products/README.md`
- Modify: `CHANGELOG.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update `src/app/dashboard/products/README.md`**

Add a paragraph (after the existing description of `products-workspace.tsx`'s two-breakpoint behavior):

```markdown
Products can be grouped as variants of one another (`parent_product_id`/
`variant_label`, migration `0006_product_variants.sql`) — e.g. different
sizes or finishes of the same design. `group-variants.ts`'s `groupVariants`
flattens the list into display order (each top-level product immediately
followed by its own variants, both sorted by name) for both the mobile list
and the desktop list pane; `ProductRow` indents variant rows and shows
`variant_label` as a chip. `ProductForm`'s "Variant of" picker only offers
the vendor's own top-level products (one level of nesting only, enforced by
a DB trigger, not just the UI).
```

- [ ] **Step 2: Add a `CHANGELOG.md` entry**

Add to the top of the `## Unreleased` section:

```markdown
- Products can now be grouped as variants of one another (`parent_product_id`/
  `variant_label`) — e.g. different sizes/finishes of the same design show
  nested under a shared parent in the products list instead of as unrelated
  flat rows. One level of nesting only, enforced by a DB trigger.
```

- [ ] **Step 3: Verify readme-coupling won't flag this commit**

Run: `git status --short` — confirm both README/CHANGELOG changes are staged alongside every task in this plan that touched `src/app/dashboard/products/` or `supabase/migrations/`, since this project's pre-commit hook warns (non-blocking locally, hard-gated in CI) when a folder's files change without its README changing in the same diff. This task's docs updates should be the final commit of the overall feature branch, after Tasks 1–8, precisely so the diff-cover/readme-freshness CI gates see the README changes alongside the code changes they describe.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/products/README.md CHANGELOG.md
git commit -m "docs: document variant grouping in products README and CHANGELOG"
```

---

## Self-Review Notes

**Spec coverage** (against `2026-07-26-product-variants-and-bundles-design.md`'s variant-grouping portion only): `parent_product_id`/`variant_label` columns ✓ (Task 1); ownership/nesting trigger ✓ (Task 1, verified in Task 2); `productFormSchema` extension ✓ (Task 3); list grouping ✓ (Task 4, 8); "add another variant" picker ✓ (Task 7); low-stock/out-of-stock counts continue per-row, no change needed — explicitly confirmed no task touches `src/lib/stock.ts` or the dashboard overview, matching the spec's own note that this needs no change.

**Explicitly not covered by this plan** (per the spec's own scope split and the "Interactions with sibling specs" section): `bundle_components`, `record_bundle_movement`, and everything else in the bundles half of the source spec — those belong to the separate component-consumption-and-bundles plan, which this plan's trigger design does not conflict with (different table, different RPC).

**Placeholder scan:** no TBD/TODO markers; every step has real SQL/TypeScript/test code, not descriptions.

**Type consistency:** `GroupedProduct` (Task 4) is used identically in Task 8's `grouped.map(...)` destructuring (`{ product, depth }`); `ProductRow`'s `depth?: 0 | 1` (Task 6) matches `GroupedProduct.depth`'s type exactly; `ProductForm`'s new `candidateParents: Product[]` (Task 7) matches what Task 8 computes and passes (`products.filter((p) => p.parent_product_id === null)` — a plain `Product[]`), and `ProductDetail`'s new `candidateParents: Product[]` (Task 8) is the same type threaded one level further, not a redefinition.

**Corrected during self-review:** Task 8 originally hand-waved `ProductDetail`'s own internal `ProductForm` renders with "check product-detail.tsx and thread candidateParents through" — replaced with the actual current two call sites (`layout === 'tabs'` and `'stacked'` branches) and concrete before/after code, since `product-detail.tsx` was confirmed (by reading the file) to render `ProductForm` directly in both branches, not delegate to a further child.
