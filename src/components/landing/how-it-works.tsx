import { ListChecks, RefreshCw, TrendingUp } from 'lucide-react';

import { ElevatedCard } from '@merqo/ui';

const STEPS = [
  {
    icon: ListChecks,
    title: 'Add your products',
    body: 'List what you stock, its unit cost, and a low-stock threshold.',
  },
  {
    icon: RefreshCw,
    title: 'Log stock in and out',
    body: 'Restock, record waste, or adjust counts — every change is logged.',
  },
  {
    icon: TrendingUp,
    title: 'Watch your numbers',
    body: 'See total inventory value and get alerted when something runs low.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-5xl px-5 py-14">
      <h2 className="font-display mb-10 text-center text-3xl font-semibold">
        Up and running in three steps
      </h2>
      <div className="grid gap-5 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <ElevatedCard
            key={step.title}
            className="fade-rise p-6 transition-transform duration-200 hover:-translate-y-1"
          >
            <div className="flex items-center gap-3">
              <span className="text-primary font-mono text-sm font-semibold">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="bg-border h-px flex-1" />
              <step.icon className="text-primary size-5" aria-hidden />
            </div>
            <h3 className="mt-4 text-xl font-semibold">{step.title}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{step.body}</p>
          </ElevatedCard>
        ))}
      </div>
    </section>
  );
}
