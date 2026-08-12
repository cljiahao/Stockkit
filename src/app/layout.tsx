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
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
