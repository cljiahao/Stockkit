import type { ReactNode } from 'react';

import { Providers, ThemeProvider } from '@/components/layout';
import type { Metadata } from 'next';
import { Fraunces, Geist_Mono, Lato } from 'next/font/google';
import './globals.css';

const lato = Lato({
  variable: '--font-lato',
  subsets: ['latin'],
  weight: ['100', '300', '400', '700', '900'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Display: family-wide shared face (see docs/business/2026-08-13-typography-family-standard.md).
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
});

export const metadata: Metadata = {
  title: 'Stockkit | Inventory Tracking',
  description:
    'Inventory tracking for small vendors — add products, log stock in/out, and see inventory value and low-stock alerts at a glance.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className="no-scrollbar">
      <body
        className={`${lato.variable} ${geistMono.variable} ${fraunces.variable} relative antialiased`}
      >
        {/* `defaultTheme="system"` + `enableSystem` (next-themes' own default,
            spelled out here so it isn't lost to a future edit) makes the
            already-built `.dark` palette in globals.css reachable via OS/
            browser preference on first visit, since a hardcoded "light"
            default previously pinned every vendor to light regardless of
            device setting. Manual override now lives in `@merqo/ui`'s
            AccountMenu (v0.18.0+), persisted via next-themes' own
            localStorage key and shared across every route under this one
            provider. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
