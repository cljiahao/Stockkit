import { beforeEach, describe, expect, it, vi } from 'vitest';

const { uploadMock, getPublicUrlMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(
    async (
      _path: string,
      _blob: unknown,
      _opts: unknown
    ): Promise<{ error: null | { message: string } }> => ({ error: null })
  ),
  getPublicUrlMock: vi.fn((path: string) => ({
    data: { publicUrl: `https://x.supabase.co/${path}` },
  })),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: { from: () => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock }) },
  }),
}));

import { uploadVendorAvatar } from './image-upload-adapter';

describe('uploadVendorAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads the blob and resolves the public URL', async () => {
    const blob = new Blob(['x'], { type: 'image/webp' });
    const url = await uploadVendorAvatar({
      bucket: 'vendor-avatars',
      path: 'v1/abc.webp',
      blob,
      contentType: 'image/webp',
    });

    expect(uploadMock).toHaveBeenCalledWith('v1/abc.webp', blob, {
      upsert: false,
      contentType: 'image/webp',
    });
    expect(url).toBe('https://x.supabase.co/v1/abc.webp');
  });

  it('throws (does not swallow) when the storage upload returns an error', async () => {
    uploadMock.mockResolvedValueOnce({ error: { message: 'bucket error' } });
    const blob = new Blob(['x'], { type: 'image/webp' });

    await expect(
      uploadVendorAvatar({
        bucket: 'vendor-avatars',
        path: 'v1/abc.webp',
        blob,
        contentType: 'image/webp',
      })
    ).rejects.toThrow();
  });
});
