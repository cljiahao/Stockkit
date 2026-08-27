import { describe, expect, it, vi } from 'vitest';

import { listAllUsers } from '@/lib/list-all-users';

function fakeUser(id: string, email: string | null = `${id}@x.com`) {
  return { id, email };
}

function makeSupabase(listUsers: ReturnType<typeof vi.fn>) {
  return { auth: { admin: { listUsers } } } as unknown as Parameters<typeof listAllUsers>[0];
}

describe('listAllUsers', () => {
  it('returns every user from a single partial page', async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: { users: [fakeUser('u1'), fakeUser('u2')] },
      error: null,
    });

    const { data, error } = await listAllUsers(makeSupabase(listUsers));

    expect(error).toBeNull();
    expect(data?.users).toEqual([
      { id: 'u1', email: 'u1@x.com' },
      { id: 'u2', email: 'u2@x.com' },
    ]);
    expect(listUsers).toHaveBeenCalledTimes(1);
    expect(listUsers).toHaveBeenCalledWith({ page: 1, perPage: 1000 });
  });

  it('keeps paginating while a page is full, and stops at the first partial page', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) => fakeUser(`p1-${i}`));
    const partialPage = [fakeUser('p2-0')];
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ data: { users: fullPage }, error: null })
      .mockResolvedValueOnce({ data: { users: partialPage }, error: null });

    const { data, error } = await listAllUsers(makeSupabase(listUsers));

    expect(error).toBeNull();
    expect(data?.users).toHaveLength(1001);
    expect(listUsers).toHaveBeenCalledTimes(2);
    expect(listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 1000 });
    expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 1000 });
  });

  it('maps a missing email to null', async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: { users: [fakeUser('u1', null)] },
      error: null,
    });

    const { data } = await listAllUsers(makeSupabase(listUsers));

    expect(data?.users).toEqual([{ id: 'u1', email: null }]);
  });

  it('returns the error and stops paginating when a page errors', async () => {
    const listUsers = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });

    const { data, error } = await listAllUsers(makeSupabase(listUsers));

    expect(data).toBeNull();
    expect(error).toEqual({ message: 'boom' });
    expect(listUsers).toHaveBeenCalledTimes(1);
  });

  it('stops at the max-page ceiling if every page comes back full', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) => fakeUser(`p-${i}`));
    const listUsers = vi.fn().mockResolvedValue({ data: { users: fullPage }, error: null });

    const { data, error } = await listAllUsers(makeSupabase(listUsers));

    expect(error).toBeNull();
    expect(data?.users).toHaveLength(50_000);
    expect(listUsers).toHaveBeenCalledTimes(50);
  });
});
