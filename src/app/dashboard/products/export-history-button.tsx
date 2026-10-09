'use client';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { exportProductMovementsCsv } from './actions';
export function ExportHistoryButton({ productId }: { productId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function download() {
    setPending(true);
    setError(null);
    let url: string | undefined;
    try {
      const result = await exportProductMovementsCsv(productId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'stock-history.csv';
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
    } catch {
      setError('Could not export history. Please try again.');
    } finally {
      if (url) {
        const downloadUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
      setPending(false);
    }
  }
  return (
    <div>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={download}>
        {pending ? 'Exporting…' : 'Export CSV (Pro)'}
      </Button>
      {error && (
        <p role="alert" className="text-destructive mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
