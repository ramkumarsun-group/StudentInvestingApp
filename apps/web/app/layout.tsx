import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'StudentInvest — Learn Investing By Doing',
  description: 'Master investing with virtual money, real market data, and AI coaching. Built for students.',
  manifest: '/manifest.json',
  themeColor: '#16a34a',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'StudentInvest' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head />
      <body className="bg-surface-950 text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
