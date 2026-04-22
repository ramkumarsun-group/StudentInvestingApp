import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  usePathname: () => '/learn',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

import { BottomNav } from './BottomNav';

describe('BottomNav', () => {
  it('renders all 5 nav items', () => {
    const html = renderToStaticMarkup(<BottomNav />);
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/trade"');
    expect(html).toContain('href="/learn"');
    expect(html).toContain('href="/leaderboard"');
    expect(html).toContain('href="/profile"');
  });

  it('renders all 5 nav labels', () => {
    const html = renderToStaticMarkup(<BottomNav />);
    expect(html).toContain('Dashboard');
    expect(html).toContain('Trade');
    expect(html).toContain('Learn');
    expect(html).toContain('Leaderboard');
    expect(html).toContain('Profile');
  });

  it('active link (/learn) has primary color class', () => {
    // pathname mocked to /learn
    const html = renderToStaticMarkup(<BottomNav />);
    expect(html).toContain('text-primary');
  });

  it('inactive links have on-surface-variant color class', () => {
    const html = renderToStaticMarkup(<BottomNav />);
    expect(html).toContain('text-on-surface-variant');
  });

  it('has correct fixed bottom bar classes', () => {
    const html = renderToStaticMarkup(<BottomNav />);
    expect(html).toContain('h-16');
    expect(html).toContain('z-40');
  });

  it('applies className prop', () => {
    const html = renderToStaticMarkup(<BottomNav className="flex lg:hidden" />);
    expect(html).toContain('flex lg:hidden');
  });
});
