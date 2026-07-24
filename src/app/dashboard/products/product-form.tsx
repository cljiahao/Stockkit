'use client';

import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAsyncAction } from '@/hooks';
import { centsToDollarString, parseDollarsToCents, productFormSchema } from '@/lib/schemas';
import type { Product } from '@/lib/types';
import { FORM_ERROR_CLASS } from '@/lib/utils';
import { deleteProduct, saveProduct } from './actions';

const UNIT_PRESETS = ['unit', 'kg', 'g', 'L', 'mL', 'box', 'pack', 'case'];

interface Props {
  product?: Product;
  onSaved: (product: Product) => void;
  onDeleted?: () => void;
  onCancel?: () => void;
}

/** Create/edit form. Starting quantity is only editable when creating a new
 * product — once a product exists, its on_hand only ever moves through the
 * Log stock form (StockLogForm), never a direct edit. */
export function ProductForm({ product, onSaved, onDeleted, onCancel }: Props) {
  const isNew = !product;
  const [name, setName] = useState(product?.name ?? '');
  const [unit, setUnit] = useState(product?.unit ?? 'unit');
  const [unitCostDollars, setUnitCostDollars] = useState(
    centsToDollarString(product?.unit_cost_cents ?? 0)
  );
  const [onHand, setOnHand] = useState(String(product?.on_hand ?? 0));
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(product?.low_stock_threshold ?? 0)
  );
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [costError, setCostError] = useState<string | null>(null);
  const { pending: saving, run: runSave } = useAsyncAction();
  const { pending: deleting, run: runDelete } = useAsyncAction();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const costParsed = parseDollarsToCents(unitCostDollars);
    if (!costParsed.ok) {
      setCostError('Enter a valid unit cost');
      return;
    }
    setCostError(null);
    const candidate = {
      id: product?.id,
      name,
      unit,
      unit_cost_cents: costParsed.cents ?? 0,
      on_hand: Number(onHand),
      low_stock_threshold: Number(lowStockThreshold),
      is_active: isActive,
    };
    const parsed = productFormSchema.safeParse(candidate);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Check the product details');
      return;
    }

    return runSave(async () => {
      const result = await saveProduct(parsed.data);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(isNew ? 'Product added' : 'Product saved');
      const now = new Date().toISOString();
      onSaved({
        id: result.productId,
        vendor_id: product?.vendor_id ?? '',
        name: parsed.data.name,
        unit: parsed.data.unit,
        unit_cost_cents: parsed.data.unit_cost_cents,
        on_hand: isNew ? parsed.data.on_hand : (product?.on_hand ?? 0),
        low_stock_threshold: parsed.data.low_stock_threshold,
        is_active: parsed.data.is_active,
        created_at: product?.created_at ?? now,
        updated_at: now,
      });
    });
  }

  function onDelete() {
    if (!product) return;
    return runDelete(async () => {
      const result = await deleteProduct(product.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Product deleted');
      onDeleted?.();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="product-name">Name</Label>
        <Input
          id="product-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Chicken thigh"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="product-unit">Unit</Label>
          <Input
            id="product-unit"
            list="unit-presets"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
          <datalist id="unit-presets">
            {UNIT_PRESETS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-cost">Unit cost ($)</Label>
          <Input
            id="product-cost"
            inputMode="decimal"
            className="font-mono"
            value={unitCostDollars}
            onChange={(e) => setUnitCostDollars(e.target.value)}
            aria-invalid={!!costError}
            aria-describedby={costError ? 'product-cost-error' : undefined}
          />
          {costError && (
            <p id="product-cost-error" className={FORM_ERROR_CLASS}>
              {costError}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {isNew && (
          <div className="space-y-2">
            <Label htmlFor="product-on-hand">Starting quantity</Label>
            <Input
              id="product-on-hand"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              className="font-mono"
              value={onHand}
              onChange={(e) => setOnHand(e.target.value)}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="product-threshold">Low-stock threshold</Label>
          <Input
            id="product-threshold"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            className="font-mono"
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(e.target.value)}
          />
        </div>
      </div>

      <label className="border-border flex items-center justify-between rounded-lg border px-4 py-3">
        <span className="text-sm">
          <span className="font-medium">Active</span>
          <span className="text-muted-foreground block text-xs">
            Inactive products are hidden from the dashboard overview.
          </span>
        </span>
        <Switch checked={isActive} onCheckedChange={setIsActive} />
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? 'Saving…' : isNew ? 'Add product' : 'Save changes'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>

      {!isNew && (
        <div className="border-destructive/30 bg-destructive/[0.03] space-y-2 rounded-lg border p-4">
          <p className="text-destructive text-xs font-semibold tracking-wider uppercase">
            Danger zone
          </p>
          <p className="text-muted-foreground text-sm">
            Deleting this product permanently removes it and its entire stock history.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
                disabled={deleting || saving}
              >
                <Trash2 className="size-4" />
                {deleting ? 'Deleting…' : 'Delete product'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &ldquo;{product?.name}&rdquo;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes the product and its stock history. This can&apos;t be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Keep product</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  disabled={deleting}
                  className="bg-destructive hover:bg-destructive/90 text-white"
                >
                  Delete product
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </form>
  );
}
