import type { ReactNode } from 'react';

import { Providers, ThemeProvider } from '@/components/layout';
import type { Metadata } from 'next';
import { Geist_Mono, Lato, Space_Grotesk } from 'next/font/google';
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

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
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
        className={`${lato.variable} ${geistMono.variable} ${spaceGrotesk.variable} relative antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
