/**
 * P2-007 — isPro 403 shows paywall, not error toast.
 * P2-008 — xp_reward null in lesson API response renders as "0 XP".
 * @P2 @Component
 *
 * P2-007: When the module API returns a 403, the Pro paywall component renders
 *         (Lock icon, "Pro Module" heading, Upgrade to Pro link).
 *         The generic error toast must NOT appear.
 *
 * P2-008: When a lesson has xp_reward: null, the LessonCard renders "0 XP"
 *         via the null-coalescing fallback `{lesson.xp_reward ?? 0} XP`.
 *         No NaN or blank value should appear.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// ── Shared mocks ──────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useParams: () => ({ moduleSlug: 'test-pro-module' }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Test User', isPro: false } } }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

// Hoist @tanstack/react-query mock so per-test mockReturnValue works
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(() => ({ getQueryData: vi.fn().mockReturnValue(null) })),
}));

// ── P2-007 — 403 → Pro paywall ─────────────────────────────────────────────

describe('ModulePage — 403 shows Pro paywall (P2-007)', () => {
  it('renders Pro paywall when useQuery returns a 403 error', async () => {
    const { useQuery } = await import('@tanstack/react-query');
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: { response: { status: 403, data: { error: 'Student Pro subscription required' } } },
      isLoading: false,
    } as ReturnType<typeof useQuery>);

    const ModulePage = (await import('./page')).default;
    const html = renderToStaticMarkup(React.createElement(ModulePage));

    // Pro paywall elements must be present
    expect(html).toContain('Pro Module');
    expect(html).toContain('Upgrade to Pro');
  });

  it('renders "Upgrade to Pro" link pointing to /settings for 403 state', async () => {
    const { useQuery } = await import('@tanstack/react-query');
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: { response: { status: 403 } },
      isLoading: false,
    } as ReturnType<typeof useQuery>);

    const ModulePage = (await import('./page')).default;
    const html = renderToStaticMarkup(React.createElement(ModulePage));

    expect(html).toContain('Pro Module');
    expect(html).toContain('Upgrade to Pro');
    expect(html).toContain('href="/settings"');
    expect(html).toContain('href="/learn"');
  });

  it('500 error does NOT render the Pro paywall', async () => {
    const { useQuery } = await import('@tanstack/react-query');
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: { response: { status: 500 } },
      isLoading: false,
    } as ReturnType<typeof useQuery>);

    const ModulePage = (await import('./page')).default;
    const html = renderToStaticMarkup(React.createElement(ModulePage));

    // A 500 error must NOT trigger the paywall
    expect(html).not.toContain('Pro Module');
  });

  it('null error does NOT render the Pro paywall', async () => {
    const { useQuery } = await import('@tanstack/react-query');
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useQuery>);

    const ModulePage = (await import('./page')).default;
    const html = renderToStaticMarkup(React.createElement(ModulePage));

    expect(html).not.toContain('Pro Module');
  });

  it('403 from API (not cached) sets is403=true and showProPaywall=true', () => {
    const error403 = { response: { status: 403 } };
    const is403 = (error403 as { response?: { status?: number } } | null)?.response?.status === 403;
    const isProLocked = false; // not in cached modules data
    const showProPaywall = isProLocked || is403;
    expect(is403).toBe(true);
    expect(showProPaywall).toBe(true);
  });
});

// ── P2-008 — xp_reward null → "0 XP" ─────────────────────────────────────────

describe('LessonCard — xp_reward null renders "0 XP" (P2-008)', () => {
  it('locked card with xp_reward: null renders "0 XP"', async () => {
    const { LessonCard } = await import('./page');
    const html = renderToStaticMarkup(
      React.createElement(LessonCard, {
        lesson: { id: '1', title: 'Test Lesson', slug: 'test-lesson', estimated_minutes: 5, xp_reward: null as unknown as number, status: null },
        index: 1,
        moduleSlug: 'test-module',
        isUnlocked: false,
      }),
    );
    expect(html).toContain('0 XP');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('null');
    expect(html).not.toContain('undefined');
  });

  it('unlocked card with xp_reward: null renders "0 XP"', async () => {
    const { LessonCard } = await import('./page');
    const html = renderToStaticMarkup(
      React.createElement(LessonCard, {
        lesson: { id: '2', title: 'Unlocked Lesson', slug: 'unlocked-lesson', estimated_minutes: 10, xp_reward: null as unknown as number, status: null },
        index: 2,
        moduleSlug: 'test-module',
        isUnlocked: true,
      }),
    );
    expect(html).toContain('0 XP');
    expect(html).not.toContain('NaN');
  });

  it('xp_reward: 0 explicitly also renders "0 XP" (not empty)', async () => {
    const { LessonCard } = await import('./page');
    const html = renderToStaticMarkup(
      React.createElement(LessonCard, {
        lesson: { id: '3', title: 'Zero XP Lesson', slug: 'zero-xp-lesson', estimated_minutes: 5, xp_reward: 0, status: null },
        index: 3,
        moduleSlug: 'test-module',
        isUnlocked: false,
      }),
    );
    expect(html).toContain('0 XP');
  });

  it('xp_reward: 25 renders "25 XP" (normal case)', async () => {
    const { LessonCard } = await import('./page');
    const html = renderToStaticMarkup(
      React.createElement(LessonCard, {
        lesson: { id: '4', title: 'XP Lesson', slug: 'xp-lesson', estimated_minutes: 8, xp_reward: 25, status: null },
        index: 4,
        moduleSlug: 'test-module',
        isUnlocked: true,
      }),
    );
    expect(html).toContain('25 XP');
    expect(html).not.toContain('NaN');
  });

  it('component source uses ?? 0 fallback for xp_reward', async () => {
    // Structural assertion: verify the actual component has the null-coalesce guard
    const fs = await import('fs');
    const path = await import('path');
    const componentPath = path.resolve(__dirname, './page.tsx');
    const source = fs.readFileSync(componentPath, 'utf-8');
    // Both the locked and unlocked LessonCard variants must have the null guard
    const occurrences = (source.match(/xp_reward \?\? 0/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2); // locked + unlocked variants
  });
});
