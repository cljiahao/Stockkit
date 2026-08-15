# stockkit — Admin-Tunable Pricing + Feature-List Honesty — Design

**Date:** 2026-08-15
**Status:** Approved (design); plan to follow.

## Summary

stockkit's Pro price is a source constant — `PRO_PRICE = '$14/mo'` in
`src/app/dashboard/plan/page.tsx` — so changing it means a code deploy.
Every other monetized kit in the family that has reached this point (qkit)
has already moved off that pattern onto an admin-editable `pricing` table
edited live from `/admin`, no redeploy needed. This spec brings stockkit to
parity, using the shape qkit already proved out plus the newly generalized
`@merqo/ui` `PricingForm` component (built for exactly this purpose — see
"The shared component" below) rather than hand-rolling a second bespoke
form.

Landing on the pricing table at the same time as a price change is
deliberate, not incidental: raising the price is the actual trigger for
this work (see "The price raise" below), and doing the raise through a
hardcoded-constant edit one more time, only to immediately need the exact
same live-editable pattern qkit already has, would be wasted motion.

Bundled into the same spec, because it surfaces from the same file this
work already touches: `src/lib/plan.ts`'s `resolvePlanView` currently lists
`"Valuation trend reports (coming soon)"` as a feature line shown to every
Pro vendor. No valuation/trend module exists anywhere in stockkit's
codebase — confirmed by search, and independently confirmed in
`docs/business/2026-08-15-per-kit-pricing-rationale.md`'s own stockkit
section, which flags it as "not built." This was a known, explicit
scope-exclusion when the plan-tier page shipped
(`2026-07-30-plan-tier-page-design.md`: _"This spec ships the plan page
advertising it as 'coming soon' under Pro rather than blocking the whole
plan-tier rollout on a feature that doesn't exist yet"_) — a reasonable
call at the time, for a feature that didn't exist yet on a page that also
didn't exist yet. Six weeks later it's a different situation: real vendors
are paying for Pro today and being shown a promised feature that was never
built and has no shipped timeline. That gap is a correctness problem, not
a scope question, and a vendor whose price is about to go up should not
simultaneously keep seeing a feature promise that isn't true. Fixed here:
remove the false claim from the feature list. Building the feature itself
stays explicitly out of scope — same call as before, just no longer
advertised as "coming soon" on the paid plan.

## The shared component

`@merqo/ui`'s `PricingForm` (spec:
`merqo-ui/docs/superpowers/plans/2026-08-15-pricing-form.md`) generalizes
qkit's own `pricing-form.tsx` into a field-list-driven component so
paykit/stockkit/loopkit don't each need a hand-rolled copy of qkit's
2-field form stripped down to one field:

```ts
export interface PricingFieldConfig {
  key: string;
  label: string;
}
export interface PricingFormInitial {
  values: Record<string, number>;
  currency: string;
}
export interface PricingFormProps {
  fields: PricingFieldConfig[];
  initial: PricingFormInitial;
  onSave: (values: Record<string, number>) => Promise<void>;
  onError?: (error: unknown) => void;
  helpText?: string;
}
```

Cents in, cents out — no dollar string ever crosses the component
boundary; the component owns its own dollar-string parse/format
internally. It never talks to Supabase directly (`initial`/`onSave` are
supplied by the consumer) and never imports `toast` — success/failure
surfaces via `onSave` resolving or rejecting, and the `onError` prop.
stockkit's admin page provides both, wired to `sonner` the same way every
other form in this app already does (`vendor-plan-toggle.tsx`,
`profile-form.tsx`).

**stockkit needs exactly one field: `monthly_cents`.** stockkit has no
day-pass concept — qkit's 2-field shape (`event_pass_cents` +
`monthly_cents`) is qkit-only, per
`2026-07-30-cross-kit-pricing-and-billing-plan.md`'s own decision, and this
spec doesn't revisit that.

This spec assumes `@merqo/ui` has shipped a release containing
`PricingForm` by the time implementation starts — treat that plan's Task 1
(`src/pricing-form.tsx`, exported from `index.ts`) as a stable, final API
contract per this task's own instructions, but confirm the actual released
tag before bumping stockkit's `package.json` dependency
(`"@merqo/ui": "github:cljiahao/merqo-ui#v0.11.1"` today — the pin needs to
move to whatever tag first contains `PricingForm`, not assumed to be
`v0.12.0` without checking, since `merqo-ui`'s own plan flags its
`package.json` version as previously observed out of sync with its real
git tags).

## The price raise: $14/mo → $19.99/mo

Full comparator research (Zoho Inventory, WhiteBox, general SME cloud
inventory tooling) lives in
`docs/business/2026-08-15-per-kit-pricing-rationale.md`'s stockkit section
— cited here, not re-derived. Summary of that doc's own conclusion:

- stockkit's real Free-vs-Pro gate (`src/lib/plan.ts`, unchanged by this
  spec): Free = 20 active products, 10-movement history per product, no
  CSV export; Pro = unlimited products/history + CSV export.
- The cheapest real standalone inventory tool found is **Zoho Inventory at
  $29/mo** (its free plan is feature-limited, not a real substitute for
  stockkit's unlimited-product Pro tier); WhiteBox is S$49/mo; general
  SME-tier cloud inventory tools span $30–200/mo. Every real comparator
  found starts at $29/mo or higher.
- **$19.99/mo** sits ~31% below the cheapest real comparator — real margin
  for the value, while capturing meaningfully more than the current $14.
  The rationale doc explicitly caps this at one raise per review cycle:
  don't raise further in the same pass, and re-check Zoho's actual
  free-tier limits before considering a second increase later.
- Charm pricing (`.99`) matches the family-wide convention this doc
  documents (qkit's own live $24.99/$14.99, the closest direct qkit
  comparator's $7.90/$12.90) — not a new decision made here.

This spec's job is mechanical: move the number from a source constant into
the new `stockkit.pricing` table, seeded at $19.99/mo (1999 cents) on
migration. It does not re-litigate the number itself.

## What changes

### 1. Data model — `supabase/migrations/0014_stockkit_pricing.sql`

Mirrors qkit's `qkit.pricing` shape (`0010_monetization.sql`), minus the
`event_pass_cents` column stockkit doesn't need:

```sql
CREATE TABLE stockkit.pricing (
  id            INT         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  monthly_cents INT         NOT NULL DEFAULT 0,
  currency      TEXT        NOT NULL DEFAULT 'SGD',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO stockkit.pricing (id, monthly_cents)
  VALUES (1, 1999)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE stockkit.pricing ENABLE ROW LEVEL SECURITY;

-- Prices aren't secret; a public read keeps the vendor plan page simple.
-- Writes go through the service-role admin action only (no write policy).
CREATE POLICY "pricing_public_select" ON stockkit.pricing
  FOR SELECT USING (true);

GRANT SELECT ON stockkit.pricing TO anon, authenticated;
GRANT ALL ON stockkit.pricing TO service_role;
```

Single-row, `id` pinned to 1 via the `CHECK` constraint, same pattern as
`qkit.pricing` and as stockkit's own `stockkit.admins`/`admin_audit`
tables in `0013_stockkit_admin.sql` (explicit `GRANT` statements, no
implicit reliance on default privileges). Seeded directly at the new price
— no separate "raise it later from $14" step, since the table doesn't
exist with a $14 value to migrate from.

`src/lib/types.ts`'s hand-maintained `Database['stockkit']['Tables']` gets
a `pricing` entry (`Row`/`Insert`/`Update`, mirroring the SQL columns) and
a `Pricing` type export, matching how `vendors`/`admins`/`admin_audit`
are already mirrored there (this repo has no `supabase gen types` step).

### 2. Config module — `src/lib/pricing.ts` (new)

```ts
export interface PricingConfig {
  monthly_cents: number;
  currency: string;
}

export const DEFAULT_PRICING: PricingConfig = {
  monthly_cents: 1999,
  currency: 'SGD',
};
```

**Deliberate divergence from qkit's `DEFAULT_PRICING`:** qkit zeroes its
fallback because zero is a real, meaningful state there — qkit is
pre-Stripe beta, and `0` cents is how the offer page knows to render
"Free"/"in beta" copy instead of a price. stockkit has no such beta
framing: Pro is already a real, currently-charged tier with a manual
support-ticket upgrade flow, so a vendor who hits the fallback path (the
`pricing` row fails to read — network hiccup, RLS misconfiguration, a
pre-migration deploy window) must still see a real price, not `$0.00/mo`
or a "Free" label on a page that's telling them they're on Free vs. Pro.
`DEFAULT_PRICING` is therefore seeded to match the live migration value
at introduction time, not zeroed. This is a defensive fallback only — the
`pricing` row is always present after the migration runs, so this constant
should essentially never be read in practice. It is **not** kept in sync
automatically by future admin price edits (an admin changing the price via
`/admin` updates the DB row, not this constant) — call this out explicitly
in code as a comment, and revisit if a future price change makes the drift
between this fallback and the live price large enough to matter on the
rare read-failure path.

### 3. Zod schema + server action — `src/app/admin/actions.ts`

Following this file's own existing convention (not qkit's — stockkit
keeps its action-input schemas local to `admin/actions.ts` rather than
centralizing them in `src/lib/schemas.ts`; see `setVendorPlanSchema`,
defined inline in this same file today):

```ts
const pricingFormSchema = z.object({
  monthly_cents: z.number().int().nonnegative().max(MAX_MONEY_CENTS),
});
export type PricingFormInput = z.infer<typeof pricingFormSchema>;
```

`MAX_MONEY_CENTS` imports from `@/lib/schemas` (already exported and
already used for every other money field in this app — `unit_cost_cents`
on products, stock movements — so this reuses the existing fat-finger
guard rather than inventing a second one).

```ts
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

Same shape as the existing `setVendorPlan` in this file: `requireAdmin()`
gates non-admins with a 404 before any write, the service-role client is
used because writing `pricing` needs to bypass RLS (no write policy exists
— only the admin action, via service-role, can write it), and
`recordAudit` (this file's existing private helper) appends an
`admin_audit` row — `target_id: null` since a pricing change isn't scoped
to one vendor, matching the shape `admin_audit.target_id` already allows
(nullable, per `0013_stockkit_admin.sql`). Both `/admin` (where the form
lives) and `/dashboard/plan` (where the price is shown to vendors) get
revalidated, same as qkit's `setPricing`.

### 4. Admin page wiring

New client wrapper, `src/app/admin/pricing-section.tsx` — a thin adapter
between the server-rendered `/admin` page and `@merqo/ui`'s presentational
`PricingForm`, following the exact pattern `profile-form.tsx` already
establishes for consuming a `@merqo/ui` component from this app (import
directly, wire in this app's own action/toast/refresh plumbing around it):

```tsx
'use client';

import { PricingForm } from '@merqo/ui';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { setPricing } from './actions';
import type { PricingConfig } from '@/lib/pricing';

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

`onSave` throwing on a failed `setPricing` (rather than swallowing the
error and toasting inline) is what routes the failure to `PricingForm`'s
own `onError` — matching the component's documented contract ("throwing/
rejecting surfaces via `onError`, not an exception the caller must
catch"). This keeps `PricingSection` a pure adapter: no `try`/`catch`
duplicating what the component already does internally via
`useAsyncAction`.

`src/lib/admin-data.ts` (the service-role-client data layer this app's
`/admin` page already reads through — `platformTotals`, `recentActivity`,
`listVendors`) gets one more function, `currentPricing()`, reading the
`pricing` row with the same service-role client the rest of this module
uses (consistent with this app's convention: `admin/page.tsx` never
queries Supabase directly, it always goes through `admin-data.ts`):

```ts
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

`src/app/admin/page.tsx` adds `currentPricing()` to its existing
`Promise.all` alongside `platformTotals()`/`recentActivity()`, and renders
a new "Pricing" section (same `<section>`/`<h2>` pattern this page already
uses for its other groupings) containing `<PricingSection initial={pricing} />`.

### 5. Vendor-facing plan page — `src/app/dashboard/plan/page.tsx`

Drop the hardcoded `const PRO_PRICE = '$14/mo';`. Read the live `pricing`
row the same way qkit's plan page does — via the RLS-scoped
`createServerClient()` (not service-role; this is a vendor's own read of a
publicly-readable row, matching the `pricing_public_select` policy from
migration 0014), falling back to `DEFAULT_PRICING`:

```ts
const { data: pricingRow } = await supabase
  .from('pricing')
  .select('monthly_cents, currency')
  .eq('id', 1)
  .maybeSingle();
const pricing = pricingRow ?? DEFAULT_PRICING;
const monthlyPrice = `${formatPrice(pricing.monthly_cents)}/mo`;
```

`formatPrice` is this app's existing cents→currency-string helper
(`src/lib/schemas.ts`, already used elsewhere — e.g. `admin/vendors`).
`monthlyPrice` replaces every use of `PRO_PRICE` in the JSX below (the
`<span className="font-mono">{PRO_PRICE}</span>` inside the upgrade
paragraph), keeping the existing `font-mono` treatment — this app's one
deliberate typographic signature for every quantity/cost figure shown to a
vendor, per `AGENTS.md`.

### 6. Feature-list correctness fix — `src/lib/plan.ts`

`resolvePlanView` currently ends with:

```ts
if (plan === 'pro') features.push({ kind: 'text', text: 'Valuation trend reports (coming soon)' });
```

Delete this block entirely. Pro's feature list becomes exactly what Pro
entitlements actually deliver today: unlimited products, full stock
movement history, CSV export — three lines, matching
`ENTITLEMENTS.pro`'s three real fields (`maxActiveProducts`,
`movementHistoryLimit`, `csvExport`) one-for-one, with no fourth line
promising something outside that entitlement object. This is the
"no placeholders" principle already stated in the original plan-tier
spec's own self-review, now actually enforced against a feature line that
had drifted from it.

No other code path references this string — confirmed by search
(`grep -rn "Valuation trend" src/`); it exists only in this one feature
line and in the two 2026-07-30 docs that introduced it as a deliberate,
time-boxed exception (superseded by this fix, not edited — those docs stay
as historical record of the decision at the time, per this repo's
docs-are-history convention).

### 7. Copy audit — every place the old price appears

Full-repo search (`grep -rn "14/mo\|\$14" src/`, excluding
`node_modules`) found exactly **one** live-code hit:
`src/app/dashboard/plan/page.tsx`'s `PRO_PRICE` constant, fixed by item 5
above. No landing/marketing copy references a price at all — a targeted
search of `src/components/landing/` (`hero.tsx`, `benefits.tsx`,
`how-it-works.tsx`, `faq.tsx`, `nav.tsx`) for `/mo`, `pricing`, `Pro plan`,
or `$14` returned nothing; stockkit's landing page doesn't quote a price
today, so this raise needs no landing-copy edits. The only other repo hits
for the string are the two 2026-07-30 spec/plan docs (left as historical
record, per item 6 above) and a generated `.superpowers/sdd/` task-brief
artifact from that same original implementation pass (not source, not
edited).

## Testing

- `src/lib/plan.test.ts`: update the existing "renders Pro as unlimited
  text lines..." test's expected `features` array to drop the fourth,
  false line — plus a new, explicit assertion (`.not.toContainEqual` /
  `.some()` check for the substring `"coming soon"`) so a future
  regression re-adding _any_ false "coming soon" claim to the Pro feature
  list fails loudly, not just a line that happens not to exact-match the
  old wording.
- `supabase/tests/rls.test.sql` (pgTAP, this repo's existing RLS-isolation
  suite): a case verifying `stockkit.pricing` is readable by any
  authenticated role (or anon, matching the SQL policy) and not writable
  by a non-service-role — mirrors this suite's existing coverage shape for
  `admins`/`admin_audit`.
- `src/lib/admin-data.test.ts`: extend with `currentPricing()` coverage —
  returns the row when present, falls back to `DEFAULT_PRICING` when the
  row is missing/query errors.
- `src/app/admin/actions.test.ts`: extend with `setPricing` coverage,
  mirroring the existing `setVendorPlan` test shape in the same file —
  success path (update call, audit insert, both `revalidatePath` calls),
  invalid-input rejection before any DB call, DB-error path (friendly
  error, no audit row), and the `requireAdmin` non-admin rejection
  propagating before any write.
- `src/app/admin/pricing-section.dom.test.tsx` (new): renders the form
  pre-filled from `initial`, a save calls `setPricing` with the parsed
  cents value and shows a success toast + refresh on success, and an
  `onSave` throw surfaces via `onError` as an error toast (mirrors this
  component's contract, not the internal `PricingForm` behavior already
  covered by `@merqo/ui`'s own test suite — this test is about the
  adapter, not re-testing the shared component).
- `src/app/admin/admin-overview-page.dom.test.tsx` (existing): its
  `vi.mock('@/lib/admin-data', ...)` factory needs a `currentPricing` mock
  added alongside `platformTotals`/`recentActivity`, or the page's real
  `Promise.all` call breaks the existing tests — a straightforward
  mechanical addition, not new coverage.
- `src/app/dashboard/plan/page.tsx`: check whether this repo has any
  existing render/smoke coverage for a server-component page (the
  2026-07-30 plan-tier plan flagged this same question and deferred to
  whatever pattern an existing `dashboard/profile/page` test uses, if any)
  — if such a pattern exists, extend it to assert the price string comes
  from the mocked DB row rather than a hardcoded literal; if no such
  pattern exists anywhere in this repo, this page's price rendering is
  covered adequately by `formatPrice`'s own existing test coverage plus
  the DB-read/fallback logic being a thin, low-risk read (same standard
  this repo already applies to qkit's equivalent page, which also has no
  dedicated page-level test).

## Self-review

- **No placeholders:** every piece — migration, config module, schema,
  action, admin wiring, vendor-page wiring, feature-list fix — maps to
  real code that ships in the same PR, not a stub.
- **Internally consistent:** the $19.99 figure and its rationale are
  pulled by reference from
  `docs/business/2026-08-15-per-kit-pricing-rationale.md`, not restated or
  re-derived — this spec is a mechanical "wire it into the DB" plan, not a
  pricing-strategy document.
- **Scope boundary, stated explicitly:** the "coming soon" fix removes a
  false claim from the feature list; it does **not** build a
  valuation/trend view. That remains a separate, larger, unscheduled
  feature — this spec makes the honesty fix, nothing more, exactly as the
  task that produced this spec required.
- **Divergence from qkit called out, not silently copied:** `DEFAULT_PRICING`
  is seeded non-zero (unlike qkit's zeroed fallback) because stockkit has
  no pre-launch/beta framing to signal with zero — explained in item 2
  above rather than left as an unexplained deviation a future reader would
  have to reverse-engineer.
- **Convention match, not qkit-copy:** the Zod schema stays local to
  `admin/actions.ts` (stockkit's own existing pattern for
  `setVendorPlanSchema`) rather than moving to `src/lib/schemas.ts`
  (qkit's pattern) — matching what's actually already in this codebase
  beats mechanically copying the reference implementation's file
  organization.
- **Ambiguity check:** `PricingSection`'s `onSave` intentionally throws on
  failure rather than toasting inline, so the error path routes through
  `PricingForm`'s own `onError` prop exactly once, not twice (once inside
  the component's internal handling, once again in the adapter) — stated
  explicitly so an implementer doesn't add a redundant inline toast on the
  failure branch.

## Parent

[stockkit/docs/superpowers](../README.md)
