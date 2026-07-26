'use client';

import { Minus, Plus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAsyncAction } from '@/hooks';
import { centsToDollarString, parseDollarsToCents, stockMovementFormSchema } from '@/lib/schemas';
import type { Product, ProductComponent } from '@/lib/types';
import { getProductComponents, recordLinkedMovement, recordStockMovement } from './actions';

type Reason = 'restock' | 'waste' | 'adjustment';

const REASON_LABEL: Record<Reason, string> = {
  restock: 'Restock',
  waste: 'Waste',
  adjustment: 'Adjustment',
};

interface Props {
  product: Product;
  onRecorded: (product: Product) => void;
}

/** Log a stock movement (in/out) for one product — the ledger write path. */
export function StockLogForm({ product, onRecorded }: Props) {
  const [reason, setReason] = useState<Reason>('restock');
  const [quantity, setQuantity] = useState(1);
  // Only meaningful for 'adjustment' — restock is always +, waste is always -.
  const [adjustmentSign, setAdjustmentSign] = useState<1 | -1>(1);
  const [note, setNote] = useState('');
  const [unitCostDollars, setUnitCostDollars] = useState(
    centsToDollarString(product.unit_cost_cents)
  );
  const { pending, run } = useAsyncAction();
  const [linkedComponents, setLinkedComponents] = useState<ProductComponent[]>([]);
  // Only holds a component's value once the vendor has explicitly edited it —
  // anything absent here falls back to the quantity_per_unit * quantity
  // estimate, computed at render time so it stays in sync as quantity
  // changes without a setState-in-effect cascade.
  const [componentOverrides, setComponentOverrides] = useState<Record<string, number>>({});

  const sign = reason === 'restock' ? 1 : reason === 'waste' ? -1 : adjustmentSign;

  useEffect(() => {
    let cancelled = false;
    void getProductComponents(product.id).then((result) => {
      if (!cancelled && result.success) setLinkedComponents(result.components);
    });
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  function componentActual(c: ProductComponent): number {
    return componentOverrides[c.component_product_id] ?? c.quantity_per_unit * quantity;
  }

  function step(amount: number) {
    setQuantity((q) => Math.max(0, q + amount));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();

    let unit_cost_cents: number | undefined;
    if (reason === 'restock') {
      const parsedCost = parseDollarsToCents(unitCostDollars);
      if (!parsedCost.ok) {
        toast.error('Enter a valid unit cost');
        return;
      }
      unit_cost_cents = parsedCost.cents;
    }

    const candidate = {
      product_id: product.id,
      delta: sign * quantity,
      reason,
      note: note.trim() || undefined,
      unit_cost_cents,
    };
    const parsed = stockMovementFormSchema.safeParse(candidate);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Check the movement details');
      return;
    }

    return run(async () => {
      const result =
        linkedComponents.length > 0 && reason === 'restock'
          ? await recordLinkedMovement({
              ...parsed.data,
              component_overrides: Object.fromEntries(
                linkedComponents.map((c) => [c.component_product_id, -1 * componentActual(c)])
              ),
            })
          : await recordStockMovement(parsed.data);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${REASON_LABEL[reason]} recorded`);
      setQuantity(1);
      setNote('');
      onRecorded(result.product);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="movement-reason">Reason</Label>
        <Select value={reason} onValueChange={(v) => setReason(v as Reason)}>
          <SelectTrigger id="movement-reason" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="restock">Restock</SelectItem>
            <SelectItem value="waste">Waste</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {reason === 'adjustment' && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={adjustmentSign === 1 ? 'default' : 'outline'}
            onClick={() => setAdjustmentSign(1)}
          >
            Add stock
          </Button>
          <Button
            type="button"
            size="sm"
            variant={adjustmentSign === -1 ? 'default' : 'outline'}
            onClick={() => setAdjustmentSign(-1)}
          >
            Remove stock
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <Label>Quantity</Label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 rounded-lg"
            onClick={() => step(-1)}
            aria-label="Decrease quantity"
          >
            <Minus className="size-4" />
          </Button>
          <Input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            className="h-11 w-24 text-center font-mono text-lg font-semibold tabular-nums"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))}
            aria-label="Quantity"
          />
          <Button
            type="button"
            size="icon"
            className="size-11 rounded-lg"
            onClick={() => step(1)}
            aria-label="Increase quantity"
          >
            <Plus className="size-4" />
          </Button>
          <span className="text-muted-foreground text-sm">{product.unit}</span>
        </div>
      </div>

      {linkedComponents.length > 0 && reason === 'restock' && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Components used</p>
          {linkedComponents.map((c) => (
            <div key={c.component_product_id} className="flex items-center gap-2">
              <Label
                htmlFor={`component-actual-${c.component_product_id}`}
                className="flex-1 text-xs"
              >
                {c.component_product_id} actually used
              </Label>
              <Input
                id={`component-actual-${c.component_product_id}`}
                type="number"
                min={0}
                step="any"
                className="w-28 font-mono"
                value={componentActual(c)}
                onChange={(e) =>
                  setComponentOverrides((prev) => ({
                    ...prev,
                    [c.component_product_id]: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
          ))}
        </div>
      )}

      {reason === 'restock' && (
        <div className="space-y-2">
          <Label htmlFor="movement-unit-cost">Unit cost this restock ($)</Label>
          <Input
            id="movement-unit-cost"
            inputMode="decimal"
            className="font-mono"
            value={unitCostDollars}
            onChange={(e) => setUnitCostDollars(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="movement-note">Note (optional)</Label>
        <Textarea
          id="movement-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending || quantity <= 0}>
        {pending ? 'Saving…' : `${REASON_LABEL[reason]} · ${quantity} ${product.unit}`}
      </Button>
    </form>
  );
}
