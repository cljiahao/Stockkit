import { Section as SharedSection } from '@merqo/ui';
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
// the field(s) themselves. Thin adapter over @merqo/ui's Section — the
// header/eyebrow/title/description rendering is shared; ElevatedCard (this
// app's own lifted-shadow card, not qkit's Ticket motif) is injected via the
// `wrapper` slot, which fully replaces the shared default bg-card/border/
// shadow-sm shell.
export function Section({ icon, eyebrow, title, description, children }: SectionProps) {
  return (
    <SharedSection
      icon={icon}
      eyebrow={eyebrow}
      title={title}
      description={description}
      wrapper={(content) => (
        <ElevatedCard as="section" className="px-6 py-6">
          {content}
        </ElevatedCard>
      )}
    >
      {children}
    </SharedSection>
  );
}
