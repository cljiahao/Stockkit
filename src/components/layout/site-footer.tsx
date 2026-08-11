import Link from 'next/link';

interface SiteFooterProps {
  tagline?: string;
  creditText?: string;
  /** Only meaningful on the signed-out public page — the dashboard's own
   * footer usage (already inside an authenticated area) omits this. */
  showSignIn?: boolean;
}

export function SiteFooter({
  tagline = 'Inventory tracking for small vendors.',
  creditText = '© 2026 stockkit · a Merqo kit',
  showSignIn = false,
}: SiteFooterProps) {
  return (
    <footer className="border-border border-t">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-sm sm:flex-row">
        {/* Plain <a>, not next/link's Link — same-page hash jump to #top,
            see Nav's wordmark comment for why Link doesn't reliably
            update the URL bar's hash on a fragment-only navigation. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/#top"
          aria-label="stockkit home, back to top"
          className="font-display text-foreground text-lg font-bold tracking-tight transition-opacity hover:opacity-80"
        >
          StockKit
        </a>
        <span>{tagline}</span>
        <span className="text-xs">{creditText}</span>
        {showSignIn && (
          <Link href="/login" className="hover:text-foreground">
            Vendor sign in →
          </Link>
        )}
      </div>
    </footer>
  );
}
