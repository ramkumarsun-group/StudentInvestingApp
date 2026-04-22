import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Manrope, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// Display font — headings (confirmed from Stitch Editorial Intelligence theme)
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

// Body font — labels, body copy (confirmed from Stitch Editorial Intelligence theme)
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// P2: Mono font — code/ticker values; loaded via next/font to avoid FOUT
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'StockPlay — Learn Investing By Doing',
  description: 'Master investing with virtual money, real market data, and AI coaching. Built for students.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'StockPlay' },
};

// P8: themeColor must live in viewport export (metadata.themeColor deprecated in Next.js 14)
// P-15: Use surface-container (#1e2022) — a dark background suits the dark-theme app;
//        #acc7ff is a text token (light periwinkle) which makes PWA chrome very light.
export const viewport: Viewport = {
  themeColor: '#1e2022',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${manrope.variable} ${jetbrainsMono.variable}`}>
      <head />
      <body className="bg-surface text-on-surface antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
