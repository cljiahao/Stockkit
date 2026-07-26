'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ActionResult } from '@/lib/action-result';
import {
  linkedMovementFormSchema,
  productComponentsListSchema,
  productFormSchema,
  stockMovementFormSchema,
  type LinkedMovementFormInput,
  type ProductFormInput,
  type StockMovementFormInput,
} from '@/lib/schemas';
import { createServerClient } from '@/lib/supabase/server';
import type { Product, ProductComponent, StockMovement } from '@/lib/types';

type SaveProductResult = ActionResult<{ productId: string }>;

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

  const row = {
    name: data.name,
    unit: data.unit,
    unit_cost_cents: data.unit_cost_cents,
    low_stock_threshold: data.low_stock_threshold,
    is_active: data.is_active,
  };

  if (data.id) {
    // RLS (products_vendor_all) scopes the update to this vendor's own products.
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

  const { data: inserted, error } = await supabase
    .from('products')
    .insert({ ...row, vendor_id: user.id, on_hand: data.on_hand })
    .select('id')
    .single();
  if (error || !inserted) {
    console.error('saveProduct insert failed', error?.message);
    return { success: false, error: 'Could not create product' };
  }

  if (data.on_hand > 0) {
    const { error: movementError } = await supabase.from('stock_movements').insert({
      vendor_id: user.id,
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

type GetMovementsResult = ActionResult<{ movements: StockMovement[] }>;

/** Last 10 ledger rows for a product, RLS-scoped, newest first. */
export async function getProductMovements(productId: string): Promise<GetMovementsResult> {
  if (!z.string().uuid().safeParse(productId).success)
    return { success: false, error: 'Invalid product' };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) return { success: false, error: 'Could not load history' };

  return { success: true, movements: data ?? [] };
}

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
