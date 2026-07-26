# Inventory Valuation Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a vendor download a dated, documentable CSV snapshot of their current inventory valuation (name/status/unit/cost/on-hand/line-value per product, plus a total), for handing to an insurer, accountant, or lender.

**Architecture:** A `GET` Route Handler (`src/app/api/inventory/export/route.ts`) queries the caller's own products via the existing RLS-scoped `createServerClient()`, builds a CSV string with a small hand-written escaping helper (no CSV library — the shape is flat and small), and returns it with `Content-Type: text/csv` + `Content-Disposition: attachment`. A plain `<a href>` download link is added next to "Add product" on the products page. No schema change, no persisted snapshot — the design deliberately rejects historical snapshots and PDF export (see `docs/superpowers/specs/2026-07-26-inventory-valuation-export-design.md`).

**Tech Stack:** Next.js 16 Route Handler, TypeScript strict, Vitest, existing `withLogging` wrapper, existing `createServerClient()`/`centsToDollarString`.

## Global Constraints

- RLS-only authorization — the route uses `createServerClient()` exactly like every existing page; never `createServiceClient()`. Unauthenticated → `401`.
- TypeScript strict — no `any`, no `@ts-ignore`.
- Every route under `src/app/api/` must be wrapped in `withLogging` (`scripts/check-route-logging.mjs` fails the build otherwise).
- Comment hygiene: own-line comments only, no trailing inline comments.
- No new dependency — hand-build the CSV string, no library.
- Money is rendered via the existing plain-decimal `centsToDollarString` (no currency symbol per-cell, matching every other CSV/export convention in this app) — not `formatPrice`, which is for on-screen display only.
- Out of scope (per spec): historical/persisted snapshots, PDF export, scheduled exports, date-range/category filtering.

---

### Task 1: CSV escaping helper

**Files:**

- Create: `src/lib/csv.ts`
- Test: `src/lib/csv.test.ts`

**Interfaces:**

- Produces: `toCsvRow(fields: Array<string | number>): string` — joins fields with `,`, quoting/escaping any field containing a comma, double-quote, or newline (RFC 4180-style: wrap in `"..."`, double any embedded `"`). Used by Task 2.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/csv.test.ts
import { describe, expect, it } from 'vitest';

import { toCsvRow } from './csv';

describe('toCsvRow', () => {
  it('joins plain fields with commas', () => {
    expect(toCsvRow(['Widget', 'unit', 10])).toBe('Widget,unit,10');
  });

  it('quotes a field containing a comma', () => {
    expect(toCsvRow(['Widgets, Deluxe', 'unit'])).toBe('"Widgets, Deluxe",unit');
  });

  it('doubles an embedded double-quote and wraps the field in quotes', () => {
    expect(toCsvRow(['12" Widget', 'unit'])).toBe('"12"" Widget",unit');
  });

  it('quotes a field containing a newline', () => {
    expect(toCsvRow(['line one\nline two'])).toBe('"line one\nline two"');
  });

  it('leaves an empty string field as an empty cell', () => {
    expect(toCsvRow(['Total', '', 5])).toBe('Total,,5');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/lib/csv.test.ts`
Expected: FAIL — `Cannot find module './csv'` (the module doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/lib/csv.ts

/** RFC-4180-style single CSV row. Quotes/escapes a field only when it contains
 * a comma, double-quote, or newline — plain fields are left bare. */
export function toCsvRow(fields: Array<string | number>): string {
  return fields.map(escapeCsvField).join(',');
}

function escapeCsvField(field: string | number): string {
  const value = String(field);
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/csv.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv.ts src/lib/csv.test.ts
git commit -m "feat: add toCsvRow CSV escaping helper"
```

---

### Task 2: Export Route Handler

**Files:**

- Create: `src/app/api/inventory/export/route.ts`
- Test: `src/app/api/inventory/export/route.test.ts`

**Interfaces:**

- Consumes: `toCsvRow` from Task 1 (`src/lib/csv.ts`); `centsToDollarString` from `src/lib/schemas.ts` (existing); `createServerClient` from `src/lib/supabase/server.ts` (existing); `withLogging` from `src/lib/utils/with-logging.ts` (existing).
- Produces: `GET` handler at `/api/inventory/export` — later tasks (the UI link in Task 3) only need the URL path, not any exported symbol.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/api/inventory/export/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUserMock, fromMock, createServerClientMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}));

function mockProducts(rows: Array<Record<string, unknown>>) {
  fromMock.mockReturnValue({
    select: () => ({
      order: () => Promise.resolve({ data: rows, error: null }),
    }),
  });
}

beforeEach(() => {
  getUserMock.mockReset();
  fromMock.mockReset();
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    from: fromMock,
  });
});

describe('GET /api/inventory/export', () => {
  it('returns 401 when unauthenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/api/inventory/export'));
    expect(res.status).toBe(401);
  });

  it('returns a CSV with a header, one row per product, and a total row', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'v1' } } });
    mockProducts([
      { name: 'Widget', unit: 'unit', unit_cost_cents: 150, on_hand: 10, is_active: true },
      { name: 'Gadget', unit: 'unit', unit_cost_cents: 200, on_hand: 5, is_active: false },
    ]);
    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/api/inventory/export'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    const body = await res.text();
    expect(body).toContain('Name,Status,Unit,Unit Cost,On Hand,Line Value');
    expect(body).toContain('Widget,Active,unit,1.50,10,15.00');
    expect(body).toContain('Gadget,Inactive,unit,2.00,5,10.00');
    expect(body).toContain('Total,,,,,25.00');
  });

  it('returns a CSV with just the header and a zero total when there are no products', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'v1' } } });
    mockProducts([]);
    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/api/inventory/export'));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('Name,Status,Unit,Unit Cost,On Hand,Line Value');
    expect(body).toContain('Total,,,,,0.00');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/app/api/inventory/export/route.test.ts`
Expected: FAIL — `Cannot find module './route'` (the route file doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/app/api/inventory/export/route.ts
import { type NextRequest, NextResponse } from 'next/server';

import { toCsvRow } from '@/lib/csv';
import { centsToDollarString } from '@/lib/schemas';
import { createServerClient } from '@/lib/supabase/server';
import { withLogging } from '@/lib/utils/with-logging';

const CSV_HEADER = ['Name', 'Status', 'Unit', 'Unit Cost', 'On Hand', 'Line Value'];

export const GET = withLogging(async (_req: NextRequest): Promise<NextResponse> => {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data } = await supabase.from('products').select('*').order('name');
  const products = data ?? [];

  const generatedAt = new Date().toISOString();
  const lines = [
    toCsvRow(['Generated', generatedAt]),
    toCsvRow(['Currency', 'SGD']),
    '',
    toCsvRow(CSV_HEADER),
  ];

  let totalCents = 0;
  for (const product of products) {
    const lineCents = product.on_hand * product.unit_cost_cents;
    totalCents += lineCents;
    lines.push(
      toCsvRow([
        product.name,
        product.is_active ? 'Active' : 'Inactive',
        product.unit,
        centsToDollarString(product.unit_cost_cents),
        product.on_hand,
        centsToDollarString(lineCents),
      ])
    );
  }
  lines.push(toCsvRow(['Total', '', '', '', '', centsToDollarString(totalCents)]));

  const csv = lines.join('\n') + '\n';
  const filename = `stockkit-inventory-${generatedAt.slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/app/api/inventory/export/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the route-logging check**

Run: `node scripts/check-route-logging.mjs`
Expected: `Route logging check passed (N route file(s)).` — the new route is wrapped in `withLogging`, so it must not appear in the violation list.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/inventory/export/route.ts src/app/api/inventory/export/route.test.ts
git commit -m "feat: add inventory valuation CSV export route"
```

---

### Task 3: "Download inventory report" link on the products page

**Files:**

- Modify: `src/app/dashboard/products/products-workspace.tsx` (header area, next to the existing "Add product" buttons)
- Test: `src/app/dashboard/products/products-workspace.dom.test.tsx` (create if it doesn't already exist; otherwise add to it)

**Interfaces:**

- Consumes: nothing new exported — just the fixed route path `/api/inventory/export` from Task 2.

- [ ] **Step 1: Check whether a dom test file already exists**

Run: `ls src/app/dashboard/products/*.dom.test.tsx`

If `products-workspace.dom.test.tsx` exists, add the test below into its existing `describe` block instead of creating a new file (follow whatever render-helper pattern that file already uses for mounting `ProductsWorkspace`). If it doesn't exist, create it using the pattern below.

- [ ] **Step 2: Write the failing test**

```typescript
// src/app/dashboard/products/products-workspace.dom.test.tsx (new sections/file)
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProductsWorkspace } from './products-workspace';

describe('ProductsWorkspace — inventory export link', () => {
  it('renders a download link pointing at the export route', () => {
    render(<ProductsWorkspace initialProducts={[]} />);
    const link = screen.getByRole('link', { name: /download inventory report/i });
    expect(link).toHaveAttribute('href', '/api/inventory/export');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/app/dashboard/products/products-workspace.dom.test.tsx`
Expected: FAIL — no element with the accessible name "download inventory report" exists yet.

- [ ] **Step 4: Add the link**

In `products-workspace.tsx`, in the header `<div className="flex items-center justify-between gap-4">` block, add a link styled as an outline button, placed before the two "Add product" buttons:

```tsx
<Button asChild variant="outline">
  <a href="/api/inventory/export" download>
    Download inventory report
  </a>
</Button>
```

(No new import needed — `Button` is already imported in this file.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/app/dashboard/products/products-workspace.dom.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full check suite**

Run: `pnpm check`
Expected: prettier/eslint/tsc/route-logging all pass with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/products/products-workspace.tsx src/app/dashboard/products/products-workspace.dom.test.tsx
git commit -m "feat: add download-inventory-report link to products page"
```

---

## Self-Review

**Spec coverage:** CSV columns (name/unit/cost/on-hand/line-value/status) — Task 2. Route Handler not Server Action, `withLogging`-wrapped — Task 2. RLS-scoped via `createServerClient()`, 401 unauthenticated — Task 2. Active + inactive both included — Task 2 test covers both. Total row — Task 2. Generated-timestamp + currency header note — Task 2. UI trigger — Task 3. Historical snapshots/PDF/scheduling/date-range filtering — explicitly out of scope, no task attempts them.

**Placeholder scan:** no TBD/TODO; every step has runnable code, not descriptions.

**Type consistency:** `toCsvRow(fields: Array<string | number>)` (Task 1) is the exact signature Task 2 imports and calls. `centsToDollarString`/`createServerClient`/`withLogging` are pre-existing, unchanged signatures — verified against their current source during planning, not invented.
