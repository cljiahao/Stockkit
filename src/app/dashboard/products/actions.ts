'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ActionResult } from '@/lib/action-result';
import { ENTITLEMENTS, normalizePlan } from '@/lib/plan';
import {
  productFormSchema,
  stockMovementFormSchema,
  type ProductFormInput,
  type StockMovementFormInput,
} from '@/lib/schemas';
import { createServerClient } from '@/lib/supabase/server';
import type { Product, StockMovement } from '@/lib/types';

type SaveProductResult = ActionResult<{ productId: string }>;

/**
 * Resolve a vendor's plan and normalize it to an Entitlement. Fails closed to
 * Free when the lookup errors — the safe default, and what `normalizePlan`
 * already does for a missing/garbage value — but logs it, so a real outage
 * silently downgrading a paying Pro vendor (capped products, truncated
 * history, no CSV export) leaves a trace instead of nothing at all.
 */
async function vendorEntitlement(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  vendorId: string
) {
  const { data, error } = await supabase.from('vendors').select('plan').eq('id', vendorId).single();
  if (error) console.error('vendorEntitlement plan lookup failed', error.message);
  return ENTITLEMENTS[normalizePlan(data?.plan)];
}

/**
 * Upsert a product. Inserting with a nonzero starting `on_hand` also writes a
 * single `stock_movements` row with `reason='initial'` for that opening
 * balance — a direct second insert here, not routed through
 * record_stock_movement (that RPC works by delta against an already-existing
 * row, which is awkward for "set the initial count on creation"). Sequential
 * awaits, no DB transaction wrapper — low-stakes enough not to need one; a
 * failed ledger insert after a successful product insert just means a
 * product with an unexplained opening balance, not a security or money bug.
 */
export async function saveProduct(input: ProductFormInput): Promise<SaveProductResult> {
  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Check the product details',
    };
  const data = parsed.data;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };
  const vendorId = user.id;

  const row = {
    name: data.name,
    unit: data.unit,
    unit_cost_cents: data.unit_cost_cents,
    low_stock_threshold: data.low_stock_threshold,
    is_active: data.is_active,
  };

  const entitlement = await vendorEntitlement(supabase, vendorId);

  async function overActiveCap(): Promise<boolean> {
    if (entitlement.maxActiveProducts === null) return false;
    const { count } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', vendorId)
      .eq('is_active', true);
    return (count ?? 0) >= entitlement.maxActiveProducts;
  }

  if (data.id) {
    // A reactivation (currently inactive → is_active: true) is cap-gated the
    // same as a fresh insert; editing an already-active product's other
    // fields must never be blocked just because the vendor is at/over cap on
    // other rows, so this only checks when the flip is actually happening.
    // RLS (products_vendor_update) scopes both reads/writes to this vendor's
    // own products; the DB-level trigger (migration 0012) is the real
    // guarantee against a raw multi-row update bypassing this check —
    // this is the fast, friendly-error first line of defence only.
    if (data.is_active) {
      const { data: existing } = await supabase
        .from('products')
        .select('is_active')
        .eq('id', data.id)
        .maybeSingle();
      if (existing && !existing.is_active && (await overActiveCap())) {
        return {
          success: false,
          error: `You've hit the Free plan's ${entitlement.maxActiveProducts}-product limit. Upgrade to Pro for unlimited products.`,
        };
      }
    }

    const { data: updated, error } = await supabase
      .from('products')
      .update(row)
      .eq('id', data.id)
      .select('id')
      .maybeSingle();
    if (error || !updated) return { success: false, error: 'Could not save product' };

    revalidatePath('/dashboard', 'layout');
    return { success: true, productId: updated.id };
  }

  if (await overActiveCap()) {
    return {
      success: false,
      error: `You've hit the Free plan's ${entitlement.maxActiveProducts}-product limit. Upgrade to Pro for unlimited products.`,
    };
  }

  const { data: inserted, error } = await supabase
    .from('products')
    .insert({ ...row, vendor_id: vendorId, on_hand: data.on_hand })
    .select('id')
    .single();
  if (error || !inserted) {
    console.error('saveProduct insert failed', error?.message);
    return { success: false, error: 'Could not create product' };
  }

  if (data.on_hand > 0) {
    const { error: movementError } = await supabase.from('stock_movements').insert({
      vendor_id: vendorId,
      product_id: inserted.id,
      delta: data.on_hand,
      reason: 'initial',
    });
    if (movementError)
      console.error('saveProduct initial movement insert failed', movementError.message);
  }

  revalidatePath('/dashboard', 'layout');
  return { success: true, productId: inserted.id };
}

/** RLS-scoped delete. Cascades stock_movements via FK (migration 0001). */
export async function deleteProduct(productId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(productId).success)
    return { success: false, error: 'Invalid product' };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { count, error } = await supabase
    .from('products')
    .delete({ count: 'exact' })
    .eq('id', productId);
  if (error) return { success: false, error: 'Could not delete product' };
  if (!count) return { success: false, error: 'Product not found' };

  revalidatePath('/dashboard', 'layout');
  return { success: true };
}

type RecordMovementResult = ActionResult<{ product: Product }>;

/**
 * The one write path for a stock change — calls stockkit.record_stock_movement
 * (migration 0002). Postgres error messages are mapped to friendlier,
 * user-facing text rather than surfaced raw.
 */
export async function recordStockMovement(
  input: StockMovementFormInput
): Promise<RecordMovementResult> {
  const parsed = stockMovementFormSchema.safeParse(input);
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

  const { data: product, error } = await supabase.rpc('record_stock_movement', {
    p_product_id: data.product_id,
    p_delta: data.delta,
    p_reason: data.reason,
    p_note: data.note ?? null,
    p_unit_cost_cents: data.unit_cost_cents ?? null,
  });

  if (error) {
    if (error.message.includes('below zero'))
      return { success: false, error: 'Not enough stock — check the quantity' };
    if (error.message.includes('not found or not owned'))
      return { success: false, error: 'Product not found' };
    console.error('recordStockMovement failed', error.message);
    return { success: false, error: 'Could not record stock movement' };
  }
  if (!product) return { success: false, error: 'Could not record stock movement' };

  revalidatePath('/dashboard', 'layout');
  return { success: true, product };
}

type GetMovementsResult = ActionResult<{ movements: StockMovement[] }>;

/**
 * Ledger rows for a product, RLS-scoped, newest first. Capped to the last 10
 * on Free; unlimited on Pro (see `ENTITLEMENTS.movementHistoryLimit`).
 */
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

/** Full stock-movement ledger for one product as CSV text, Pro-only. */
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
    [m.created_at, m.reason, String(m.delta), m.note ?? ''].map(csvField).join(',')
  );
  const csv = ['date,reason,delta,note', ...rows].join('\n');
  return { success: true, csv };
}

/**
 * RFC 4180 field escaping: a field containing a comma, double-quote, or
 * newline is wrapped in double quotes, with embedded double-quotes doubled.
 * Applied uniformly to all CSV fields (not just the free-text ones) —
 * simpler and safer than special-casing which columns need it.
 */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
