// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActionResult } from '@/lib/action-result';

const updateStallName = vi.fn(async (_input: unknown): Promise<ActionResult> => ({
  success: true,
}));
const updateSocialLinks = vi.fn(async (_input: unknown): Promise<ActionResult> => ({
  success: true,
}));
vi.mock('./actions', () => ({
  updateStallName: (input: unknown) => updateStallName(input),
  updateSocialLinks: (input: unknown) => updateSocialLinks(input),
}));

const { updateUserMock, uploadMock, getPublicUrlMock } = vi.hoisted(() => ({
  updateUserMock: vi.fn(
    async (_input: unknown): Promise<{ error: null | { message: string } }> => ({ error: null })
  ),
  uploadMock: vi.fn(async (_path: string, _blob: unknown, _opts: unknown) => ({ error: null })),
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

const routerRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

import { ProfileForm } from './profile-form';

const defaultProps = {
  vendorId: 'v1',
  stallName: 'My Stall',
  socialLinks: {},
  displayName: '',
  email: 'vendor@example.com',
  avatarUrl: null,
};

afterEach(() => cleanup());

describe('ProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateUserMock.mockResolvedValue({ error: null });
    uploadMock.mockResolvedValue({ error: null });
  });

  it('saves the stall name independently of other sections', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const input = screen.getByLabelText(/stall\/shop name/i);
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(updateStallName).toHaveBeenCalledWith({ name: 'New Name' });
    expect(routerRefresh).toHaveBeenCalled();
  });

  it('rejects an empty stall name client-side without calling the server action', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const input = screen.getByLabelText(/stall\/shop name/i);
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(updateStallName).not.toHaveBeenCalled();
  });

  it('rejects an invalid social link URL client-side without calling the server action', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const input = screen.getByLabelText(/^website$/i);
    await user.type(input, 'not-a-url');
    await user.click(screen.getByRole('button', { name: /save links/i }));
    expect(updateSocialLinks).not.toHaveBeenCalled();
  });

  it('saves valid social links via the server action', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const input = screen.getByLabelText(/^website$/i);
    await user.type(input, 'https://instagram.com/mystall');
    await user.click(screen.getByRole('button', { name: /save links/i }));
    expect(updateSocialLinks).toHaveBeenCalledWith(
      expect.objectContaining({ website: 'https://instagram.com/mystall' })
    );
    const { toast } = await import('sonner');
    expect(toast.success).toHaveBeenCalledWith('Links saved');
  });

  it('shows an error toast when saving the stall name returns a failure', async () => {
    updateStallName.mockResolvedValueOnce({ success: false, error: 'Server error' });
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const input = screen.getByLabelText(/stall\/shop name/i);
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Server error');
  });

  it('shows an error toast when saving social links returns a failure', async () => {
    updateSocialLinks.mockResolvedValueOnce({ success: false, error: 'Links server error' });
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const input = screen.getByLabelText(/^website$/i);
    await user.type(input, 'https://instagram.com/mystall');
    await user.click(screen.getByRole('button', { name: /save links/i }));
    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Links server error');
  });

  it('shows an error toast when saving the display name returns a failure', async () => {
    updateUserMock.mockResolvedValueOnce({ error: { message: 'Display name server error' } });
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const input = screen.getByLabelText(/^display name$/i);
    await user.type(input, 'Aisha');
    await user.click(screen.getByRole('button', { name: /save display name/i }));
    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Display name server error');
  });

  it('shows an error toast when updating the password returns a failure', async () => {
    updateUserMock.mockResolvedValueOnce({ error: { message: 'Password server error' } });
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    await user.type(screen.getByLabelText(/^new password$/i), 'hunter22');
    await user.type(screen.getByLabelText(/confirm new password/i), 'hunter22');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Password server error');
  });

  it('saves the display name via supabase.auth.updateUser, independently of other sections', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const input = screen.getByLabelText(/^display name$/i);
    await user.type(input, 'Aisha');
    await user.click(screen.getByRole('button', { name: /save display name/i }));
    expect(updateUserMock).toHaveBeenCalledWith({ data: { display_name: 'Aisha' } });
    expect(updateStallName).not.toHaveBeenCalled();
  });

  it('rejects a display name over 60 characters client-side', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const input = screen.getByLabelText(/^display name$/i);
    await user.type(input, 'a'.repeat(61));
    await user.click(screen.getByRole('button', { name: /save display name/i }));
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('saves a new password and clears the fields on success', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    await user.type(screen.getByLabelText(/^new password$/i), 'hunter22');
    await user.type(screen.getByLabelText(/confirm new password/i), 'hunter22');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'hunter22' });
    expect((screen.getByLabelText(/^new password$/i) as HTMLInputElement).value).toBe('');
  });

  it('rejects mismatched passwords client-side without calling updateUser', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    await user.type(screen.getByLabelText(/^new password$/i), 'hunter22');
    await user.type(screen.getByLabelText(/confirm new password/i), 'different');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(screen.getByText('Passwords do not match')).toBeTruthy();
  });

  it('uploads and saves a new avatar via the profile icon uploader', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    expect(uploadMock).toHaveBeenCalled();
    expect(updateUserMock).toHaveBeenCalledWith({
      data: { avatar_url: expect.stringContaining('https://x.supabase.co/v1/') },
    });
    expect(routerRefresh).toHaveBeenCalled();
  });

  it('rolls back avatar state on save failure and shows error toast', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);

    // Initially, should show "Add photo" button (no avatar)
    expect(screen.getByText(/add photo/i)).toBeTruthy();

    // Mock updateUser to return an error
    updateUserMock.mockResolvedValueOnce({
      error: { message: 'Network error' },
    });

    // Upload an avatar file
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    // Wait for the async operation to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // After the save failure, the "Add photo" button should still be visible
    // (avatar state should have been rolled back to null)
    expect(screen.getByText(/add photo/i)).toBeTruthy();

    // Error toast should have been shown
    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Network error');
  });

  it('shows an error toast when saving the stall name throws instead of returning an error', async () => {
    updateStallName.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);
    const input = screen.getByLabelText(/stall\/shop name/i);
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.');
  });

  it('rolls back avatar state when the avatar save throws instead of returning an error', async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);

    expect(screen.getByText(/add photo/i)).toBeTruthy();

    updateUserMock.mockRejectedValueOnce(new Error('network down'));

    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(screen.getByText(/add photo/i)).toBeTruthy();

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.');
  });
});
