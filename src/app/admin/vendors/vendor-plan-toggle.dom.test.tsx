// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ActionResult } from '@/lib/action-result';

const { setVendorPlanMock, refreshMock } = vi.hoisted(() => ({
  setVendorPlanMock: vi.fn(async (_formData: FormData): Promise<ActionResult> => ({
    success: true,
  })),
  refreshMock: vi.fn(),
}));

vi.mock('@/app/admin/actions', () => ({ setVendorPlan: setVendorPlanMock }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';

import { VendorPlanToggle } from './vendor-plan-toggle';

afterEach(() => {
  setVendorPlanMock.mockReset();
  setVendorPlanMock.mockResolvedValue({ success: true });
  refreshMock.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

describe('VendorPlanToggle', () => {
  it('grants Pro and refreshes on success', async () => {
    const user = userEvent.setup();
    render(<VendorPlanToggle vendorId="v1" vendorName="Kopi Stall" plan="free" />);

    await user.click(screen.getByRole('button', { name: /make pro/i }));

    expect(setVendorPlanMock).toHaveBeenCalled();
    const formData = setVendorPlanMock.mock.calls[0][0] as FormData;
    expect(formData.get('vendorId')).toBe('v1');
    expect(formData.get('plan')).toBe('pro');
    expect(toast.success).toHaveBeenCalledWith('Kopi Stall is now Pro.');
    expect(refreshMock).toHaveBeenCalled();
  });

  it('removes Pro back to Free', async () => {
    const user = userEvent.setup();
    render(<VendorPlanToggle vendorId="v2" vendorName="Bakery" plan="pro" />);

    await user.click(screen.getByRole('button', { name: /make free/i }));

    const formData = setVendorPlanMock.mock.calls[0][0] as FormData;
    expect(formData.get('plan')).toBe('free');
    expect(toast.success).toHaveBeenCalledWith('Bakery is back on Free.');
  });

  it('shows an error toast and does not refresh when the action fails', async () => {
    setVendorPlanMock.mockResolvedValueOnce({
      success: false,
      error: 'Could not update vendor plan',
    });
    const user = userEvent.setup();
    render(<VendorPlanToggle vendorId="v1" vendorName="Kopi Stall" plan="free" />);

    await user.click(screen.getByRole('button', { name: /make pro/i }));

    expect(toast.error).toHaveBeenCalledWith('Could not update vendor plan');
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
