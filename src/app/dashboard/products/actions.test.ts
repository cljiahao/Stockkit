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
    const result = await saveProductComponents('11111111-1111-4111-8111-111111111111', [
      { component_product_id: '22222222-2222-4222-8222-222222222222', quantity_per_unit: 0 },
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
    const result = await saveProductComponents('11111111-1111-4111-8111-111111111111', [
      { component_product_id: '22222222-2222-4222-8222-222222222222', quantity_per_unit: 2 },
    ]);

    expect(result).toEqual({ success: true });
    expect(deleteEq).toHaveBeenCalledWith(
      'parent_product_id',
      '11111111-1111-4111-8111-111111111111'
    );
    expect(insert).toHaveBeenCalledWith([
      {
        parent_product_id: '11111111-1111-4111-8111-111111111111',
        component_product_id: '22222222-2222-4222-8222-222222222222',
        quantity_per_unit: 2,
      },
    ]);
  });

  it('returns an error without touching the DB when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { saveProductComponents } = await import('./actions');
    const result = await saveProductComponents('11111111-1111-4111-8111-111111111111', []);
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
    const result = await getProductComponents('11111111-1111-4111-8111-111111111111');

    expect(result.success).toBe(true);
    if (result.success) expect(result.components).toHaveLength(1);
  });
});

describe('recordLinkedMovement', () => {
  it('calls the RPC with parsed input and component overrides', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'p1', on_hand: 15 }, error: null });
    createServerClientMock.mockResolvedValue({
      auth: { getUser: getUserMock },
      rpc,
    });

    const { recordLinkedMovement } = await import('./actions');
    const result = await recordLinkedMovement({
      product_id: '11111111-1111-4111-8111-111111111111',
      delta: 5,
      reason: 'restock',
      unit_cost_cents: 150,
      component_overrides: { '22222222-2222-4222-8222-222222222222': -12 },
    });

    expect(result).toEqual({ success: true, product: { id: 'p1', on_hand: 15 } });
    expect(rpc).toHaveBeenCalledWith('record_linked_movement', {
      p_parent_product_id: '11111111-1111-4111-8111-111111111111',
      p_parent_delta: 5,
      p_reason: 'restock',
      p_note: null,
      p_unit_cost_cents: 150,
      p_component_overrides: { '22222222-2222-4222-8222-222222222222': -12 },
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
      product_id: '11111111-1111-4111-8111-111111111111',
      delta: 5,
      reason: 'restock',
    });

    expect(result).toEqual({ success: false, error: 'Not enough stock — check the quantity' });
  });
});
