import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Mock all client-side dependencies
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/lib/api-client', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('@student-investing/shared-utils', () => ({
  formatUSD: (v: number) => `$${v}`,
  formatPercent: (v: number) => `${v}%`,
}));
vi.mock('@/lib/utils', () => ({ cn: (...c: string[]) => c.filter(Boolean).join(' ') }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Sector: () => null,
}));

import PortfolioPage from './page';

describe('PortfolioPage — desktop grid', () => {
  it('renders the desktop two-column grid wrapper', () => {
    const html = renderToStaticMarkup(<PortfolioPage />);
    expect(html).toContain('lg:grid-cols-2');
  });

  it('renders summary stats in left column', () => {
    const html = renderToStaticMarkup(<PortfolioPage />);
    expect(html).toContain('Total Value');
    expect(html).toContain('Cash Available');
  });

  it('renders performance chart in left column', () => {
    const html = renderToStaticMarkup(<PortfolioPage />);
    expect(html).toContain('Portfolio Performance');
  });

  it('renders holdings section in right column', () => {
    const html = renderToStaticMarkup(<PortfolioPage />);
    expect(html).toContain('Holdings');
    expect(html).toContain('Order History');
  });

  it('renders allocation chart in right column', () => {
    const html = renderToStaticMarkup(<PortfolioPage />);
    expect(html).toContain('Allocation');
  });

  it('renders reset button', () => {
    const html = renderToStaticMarkup(<PortfolioPage />);
    expect(html).toContain('Reset');
  });
});
