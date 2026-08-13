'use client';

import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ElevatedCard } from '@/components/elevated-card';
import { STOCK_STATUS_DOT_CLASS } from '@/lib/stock';
import { cn } from '@/lib/utils';

// A marketing illustration (not real data) — stockkit's answer to qkit's
// live order-board carousel / loopkit's stamp card: show the actual product
// concept (a ledger entry) instead of describing it in text. The activity
// row cycles through a couple of sample entries so the card reads as a
// *live, running* ledger rather than a frozen screenshot. Motion is gated
// on prefers-reduced-motion (falls back to leaving the first entry showing,
// same pattern as dashboard-tour.tsx's matchMedia guard) and reuses the
// existing `.fade-rise` treatment (see globals.css) instead of introducing
// new animation infrastructure.
const SAMPLE_ACTIVITY = [
  { icon: ArrowUpRight, tone: 'text-stock-ok', label: '+12 restock', time: '2h ago' },
  { icon: ArrowDownRight, tone: 'text-stock-low', label: '−3 waste', time: '5h ago' },
];

export function LedgerCardPreview() {
  const [activityIndex, setActivityIndex] = useState(0);

  useEffect(() => {
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const id = setInterval(() => {
      setActivityIndex((i) => (i + 1) % SAMPLE_ACTIVITY.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const activity = SAMPLE_ACTIVITY[activityIndex];

  return (
    <ElevatedCard className="fade-rise mx-auto w-full max-w-sm p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className={cn('size-2.5 rounded-full', STOCK_STATUS_DOT_CLASS.ok)} />
          <span className="text-sm font-semibold">Whole Bean Coffee 1kg</span>
        </div>
        <span className="text-muted-foreground text-xs">In stock</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">On hand</p>
          <p className="font-mono text-3xl font-semibold">42</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">Unit cost</p>
          <p className="font-mono text-3xl font-semibold">$18.50</p>
        </div>
      </div>
      <div className="border-border mt-5 border-t pt-4">
        <div key={activityIndex} className="fade-rise flex items-center gap-2 text-sm">
          <activity.icon className={cn('size-4', activity.tone)} aria-hidden />
          <span className="font-mono">{activity.label}</span>
          <span className="text-muted-foreground">· {activity.time}</span>
        </div>
      </div>
    </ElevatedCard>
  );
}
