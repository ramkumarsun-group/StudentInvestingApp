import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

// Mock BadgeNotifier — it uses useQueryClient which requires a provider
vi.mock('@/components/BadgeNotifier', () => ({
  BadgeNotifier: () => null,
}));

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Test User', email: 'test@example.com' } } }),
  signOut: vi.fn(),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renders children inside main', () => {
    const html = renderToStaticMarkup(
      <AppShell><div id="test-child">Hello</div></AppShell>
    );
    expect(html).toContain('Hello');
    expect(html).toContain('test-child');
  });

  it('renders Sidebar markup in the DOM (SSR-safe)', () => {
    const html = renderToStaticMarkup(
      <AppShell><span>content</span></AppShell>
    );
    // Sidebar is in DOM — hidden via CSS class, not conditionally removed
    expect(html).toContain('hidden lg:flex');
  });

  it('renders BottomNav markup in the DOM (SSR-safe)', () => {
    const html = renderToStaticMarkup(
      <AppShell><span>content</span></AppShell>
    );
    // BottomNav is in DOM — hidden via CSS class, not conditionally removed
    expect(html).toContain('flex lg:hidden');
  });

  it('main content has desktop sidebar offset class', () => {
    const html = renderToStaticMarkup(
      <AppShell><span>content</span></AppShell>
    );
    expect(html).toContain('lg:ml-[220px]');
  });

  it('main content has mobile bottom padding class (safe-area aware)', () => {
    const html = renderToStaticMarkup(
      <AppShell><span>content</span></AppShell>
    );
    // P7: padding accounts for BottomNav height + iOS safe-area inset
    expect(html).toContain('pb-[calc(4rem+env(safe-area-inset-bottom))]');
  });
});
