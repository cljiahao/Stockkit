import { describe, expect, it, vi } from 'vitest';
import { readAllRows } from './read-all-rows';
describe('complete collection reads', () => {
  it('continues through small API-capped pages and requests the last cursor', async () => {
    const page = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 'a' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'b' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    expect(await readAllRows(page)).toEqual({ data: [{ id: 'a' }, { id: 'b' }], error: null });
    expect(page.mock.calls).toEqual([[null], ['a'], ['b']]);
  });
  it('rejects a later returned error instead of reporting a partial result', async () => {
    const page = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 'a' }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    expect(await readAllRows(page)).toEqual({ data: null, error: { message: 'offline' } });
  });
  it('contains rejected page requests', async () => {
    expect((await readAllRows(vi.fn().mockRejectedValue(new Error('offline')))).data).toBeNull();
  });
  it('rejects stalled cursors', async () => {
    const page = vi.fn().mockResolvedValue({ data: [{ id: 'a' }], error: null });
    expect((await readAllRows(page)).error?.message).toContain('did not advance');
    expect(page).toHaveBeenCalledTimes(2);
  });
  it('accepts an empty collection', async () => {
    expect(await readAllRows(vi.fn().mockResolvedValue({ data: null, error: null }))).toEqual({
      data: [],
      error: null,
    });
  });
});
