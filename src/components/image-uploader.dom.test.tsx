// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateUserMock, uploadMock, getPublicUrlMock } = vi.hoisted(() => ({
  updateUserMock: vi.fn(
    async (_input: unknown): Promise<{ error: null | { message: string } }> => ({ error: null })
  ),
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
    auth: { updateUser: updateUserMock },
    storage: { from: () => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock }) },
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ImageUploader } from './image-uploader';

describe('ImageUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a disallowed file type without uploading', async () => {
    const onChange = vi.fn();
    render(<ImageUploader vendorId="v1" value={null} onChange={onChange} />);

    // userEvent.upload() filters against the input's `accept` attribute, so a
    // disallowed MIME type never reaches the change handler under it. Fire
    // the change event directly to exercise the component's own validation.
    const file = new File(['x'], 'photo.gif', { type: 'image/gif' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput);

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Use a JPEG, PNG, or WebP image');
    expect(uploadMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects a file over the 5MB size limit without uploading', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ImageUploader vendorId="v1" value={null} onChange={onChange} />);

    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Image must be 5 MB or smaller');
    expect(uploadMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows an error toast when the storage upload returns a failure', async () => {
    uploadMock.mockResolvedValueOnce({ error: { message: 'bucket error' } });
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ImageUploader vendorId="v1" value={null} onChange={onChange} />);

    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Upload failed');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows an error toast when the storage upload throws', async () => {
    uploadMock.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ImageUploader vendorId="v1" value={null} onChange={onChange} />);

    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Upload failed');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange(null) when the remove button is clicked on an existing image', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ImageUploader
        vendorId="v1"
        value="https://x.supabase.co/v1/existing.webp"
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /remove image/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
