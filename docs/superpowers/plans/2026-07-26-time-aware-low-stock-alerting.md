# Time-Aware Low-Stock Alerting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a vendor mark a product as seasonal (active in specific calendar months) so the dashboard's low-stock/out-of-stock alerts are suppressed outside that window, instead of nagging year-round on products that are dormant on purpose.

**Architecture:** A new nullable-by-default `active_months SMALLINT[]` column on `products` (empty = always active, the default and current behavior for every existing product). A new pure function `isAlertSuppressed` in `src/lib/stock.ts` does the month-membership check; a new `computeOverviewStats` function (also in `stock.ts`) centralizes the dashboard's low/out/urgent filtering so it's unit-testable independently of the server component that renders it. `stockStatusFor` (the ok/low/out classifier used by the products workspace's status chips) is untouched — a vendor editing a seasonal product still sees its true status year-round; suppression only affects the dashboard's alert surfaces.

**Tech Stack:** Next.js 16 Server Components, Supabase Postgres (RLS unaffected — no policy change), Zod, Vitest + Testing Library, shadcn `ToggleGroup` (multi-select).

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`.
- Validate all user input with Zod at the form boundary (`productFormSchema`).
- No RLS/authorization change needed — `active_months` is just another column on `products`, already covered by the existing `products_vendor_all` policy.
- After editing the schema, update both `supabase/migrations/` and `src/lib/types.ts` by hand (no live Supabase project in this dev/CI environment — see AGENTS.md).
- Comment hygiene: own-line comments only, no trailing inline comments.
- `font-mono` on every quantity/cost figure shown to the vendor.
- Follow existing test conventions exactly: `*.test.ts` for pure logic, `*.dom.test.tsx` (with `// @vitest-environment jsdom` docblock) for component render tests; `*.dom.test.tsx` files rely on `test/setup.ts`'s global RTL `cleanup()` — do not add a redundant per-file `afterEach(cleanup)`.
- `isAlertSuppressed`/`computeOverviewStats` must take `now: Date` as an explicit parameter — never call `new Date()`/`Date.now()` inside the pure function itself, so tests can pass a fixed date.

---

### Task 1: `active_months` column + type mirror

**Files:**

- Create: `supabase/migrations/0006_product_seasonality.sql`
- Modify: `src/lib/types.ts:29-74` (the `products` table's `Row`/`Insert`/`Update` shapes)
- Modify: `supabase/migrations/README.md` (append the new migration to its numbered list, matching the existing entries' style)
- Modify: `supabase/README.md` (bump the migration file count/range if it's mentioned)

**Interfaces:**

- Produces: `Product['active_months']: number[]` (always present, defaults to `[]`), consumed by Task 2 (`stock.ts`), Task 3 (`schemas.ts`), Task 5 (`actions.ts`), Task 6 (`product-form.tsx`).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0006_product_seasonality.sql
-- Lets a vendor mark a product as seasonal (e.g. a holiday-only item),
-- so the dashboard's low-stock/out-of-stock alerts can be suppressed
-- outside its active months instead of nagging year-round on a product
-- that's dormant on purpose. Empty array = always active — the default,
-- and the correct value for every existing/non-seasonal product, so no
-- backfill is needed.
ALTER TABLE stockkit.products
  ADD COLUMN active_months SMALLINT[] NOT NULL DEFAULT '{}';
```

- [ ] **Step 2: Update `src/lib/types.ts` to match**

In the `products` table block, add `active_months: number[];` to `Row` (required, always present), and `active_months?: number[];` to `Insert`/`Update` (optional, defaults to `[]` at the DB level):

```typescript
      products: {
        Row: {
          id: string;
          vendor_id: string;
          name: string;
          unit: string;
          unit_cost_cents: number;
          on_hand: number;
          low_stock_threshold: number;
          is_active: boolean;
          active_months: number[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          name: string;
          unit?: string;
          unit_cost_cents?: number;
          on_hand?: number;
          low_stock_threshold?: number;
          is_active?: boolean;
          active_months?: number[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          name?: string;
          unit?: string;
          unit_cost_cents?: number;
          on_hand?: number;
          low_stock_threshold?: number;
          is_active?: boolean;
          active_months?: number[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_vendor_id_fkey';
            columns: ['vendor_id'];
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
```

- [ ] **Step 3: Update `supabase/migrations/README.md`**

Add a new bullet after the existing `0005` entry (bump the "9 files" count in the Contents intro to "10 files, `0000` through `0006`"):

```markdown
- **`0006_product_seasonality.sql`** adds `products.active_months
SMALLINT[]`, defaulting to `'{}'` (always active). A non-empty array
  lists the 1-12 calendar months a seasonal product is expected to sell;
  the dashboard overview uses it to suppress low-stock/out-of-stock
  alerts outside that window. No RLS change — the existing
  `products_vendor_all` policy already covers this column.
```

- [ ] **Step 4: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS (no other file references `active_months` yet, so this only confirms `types.ts` itself is syntactically valid — a migration has no Vitest-testable behavior on its own, unlike the tasks that follow).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_product_seasonality.sql supabase/migrations/README.md src/lib/types.ts
git commit -m "feat(db): add products.active_months for seasonal alert suppression"
```

---

### Task 2: `isAlertSuppressed` + `computeOverviewStats` in `src/lib/stock.ts`

**Files:**

- Modify: `src/lib/stock.ts`
- Create: `src/lib/stock.test.ts`

**Interfaces:**

- Consumes: `Product` type from `src/lib/types.ts` (Task 1).
- Produces: `isAlertSuppressed(activeMonths: number[], now: Date): boolean` and `computeOverviewStats(products: Product[], now: Date): { lowStock: Product[]; outOfStock: Product[]; urgent: Product[] }`, both exported from `src/lib/stock.ts` — consumed by Task 4 (`(overview)/page.tsx`).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/stock.test.ts
import { describe, expect, it } from 'vitest';

import { computeOverviewStats, isAlertSuppressed } from './stock';
import type { Product } from './types';

describe('isAlertSuppressed', () => {
  it('never suppresses when active_months is empty', () => {
    expect(isAlertSuppressed([], new Date(2026, 0, 1))).toBe(false);
  });

  it('does not suppress when the current month is in active_months', () => {
    // new Date(2026, 6, 15) is July (0-indexed month 6 => 7)
    expect(isAlertSuppressed([7, 12], new Date(2026, 6, 15))).toBe(false);
  });

  it('suppresses when the current month is absent from active_months', () => {
    expect(isAlertSuppressed([11, 12], new Date(2026, 6, 15))).toBe(true);
  });
});

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: overrides.id ?? 'p1',
    vendor_id: 'v1',
    name: overrides.name ?? 'Widget',
    unit: 'unit',
    unit_cost_cents: 100,
    on_hand: 0,
    low_stock_threshold: 0,
    is_active: true,
    active_months: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeOverviewStats', () => {
  const now = new Date(2026, 6, 15); // July

  it('includes a low-stock, always-active product in lowStock and urgent', () => {
    const p = makeProduct({ id: 'p1', on_hand: 2, low_stock_threshold: 5 });
    const stats = computeOverviewStats([p], now);
    expect(stats.lowStock).toEqual([p]);
    expect(stats.outOfStock).toEqual([]);
    expect(stats.urgent).toEqual([p]);
  });

  it('includes an out-of-stock, always-active product in outOfStock and urgent', () => {
    const p = makeProduct({ id: 'p2', on_hand: 0, low_stock_threshold: 5 });
    const stats = computeOverviewStats([p], now);
    expect(stats.outOfStock).toEqual([p]);
    expect(stats.urgent).toEqual([p]);
  });

  it('excludes a low-stock product outside its active_months from every list', () => {
    const p = makeProduct({
      id: 'p3',
      on_hand: 2,
      low_stock_threshold: 5,
      active_months: [11, 12],
    });
    const stats = computeOverviewStats([p], now);
    expect(stats.lowStock).toEqual([]);
    expect(stats.outOfStock).toEqual([]);
    expect(stats.urgent).toEqual([]);
  });

  it('includes a low-stock product inside its active_months', () => {
    const p = makeProduct({ id: 'p4', on_hand: 2, low_stock_threshold: 5, active_months: [7] });
    const stats = computeOverviewStats([p], now);
    expect(stats.lowStock).toEqual([p]);
  });

  it('caps urgent at 5, out-of-stock first', () => {
    const outOfStock = Array.from({ length: 3 }, (_, i) =>
      makeProduct({ id: `out${i}`, on_hand: 0, low_stock_threshold: 5 })
    );
    const lowStock = Array.from({ length: 4 }, (_, i) =>
      makeProduct({ id: `low${i}`, on_hand: 2, low_stock_threshold: 5 })
    );
    const stats = computeOverviewStats([...lowStock, ...outOfStock], now);
    expect(stats.urgent).toHaveLength(5);
    expect(stats.urgent.slice(0, 3)).toEqual(outOfStock);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test stock.test.ts`
Expected: FAIL — `isAlertSuppressed`/`computeOverviewStats` are not exported from `./stock` yet.

- [ ] **Step 3: Implement**

Append to `src/lib/stock.ts` (keep the existing `StockStatus`/`stockStatusFor`/label/class exports untouched):

```typescript
import type { Product } from './types';

/**
 * True when a seasonal product's active window excludes the given month.
 * Empty `activeMonths` means "always active" — never suppressed. `now` is
 * an explicit parameter (not read internally via `new Date()`) so this
 * stays a pure, directly testable function.
 */
export function isAlertSuppressed(activeMonths: number[], now: Date): boolean {
  if (activeMonths.length === 0) return false;
  return !activeMonths.includes(now.getMonth() + 1);
}

export interface OverviewStats {
  lowStock: Product[];
  outOfStock: Product[];
  urgent: Product[];
}

/**
 * The dashboard overview's low-stock/out-of-stock/urgent lists, with
 * alert-suppressed seasonal products excluded. `stockStatusFor` itself is
 * intentionally not reused here for the low/out split — the products
 * workspace's status chips call it directly against the raw on_hand/
 * threshold numbers and must keep showing true status regardless of
 * season; this function only filters which products surface as *alerts*.
 */
export function computeOverviewStats(products: Product[], now: Date): OverviewStats {
  const visible = products.filter((p) => !isAlertSuppressed(p.active_months, now));
  const lowStock = visible.filter((p) => p.on_hand > 0 && p.on_hand <= p.low_stock_threshold);
  const outOfStock = visible.filter((p) => p.on_hand <= 0);
  const urgent = [...outOfStock, ...lowStock].slice(0, 5);
  return { lowStock, outOfStock, urgent };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test stock.test.ts`
Expected: PASS (all cases above).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stock.ts src/lib/stock.test.ts
git commit -m "feat: add isAlertSuppressed and computeOverviewStats to stock.ts"
```

---

### Task 3: `productFormSchema` gains `active_months`

**Files:**

- Modify: `src/lib/schemas.ts:23-36` (`productFormSchema`)
- Modify: `src/lib/schemas.test.ts` (append; existing file only covers `passwordChangeSchema` today)

**Interfaces:**

- Consumes: nothing new.
- Produces: `ProductFormInput['active_months']: number[]` (via the existing `z.infer<typeof productFormSchema>` export) — consumed by Task 5 (`actions.ts`) and Task 6 (`product-form.tsx`).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/schemas.test.ts`:

```typescript
import { productFormSchema } from './schemas';

describe('productFormSchema active_months', () => {
  const base = {
    name: 'Widget',
    unit: 'unit',
    unit_cost_cents: 100,
    on_hand: 0,
    low_stock_threshold: 0,
    is_active: true,
  };

  it('defaults to an empty array when omitted', () => {
    const result = productFormSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.active_months).toEqual([]);
  });

  it('accepts a valid list of months', () => {
    const result = productFormSchema.safeParse({ ...base, active_months: [11, 12] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.active_months).toEqual([11, 12]);
  });

  it('rejects a month outside 1-12', () => {
    const result = productFormSchema.safeParse({ ...base, active_months: [0] });
    expect(result.success).toBe(false);
  });

  it('rejects more than 12 entries', () => {
    const result = productFormSchema.safeParse({
      ...base,
      active_months: Array.from({ length: 13 }, (_, i) => (i % 12) + 1),
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test schemas.test.ts`
Expected: FAIL — `productFormSchema` has no `active_months` key yet, so `result.data.active_months` is `undefined`, not `[]`.

- [ ] **Step 3: Implement**

In `src/lib/schemas.ts`, add one field to `productFormSchema`:

```typescript
export const productFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Product name is required').max(100),
  unit: z.string().min(1, 'Unit is required').max(20),
  unit_cost_cents: z.number().int().nonnegative().default(0),
  on_hand: z.number().nonnegative().default(0),
  low_stock_threshold: z.number().nonnegative().default(0),
  is_active: z.boolean().default(true),
  // Calendar months (1-12) this product is expected to sell. Empty = always
  // active (default) — dashboard alerts are suppressed outside this window
  // for seasonal products. See src/lib/stock.ts's isAlertSuppressed.
  active_months: z.array(z.number().int().min(1).max(12)).max(12).default([]),
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts src/lib/schemas.test.ts
git commit -m "feat: add active_months to productFormSchema"
```

---

### Task 4: Wire `computeOverviewStats` into the dashboard overview page

**Files:**

- Modify: `src/app/dashboard/(overview)/page.tsx`

**Interfaces:**

- Consumes: `computeOverviewStats` from `src/lib/stock.ts` (Task 2).
- Produces: nothing new for later tasks — this is the last consumer in this plan.

**Note on testing:** this file has no existing test (no other `src/app/dashboard/**/page.tsx` in this repo has one either — server components here are exercised via the pure functions they call, which is exactly what Task 2's `stock.test.ts` already covers). This task is a wiring change with no new logic, so its own verification is `pnpm typecheck` + rerunning the full suite, not a new test file.

- [ ] **Step 1: Replace the inline filtering with `computeOverviewStats`**

In `src/app/dashboard/(overview)/page.tsx`, change:

```typescript
import { STOCK_STATUS_DOT_CLASS, stockStatusFor } from '@/lib/stock';
```

to:

```typescript
import { STOCK_STATUS_DOT_CLASS, computeOverviewStats, stockStatusFor } from '@/lib/stock';
```

and replace:

```typescript
const totalValueCents = products.reduce((sum, p) => sum + p.on_hand * p.unit_cost_cents, 0);
const lowStock = products.filter((p) => p.on_hand > 0 && p.on_hand <= p.low_stock_threshold);
const outOfStock = products.filter((p) => p.on_hand <= 0);
const urgent = [...outOfStock, ...lowStock].slice(0, 5);
```

with:

```typescript
const totalValueCents = products.reduce((sum, p) => sum + p.on_hand * p.unit_cost_cents, 0);
const { lowStock, outOfStock, urgent } = computeOverviewStats(products, new Date());
```

Everything below (the three stat `Card`s, the "Needs attention" list) is unchanged — `lowStock.length`/`outOfStock.length`/`urgent.map(...)` already reference these same variable names.

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm test`
Expected: PASS — `stock.test.ts` from Task 2 already covers the suppression behavior this page now uses; this step only confirms the wiring compiles and nothing else broke.

- [ ] **Step 3: Commit**

```bash
git add "src/app/dashboard/(overview)/page.tsx"
git commit -m "feat: suppress seasonal-product alerts on the dashboard overview"
```

---

### Task 5: Persist `active_months` through `saveProduct`

**Files:**

- Modify: `src/app/dashboard/products/actions.ts:28-88` (`saveProduct`)
- Create: `src/app/dashboard/products/actions.test.ts`

**Interfaces:**

- Consumes: `ProductFormInput['active_months']` (Task 3).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/dashboard/products/actions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUserMock, updateChain, insertChain, fromMock, createServerClientMock } = vi.hoisted(
  () => {
    const updateChain = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(),
    };
    updateChain.update.mockReturnValue(updateChain);
    updateChain.eq.mockReturnValue(updateChain);
    updateChain.select.mockReturnValue(updateChain);

    const insertChain = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    insertChain.insert.mockReturnValue(insertChain);
    insertChain.select.mockReturnValue(insertChain);

    return {
      getUserMock: vi.fn(),
      updateChain,
      insertChain,
      fromMock: vi.fn(),
      createServerClientMock: vi.fn(),
    };
  }
);

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}));

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: 'v1' } } });
  fromMock.mockReset();
  updateChain.maybeSingle.mockReset().mockResolvedValue({ data: { id: 'p1' }, error: null });
  insertChain.single.mockReset().mockResolvedValue({ data: { id: 'p1' }, error: null });
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    from: fromMock,
  });
});

describe('saveProduct active_months', () => {
  it('includes active_months when creating a product', async () => {
    fromMock.mockImplementation((table: string) => (table === 'products' ? insertChain : {}));
    const { saveProduct } = await import('./actions');

    await saveProduct({
      name: 'Holiday Sticker Pack',
      unit: 'unit',
      unit_cost_cents: 500,
      on_hand: 10,
      low_stock_threshold: 2,
      is_active: true,
      active_months: [11, 12],
    });

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ active_months: [11, 12] })
    );
  });

  it('includes active_months when updating a product', async () => {
    fromMock.mockImplementation((table: string) => (table === 'products' ? updateChain : {}));
    const { saveProduct } = await import('./actions');

    await saveProduct({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Holiday Sticker Pack',
      unit: 'unit',
      unit_cost_cents: 500,
      on_hand: 10,
      low_stock_threshold: 2,
      is_active: true,
      active_months: [11, 12],
    });

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ active_months: [11, 12] })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test actions.test.ts`
Expected: FAIL — `row` in `saveProduct` doesn't include `active_months`, so `insert`/`update` are called without it.

- [ ] **Step 3: Implement**

In `src/app/dashboard/products/actions.ts`, extend the `row` object inside `saveProduct`:

```typescript
const row = {
  name: data.name,
  unit: data.unit,
  unit_cost_cents: data.unit_cost_cents,
  low_stock_threshold: data.low_stock_threshold,
  is_active: data.is_active,
  active_months: data.active_months,
};
```

(No other change needed — `row` already flows into both the `.update(row)` and `.insert({ ...row, vendor_id: user.id, on_hand: data.on_hand })` calls below it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/products/actions.ts src/app/dashboard/products/actions.test.ts
git commit -m "feat: persist active_months in saveProduct"
```

---

### Task 6: "Seasonal product" month picker in `ProductForm`

**Files:**

- Modify: `src/app/dashboard/products/product-form.tsx`
- Create: `src/app/dashboard/products/product-form.dom.test.tsx`

**Interfaces:**

- Consumes: `productFormSchema`/`ProductFormInput` (Task 3), `saveProduct` (Task 5).
- Produces: nothing new for later tasks — last task in this plan.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/dashboard/products/product-form.dom.test.tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductForm } from './product-form';

const { saveProductMock } = vi.hoisted(() => ({ saveProductMock: vi.fn() }));

vi.mock('./actions', () => ({
  saveProduct: saveProductMock,
  deleteProduct: vi.fn(),
}));

beforeEach(() => {
  saveProductMock.mockReset().mockResolvedValue({ success: true, productId: 'p1' });
});

describe('ProductForm active_months', () => {
  it('submits with an empty active_months by default', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<ProductForm onSaved={onSaved} />);

    await user.type(screen.getByLabelText(/name/i), 'Widget');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    expect(saveProductMock).toHaveBeenCalledWith(
      expect.objectContaining({ active_months: [] })
    );
  });

  it('submits the selected months when the vendor marks a product seasonal', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<ProductForm onSaved={onSaved} />);

    await user.type(screen.getByLabelText(/name/i), 'Holiday Pack');
    await user.click(screen.getByRole('button', { name: /nov/i }));
    await user.click(screen.getByRole('button', { name: /dec/i }));
    await user.click(screen.getByRole('button', { name: /add product/i }));

    expect(saveProductMock).toHaveBeenCalledWith(
      expect.objectContaining({ active_months: [11, 12] })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test product-form.dom.test.tsx`
Expected: FAIL — no month toggle exists yet, so `getByRole('button', { name: /nov/i })` throws.

- [ ] **Step 3: Implement**

In `src/app/dashboard/products/product-form.tsx`:

Add to the imports:

```typescript
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
```

Add a month-labels constant near `UNIT_PRESETS`:

```typescript
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
```

Add state, initialized from the existing product (or empty for a new one):

```typescript
const [activeMonths, setActiveMonths] = useState<number[]>(product?.active_months ?? []);
```

Include it in the `candidate` object passed to `productFormSchema.safeParse`:

```typescript
const candidate = {
  id: product?.id,
  name,
  unit,
  unit_cost_cents: costParsed.cents ?? 0,
  on_hand: Number(onHand),
  low_stock_threshold: Number(lowStockThreshold),
  is_active: isActive,
  active_months: activeMonths,
};
```

Include it in the `onSaved` payload (the manually-constructed `Product` object), right after `is_active`:

```typescript
        is_active: parsed.data.is_active,
        active_months: parsed.data.active_months,
```

Add the picker UI, right after the "Active" switch block and before the submit button row:

```tsx
<div className="space-y-2">
  <Label>Seasonal product (optional)</Label>
  <p className="text-muted-foreground text-xs">
    Pick the months this product is expected to sell. Leave empty if it sells year-round — low-stock
    alerts are only suppressed outside the months you pick here.
  </p>
  <ToggleGroup
    type="multiple"
    value={activeMonths.map(String)}
    onValueChange={(v) => setActiveMonths(v.map(Number).sort((a, b) => a - b))}
    spacing={1.5}
    aria-label="Active months"
    className="grid grid-cols-6"
  >
    {MONTH_LABELS.map((label, i) => (
      <ToggleGroupItem key={label} value={String(i + 1)} aria-label={label}>
        {label}
      </ToggleGroupItem>
    ))}
  </ToggleGroup>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test product-form.dom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS — confirms nothing in the earlier tasks regressed.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/products/product-form.tsx src/app/dashboard/products/product-form.dom.test.tsx
git commit -m "feat: add seasonal-product month picker to ProductForm"
```

---

## Self-Review

**Spec coverage:** every element of the chosen design in
`docs/superpowers/specs/2026-07-26-time-aware-low-stock-alerting-design.md`
§3 has a task: the migration (Task 1), `isAlertSuppressed` +
non-mutation of `stockStatusFor` (Task 2), the Zod schema extension
(Task 3), the dashboard filter (Task 4), persistence (Task 5), and the
form UI (Task 6). The spec's testing-considerations section (§4) is
covered: empty-array/present/absent-month cases in Task 2's
`isAlertSuppressed` tests, and the dashboard urgent/lowStock/outOfStock
exclusion case in `computeOverviewStats`'s tests. Explicitly out of scope
per the spec (§5) and not touched by this plan: velocity computation, ML
prediction, per-product custom suppression rules, retroactive month
suggestions.

**Placeholder scan:** no TBD/TODO markers; every step has real, complete
code, not descriptions of code.

**Type consistency:** `active_months: number[]` is the same shape from
Task 1 (`types.ts`) through Task 3 (`ProductFormInput`), Task 5
(`actions.ts`'s `row`), and Task 6 (`ProductForm`'s local state) — no
task introduces a conflicting shape (e.g. a `string[]` or a
`Set<number>`). `isAlertSuppressed`/`computeOverviewStats` names and
signatures are used identically in Task 2 (definition) and Task 4
(consumption).

**One open question carried over from the spec, not blocking:** the spec
notes a "seasonal — hidden until {month}" hint on suppressed-but-actually-
low products is a nicety that can land later; this plan does not include
it, matching the spec's own scoping.
