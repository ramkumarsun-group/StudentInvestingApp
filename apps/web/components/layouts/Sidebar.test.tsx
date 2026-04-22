import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Ram', email: 'ram@example.com' } } }),
  signOut: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('renders all 5 nav links', () => {
    const html = renderToStaticMarkup(<Sidebar />);
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/trade"');
    expect(html).toContain('href="/learn"');
    expect(html).toContain('href="/leaderboard"');
    expect(html).toContain('href="/profile"');
  });

  it('renders all 5 nav labels', () => {
    const html = renderToStaticMarkup(<Sidebar />);
    expect(html).toContain('Dashboard');
    expect(html).toContain('Trade');
    expect(html).toContain('Learn');
    expect(html).toContain('Leaderboard');
    expect(html).toContain('Profile');
  });

  it('active link has primary color class when pathname matches', () => {
    // pathname mocked to /dashboard
    const html = renderToStaticMarkup(<Sidebar />);
    // The /dashboard link should have the active semantic token class
    expect(html).toContain('text-primary');
  });

  it('inactive links have on-surface-variant color class', () => {
    const html = renderToStaticMarkup(<Sidebar />);
    expect(html).toContain('text-on-surface-variant');
  });

  it('renders StockPlay logo and wordmark', () => {
    const html = renderToStaticMarkup(<Sidebar />);
    expect(html).toContain('StockPlay');
    expect(html).toContain('SP');
  });

  it('has correct sidebar width class', () => {
    const html = renderToStaticMarkup(<Sidebar />);
    expect(html).toContain('w-[220px]');
  });

  it('renders sign-out button', () => {
    const html = renderToStaticMarkup(<Sidebar />);
    expect(html).toContain('Sign out');
  });

  it('applies className prop', () => {
    const html = renderToStaticMarkup(<Sidebar className="hidden lg:flex" />);
    expect(html).toContain('hidden lg:flex');
  });
});
