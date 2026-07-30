import type { ReactNode } from 'react';

import { ElevatedCard } from '@/components/elevated-card';

interface SectionProps {
  icon: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
}

// The per-field-group shell every profile-settings-page section uses, per
// docs/business/2026-07-21-profile-settings-page-standard.md §2.1: an icon
// chip, an eyebrow ("who sees this"), a title, a one-line description, and
// the field(s) themselves.
export function Section({ icon, eyebrow, title, description, children }: SectionProps) {
  return (
    <ElevatedCard as="section" className="px-6 py-6">
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-lg">
          {icon}
        </span>
        <div>
          {eyebrow && (
            <p className="text-muted-foreground text-[0.7rem] font-semibold tracking-[0.16em] uppercase">
              {eyebrow}
            </p>
          )}
          <h2 className="font-display text-xl leading-tight font-semibold">{title}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </ElevatedCard>
  );
}
