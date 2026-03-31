import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Mock all client-side dependencies
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined }),
}));
vi.mock('@/lib/api-client', () => ({ default: { get: vi.fn() } }));
vi.mock('@student-investing/shared-utils', () => ({
  formatUSD: (v: number) => `$${v}`,
  formatPercent: (v: number) => `${v}%`,
}));
vi.mock('@/components/charts/PortfolioMiniChart', () => ({
  default: () => <div data-testid="mini-chart" />,
}));
vi.mock('@/lib/utils', () => ({ cn: (...c: string[]) => c.filter(Boolean).join(' ') }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

import DashboardPage from './page';

describe('DashboardPage — desktop grid', () => {
  it('renders the desktop two-column grid wrapper', () => {
    const html = renderToStaticMarkup(<DashboardPage />);
    expect(html).toContain('lg:grid-cols-[1fr_320px]');
  });

  it('renders portfolio summary section in left column', () => {
    const html = renderToStaticMarkup(<DashboardPage />);
    expect(html).toContain('Portfolio Value');
  });

  it('renders market movers aside in right column', () => {
    const html = renderToStaticMarkup(<DashboardPage />);
    expect(html).toContain('Market Movers');
  });

  it('renders learning progress aside in right column', () => {
    const html = renderToStaticMarkup(<DashboardPage />);
    expect(html).toContain('Learning');
  });

  it('renders Trade link', () => {
    const html = renderToStaticMarkup(<DashboardPage />);
    expect(html).toContain('/trade');
  });

  it('renders right column as aside element', () => {
    const html = renderToStaticMarkup(<DashboardPage />);
    expect(html).toContain('<aside');
  });
});
