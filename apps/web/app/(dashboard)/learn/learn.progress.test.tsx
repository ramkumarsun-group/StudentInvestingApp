import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Mock dependencies
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: [
      {
        id: 'm1', slug: 'stocks-101', title: 'Stocks 101',
        description: 'Learn stocks', difficulty: 'beginner',
        xp_reward: 200, total_estimated_minutes: 30,
        lesson_count: 4, completed_lessons: 2, completion_pct: 50,
        is_published: true, requires_pro: false,
      },
      {
        id: 'm2', slug: 'bonds-basics', title: 'Bonds Basics',
        description: 'Learn bonds', difficulty: 'beginner',
        xp_reward: 300, total_estimated_minutes: 45,
        lesson_count: 3, completed_lessons: 3, completion_pct: 100,
        is_published: true, requires_pro: false,
      },
    ],
    isLoading: false,
  })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({}),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className, onClick, onKeyDown, role, tabIndex }: {
    href: string; children: React.ReactNode; className?: string;
    onClick?: () => void; onKeyDown?: () => void; role?: string; tabIndex?: number;
  }) => React.createElement('a', { href, className, onClick, onKeyDown, role, tabIndex }, children),
}));

// No react mock needed — renderToStaticMarkup does not execute state updates,
// so useState(false) returns false by default without stubbing (P3 review fix).

import LearnPage from './page';

describe('LearnPage — progress display (AC1, AC2, AC4)', () => {
  it('shows lesson count for partially complete module (AC1)', () => {
    const html = renderToStaticMarkup(<LearnPage />);
    expect(html).toContain('2/4 lessons');
  });

  it('shows "Complete ✓" for 100% module (AC4)', () => {
    const html = renderToStaticMarkup(<LearnPage />);
    expect(html).toContain('Complete ✓');
  });

  it('shows 3/3 lessons for fully complete module', () => {
    const html = renderToStaticMarkup(<LearnPage />);
    expect(html).toContain('3/3 lessons');
  });

  it('progress bar uses emerald colour for completed module', () => {
    const html = renderToStaticMarkup(<LearnPage />);
    expect(html).toContain('bg-emerald-500');
  });
});
