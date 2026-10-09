// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportHistoryButton } from './export-history-button';
const mocks = vi.hoisted(() => ({ exportCsv: vi.fn() }));
vi.mock('./actions', () => ({ exportProductMovementsCsv: mocks.exportCsv }));
const createUrl = vi.fn(() => 'blob:fixture');
const revokeUrl = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static readonly createObjectURL = createUrl;
      static readonly revokeObjectURL = revokeUrl;
    }
  );
});
afterEach(() => vi.unstubAllGlobals());
describe('ExportHistoryButton', () => {
  it('downloads authorized CSV and cleans its object URL', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mocks.exportCsv.mockResolvedValue({
      success: true,
      csv: 'date,reason,delta,note\nfixture,restock,1,safe',
    });
    render(<ExportHistoryButton productId="product-id" />);
    await userEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(revokeUrl).toHaveBeenCalledWith('blob:fixture'), { timeout: 2000 });
    expect(mocks.exportCsv).toHaveBeenCalledWith('product-id');
    expect(createUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull();
    click.mockRestore();
  });
  it('retains entitlement errors and allows retry after transport rejection', async () => {
    mocks.exportCsv
      .mockResolvedValueOnce({ success: false, error: 'CSV export is a Pro feature.' })
      .mockRejectedValueOnce(new Error('offline'));
    render(<ExportHistoryButton productId="product-id" />);
    await userEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Pro feature');
    await userEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please try again');
    expect(screen.getByRole('button')).toBeEnabled();
    expect(createUrl).not.toHaveBeenCalled();
  });
  it('cleans the URL and resets controls if browser download fails', async () => {
    mocks.exportCsv.mockResolvedValue({ success: true, csv: 'header' });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw Error('unavailable');
    });
    render(<ExportHistoryButton productId="product-id" />);
    await userEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please try again');
    await waitFor(() => expect(revokeUrl).toHaveBeenCalledWith('blob:fixture'), { timeout: 2000 });
    expect(document.querySelector('a[download]')).toBeNull();
    expect(screen.getByRole('button')).toBeEnabled();
    click.mockRestore();
  });
});
