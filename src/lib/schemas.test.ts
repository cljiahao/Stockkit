import { describe, expect, it } from 'vitest';

import {
  displayNameSchema,
  formatPrice,
  MAX_MONEY_CENTS,
  passwordChangeSchema,
  productFormSchema,
  stockMovementFormSchema,
} from './schemas';

describe('passwordChangeSchema', () => {
  it('accepts matching passwords at least 8 characters long', () => {
    const result = passwordChangeSchema.safeParse({ password: 'hunter22', confirm: 'hunter22' });
    expect(result.success).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = passwordChangeSchema.safeParse({ password: 'short', confirm: 'short' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Password must be at least 8 characters');
    }
  });

  it('rejects when confirm does not match password', () => {
    const result = passwordChangeSchema.safeParse({ password: 'hunter22', confirm: 'different' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Passwords do not match');
      expect(result.error.issues[0]?.path).toEqual(['confirm']);
    }
  });
});

describe('displayNameSchema', () => {
  it('accepts a short display name', () => {
    const result = displayNameSchema.safeParse({ displayName: 'Aisha' });
    expect(result.success).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    const result = displayNameSchema.safeParse({ displayName: '  Aisha  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe('Aisha');
    }
  });

  it('accepts an empty string (clearing the display name)', () => {
    const result = displayNameSchema.safeParse({ displayName: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a display name longer than 60 characters', () => {
    const result = displayNameSchema.safeParse({ displayName: 'a'.repeat(61) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Display name is too long');
    }
  });
});

describe('formatPrice', () => {
  it('formats 1000 cents as SGD 10', () => {
    const result = formatPrice(1000);
    expect(result).toContain('10');
    expect(result).toContain('$');
  });

  it('formats 0 as $0', () => {
    expect(formatPrice(0)).toContain('0');
  });
});

describe('MAX_MONEY_CENTS bound', () => {
  it('rejects a product unit_cost_cents above the cap', () => {
    const result = productFormSchema.safeParse({
      name: 'Chicken thigh',
      unit: 'kg',
      unit_cost_cents: MAX_MONEY_CENTS + 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Unit cost is too high');
    }
  });

  it('accepts a product unit_cost_cents at the cap', () => {
    const result = productFormSchema.safeParse({
      name: 'Chicken thigh',
      unit: 'kg',
      unit_cost_cents: MAX_MONEY_CENTS,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a stock movement unit_cost_cents above the cap', () => {
    const result = stockMovementFormSchema.safeParse({
      product_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      delta: 5,
      reason: 'restock',
      unit_cost_cents: MAX_MONEY_CENTS + 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Unit cost is too high');
    }
  });
});
