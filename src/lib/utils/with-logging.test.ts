import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withLogging } from './with-logging';
const logger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger }));
beforeEach(() => vi.clearAllMocks());
describe('route logging', () => {
  it('preserves response and dynamic context without logging query secrets', async () => {
    const response = NextResponse.json({ ok: true }, { status: 201 });
    const handler = vi.fn().mockResolvedValue(response);
    const context = { params: Promise.resolve({ id: 'item' }) };
    const request = new NextRequest('https://test.invalid/api?token=private', {
      headers: { 'x-request-id': 'trace' },
    });
    expect(await withLogging(handler)(request, context)).toBe(response);
    expect(handler).toHaveBeenCalledWith(request, context);
    expect(logger.info).toHaveBeenCalledWith({
      requestId: 'trace',
      method: 'GET',
      path: '/api',
      status: 201,
      duration_ms: expect.any(Number),
    });
  });
  it.each([new Error('private error'), 'private error'])(
    'returns a generic 500 on failure: %s',
    async (error) => {
      const response = await withLogging(async () => {
        throw error;
      })(new NextRequest('https://test.invalid/api'));
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal server error' });
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'private error', requestId: expect.any(String) })
      );
    }
  );
});
