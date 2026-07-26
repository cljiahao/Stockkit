import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const passwordChangeSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

export const vendorSchema = z.object({
  name: z.string().min(1, 'Stall name is required').max(100),
});

export const productFormSchema = z.object({
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
});

// 'initial' is reserved for the DB-seeded opening balance recorded when a
// product is first created with a nonzero starting on_hand (see saveProduct)
// — never chosen by the user through this form.
export const stockMovementFormSchema = z.object({
  product_id: z.string().uuid(),
  delta: z.number().refine((n) => n !== 0, 'Enter a nonzero quantity'),
  reason: z.enum(['restock', 'waste', 'adjustment']),
  note: z.string().max(500).optional(),
  unit_cost_cents: z.number().int().nonnegative().optional(),
});

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

export type LoginInput = z.infer<typeof loginSchema>;
export type VendorInput = z.infer<typeof vendorSchema>;
export type ProductFormInput = z.infer<typeof productFormSchema>;
export type StockMovementFormInput = z.infer<typeof stockMovementFormSchema>;
export type LinkedMovementFormInput = z.infer<typeof linkedMovementFormSchema>;

/** Cents → a plain "12.34" decimal string (no currency symbol) for inputs/CSV. */
export function centsToDollarString(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Parse a user-typed dollar string into integer cents for storage.
 * `""` → ok with `undefined` (field cleared); a valid non-negative number → ok
 * with rounded cents; anything else (NaN, negative) → not ok, so the caller
 * rejects the keystroke and keeps the prior value.
 */
export function parseDollarsToCents(
  raw: string
): { ok: true; cents: number | undefined } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, cents: undefined };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return { ok: false };
  return { ok: true, cents: Math.round(value * 100) };
}

export const profileNameSchema = z.object({
  name: z.string().trim().min(1, 'Enter a stall/shop name').max(100),
});
export type ProfileNameInput = z.infer<typeof profileNameSchema>;

const socialUrl = z.string().trim().url('Enter a valid URL').max(300).optional().or(z.literal(''));

export const socialLinksSchema = z.object({
  website: socialUrl,
  instagram: socialUrl,
  facebook: socialUrl,
  tiktok: socialUrl,
});
export type SocialLinksInput = z.infer<typeof socialLinksSchema>;

export const feedbackSchema = z.object({
  nps: z.number().int().min(0).max(10),
  message: z.string().trim().max(2000).optional(),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

export const supportMessageSchema = z.object({
  category: z.enum(['products', 'account', 'other']),
  body: z.string().trim().min(1, "Tell us what's wrong").max(2000),
});
export type SupportMessageInput = z.infer<typeof supportMessageSchema>;

export const SUPPORT_CATEGORY_LABELS: Record<SupportMessageInput['category'], string> = {
  products: 'Products & stock',
  account: 'Account / sign-in',
  other: 'Something else',
};

export const productComponentSchema = z.object({
  component_product_id: z.string().uuid(),
  quantity_per_unit: z.number().positive('Quantity must be greater than zero'),
});
export type ProductComponentInput = z.infer<typeof productComponentSchema>;

export const productComponentsListSchema = z.array(productComponentSchema).max(20);
