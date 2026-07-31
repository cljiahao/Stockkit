// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpgradeCta } from './upgrade-cta';

const { requestProUpgradeActionMock } = vi.hoisted(() => ({
  requestProUpgradeActionMock: vi.fn(),
}));

vi.mock('@/app/actions/plan', () => ({
  requestProUpgradeAction: requestProUpgradeActionMock,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';

beforeEach(() => {
  requestProUpgradeActionMock.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

describe('UpgradeCta', () => {
  it('renders the upgrade button and calls nothing until clicked', () => {
    render(<UpgradeCta />);
    expect(screen.getByRole('button', { name: /ask us to upgrade to pro/i })).toBeTruthy();
    expect(requestProUpgradeActionMock).not.toHaveBeenCalled();
  });

  it('files the request and toasts success when the action succeeds', async () => {
    requestProUpgradeActionMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<UpgradeCta />);

    await user.click(screen.getByRole('button', { name: /ask us to upgrade to pro/i }));

    await waitFor(() => {
      expect(requestProUpgradeActionMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Request sent. We'll set you up shortly.");
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('toasts the action error and no success when the request fails', async () => {
    requestProUpgradeActionMock.mockResolvedValue({
      success: false,
      error: 'Could not send your request',
    });
    const user = userEvent.setup();
    render(<UpgradeCta />);

    await user.click(screen.getByRole('button', { name: /ask us to upgrade to pro/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Could not send your request');
    });
    expect(toast.success).not.toHaveBeenCalled();
  });
});
