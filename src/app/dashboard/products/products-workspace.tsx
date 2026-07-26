'use client';

import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Product } from '@/lib/types';
import { ProductDetail } from './product-detail';
import { ProductForm } from './product-form';
import { ProductRow } from './product-row';

interface Props {
  initialProducts: Product[];
}

type MobileDialogState = { kind: 'product'; productId: string } | { kind: 'new' } | null;

function EmptyProductsCard() {
  return (
    <div className="border-border rounded-xl border border-dashed py-16 text-center">
      <p className="text-lg font-semibold">No products yet</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Add your first product to start tracking stock.
      </p>
    </div>
  );
}

/**
 * Products list + detail. One component drives both breakpoints — mobile
 * (< md) shows a single-column list where tapping a row opens a Dialog;
 * tablet/desktop (md+) shows a two-pane layout (list + a persistent detail
 * panel), toggled purely via `hidden md:block` / `md:hidden`, so there is one
 * source of truth for selection/save/delete state (mirrors the
 * "server passes `initial` data, client owns state" pattern from qkit's
 * booth-form.tsx).
 */
export function ProductsWorkspace({ initialProducts }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'new'>('view');
  const [mobileDialog, setMobileDialog] = useState<MobileDialogState>(null);

  // Server actions revalidatePath, which re-fetches this page's server data
  // and passes a fresh `initialProducts` array down — sync local state to it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProducts(initialProducts);
  }, [initialProducts]);

  const selected = products.find((p) => p.id === selectedId) ?? null;

  function upsertLocal(product: Product) {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id);
      if (idx === -1) return [...prev, product].sort((a, b) => a.name.localeCompare(b.name));
      const next = [...prev];
      next[idx] = product;
      return next;
    });
  }

  function onProductSaved(product: Product) {
    upsertLocal(product);
    setSelectedId(product.id);
    setMode('view');
    setMobileDialog(null);
  }

  function onProductDeleted(productId: string) {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    if (selectedId === productId) setSelectedId(null);
    setMobileDialog(null);
  }

  function openMobileForProduct(productId: string) {
    setSelectedId(productId);
    setMode('view');
    setMobileDialog({ kind: 'product', productId });
  }

  function openMobileForNew() {
    setMode('new');
    setMobileDialog({ kind: 'new' });
  }

  function selectDesktop(productId: string) {
    setSelectedId(productId);
    setMode('view');
  }

  function startNewDesktop() {
    setSelectedId(null);
    setMode('new');
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {products.length} product{products.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button className="md:hidden" onClick={openMobileForNew}>
          <Plus className="size-4" />
          Add product
        </Button>
        <Button className="hidden md:inline-flex" onClick={startNewDesktop}>
          <Plus className="size-4" />
          Add product
        </Button>
      </div>

      {/* Mobile: single-column list, tap a row to open the dialog */}
      <div className="mt-6 space-y-2 md:hidden">
        {products.length === 0 ? (
          <EmptyProductsCard />
        ) : (
          products.map((p) => (
            <ProductRow key={p.id} product={p} onClick={() => openMobileForProduct(p.id)} />
          ))
        )}
      </div>

      {/* Tablet/desktop: two-pane layout, no dialog. The detail pane (right)
          renders purely off `mode`/`selected`, independent of whether the
          list (left) is empty — so "Add product" works from a zero-product
          account too. */}
      <div className="mt-6 hidden gap-6 md:grid md:grid-cols-[minmax(0,42%)_1fr]">
        <div className="max-h-[calc(100vh-14rem)] space-y-2 overflow-y-auto pr-1">
          {products.length === 0 ? (
            <EmptyProductsCard />
          ) : (
            products.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                selected={p.id === selectedId && mode === 'view'}
                onClick={() => selectDesktop(p.id)}
              />
            ))
          )}
        </div>
        <div className="border-border bg-card rounded-xl border p-6">
          {mode === 'new' ? (
            <ProductForm onSaved={onProductSaved} onCancel={() => setMode('view')} />
          ) : selected ? (
            <ProductDetail
              product={selected}
              layout="stacked"
              onSaved={onProductSaved}
              onDeleted={() => onProductDeleted(selected.id)}
            />
          ) : (
            <div className="flex min-h-[240px] items-center justify-center text-center">
              <p className="text-muted-foreground text-sm">
                Select a product to log stock or see its history.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile dialog — add / log / edit / history */}
      <Dialog open={mobileDialog !== null} onOpenChange={(open) => !open && setMobileDialog(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          {mobileDialog?.kind === 'new' && (
            <>
              <DialogHeader>
                <DialogTitle>Add product</DialogTitle>
                <DialogDescription>Add a new product to track.</DialogDescription>
              </DialogHeader>
              <ProductForm onSaved={onProductSaved} />
            </>
          )}
          {mobileDialog?.kind === 'product' && selected && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>
                  Log stock, edit, or view history for {selected.name}.
                </DialogDescription>
              </DialogHeader>
              <ProductDetail
                product={selected}
                layout="tabs"
                onSaved={onProductSaved}
                onDeleted={() => onProductDeleted(selected.id)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
