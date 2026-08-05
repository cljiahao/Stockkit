import type { ReactNode } from 'react';

interface SentConfirmationProps {
  children: ReactNode;
}

// Shared success-state card for the Sheet-mounted feedback/support forms —
// both replace their whole body with this once the server action succeeds.
export function SentConfirmation({ children }: SentConfirmationProps) {
  return (
    <div className="bg-card text-muted-foreground rounded-xl border px-4 py-3 text-center text-sm">
      {children}
    </div>
  );
}
