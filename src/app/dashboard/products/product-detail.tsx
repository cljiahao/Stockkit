'use client';

import { useState } from 'react';

import { StockStatusIndicator } from '@/components/stock-status-indicator';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { stockStatusFor } from '@/lib/stock';
import type { Product } from '@/lib/types';
import { LEDGER_MD_CLASS } from '@/lib/utils';
import { MovementHistory } from './movement-history';
import { ProductForm } from './product-form';
import { StockLogForm } from './stock-log-form';

interface Props {
  product: Product;
  // 'tabs' = mobile dialog (tight vertical space, one section visible at a
  // time); 'stacked' = desktop detail panel (everything visible at once).
  layout: 'tabs' | 'stacked';
  onSaved: (product: Product) => void;
  onDeleted: () => void;
}

/**
 * Full detail for a selected product: current status, the log-stock form,
 * the edit form, and movement history. Shared between the mobile Dialog and
 * the desktop split-pane panel — only the wrapping layout differs.
 */
export function ProductDetail({ product, layout, onSaved, onDeleted }: Props) {
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const status = stockStatusFor(product.on_hand, product.low_stock_threshold);

  function onRecorded(updated: Product) {
    onSaved(updated);
    setHistoryRefreshKey((k) => k + 1);
  }

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="truncate text-xl font-semibold">{product.name}</h2>
        <div className="mt-1 flex items-center gap-1.5">
          <StockStatusIndicator status={status} textClassName="text-sm" />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={LEDGER_MD_CLASS}>{product.on_hand}</p>
        <p className="text-muted-foreground text-xs">{product.unit} on hand</p>
      </div>
    </div>
  );

  if (layout === 'tabs') {
    return (
      <div className="space-y-5">
        {header}
        <Tabs defaultValue="stock">
          <TabsList className="w-full">
            <TabsTrigger value="stock" className="flex-1">
              Log stock
            </TabsTrigger>
            <TabsTrigger value="edit" className="flex-1">
              Edit
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              History
            </TabsTrigger>
          </TabsList>
          <TabsContent value="stock" className="pt-4">
            <StockLogForm product={product} onRecorded={onRecorded} />
          </TabsContent>
          <TabsContent value="edit" className="pt-4">
            <ProductForm product={product} onSaved={onSaved} onDeleted={onDeleted} />
          </TabsContent>
          <TabsContent value="history" className="pt-4">
            <MovementHistory productId={product.id} refreshKey={historyRefreshKey} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}
      <section className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Log stock
        </h3>
        <StockLogForm product={product} onRecorded={onRecorded} />
      </section>
      <Separator />
      <section className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Edit product
        </h3>
        <ProductForm product={product} onSaved={onSaved} onDeleted={onDeleted} />
      </section>
      <Separator />
      <section className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          History
        </h3>
        <MovementHistory productId={product.id} refreshKey={historyRefreshKey} />
      </section>
    </div>
  );
}
