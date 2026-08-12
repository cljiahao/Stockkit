import { Boxes, Coins, History } from 'lucide-react';

const BENEFITS = [
  {
    icon: Boxes,
    title: 'Always know your on-hand count',
    body: 'Every restock, waste, and adjustment updates a running balance per product — no more counting shelves to find out what you actually have.',
  },
  {
    icon: Coins,
    title: "See what it's really costing you",
    body: 'Carry a per-unit cost on every product and stockkit rolls it up into your total inventory value automatically.',
  },
  {
    icon: History,
    title: 'Nothing gets lost or overwritten',
    body: 'Every stock change is kept as a permanent, append-only record — restock, waste, and adjustment history you can always look back on.',
  },
];

export function Benefits() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-14">
      <h2 className="font-display mb-10 text-center text-3xl font-semibold">
        Why vendors pick stockkit
      </h2>
      <div className="border-border divide-border fade-rise divide-y overflow-hidden rounded-2xl border">
        {BENEFITS.map((b) => (
          <div key={b.title} className="flex items-start gap-5 px-6 py-6 sm:items-center">
            <div className="bg-primary/10 flex size-11 shrink-0 items-center justify-center rounded-full">
              <b.icon className="text-primary size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">{b.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{b.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
