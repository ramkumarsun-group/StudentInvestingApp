import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createBadgeNotifier } from './use-badge-notifier';

describe('createBadgeNotifier()', () => {
  let qc: QueryClient;
  let onNewBadge: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    onNewBadge = vi.fn();
  });

  it('fires callback when a new badge appears as earned', () => {
    createBadgeNotifier(qc, onNewBadge);

    qc.setQueryData(['badges'], {
      data: [{ id: 'b1', name: 'First Trade', earned_at: '2026-04-09T00:00:00Z' }],
    });

    expect(onNewBadge).toHaveBeenCalledWith('First Trade');
  });

  it('does not fire callback for already-known earned badges (no duplicate on re-fetch)', () => {
    createBadgeNotifier(qc, onNewBadge);

    qc.setQueryData(['badges'], {
      data: [{ id: 'b1', name: 'First Trade', earned_at: '2026-04-09T00:00:00Z' }],
    });
    // Simulate a re-fetch returning the same data
    qc.setQueryData(['badges'], {
      data: [{ id: 'b1', name: 'First Trade', earned_at: '2026-04-09T00:00:00Z' }],
    });

    expect(onNewBadge).toHaveBeenCalledTimes(1);
  });

  it('does not fire callback for unearned badges (earned_at: null)', () => {
    createBadgeNotifier(qc, onNewBadge);

    qc.setQueryData(['badges'], {
      data: [{ id: 'b1', name: 'First Trade', earned_at: null }],
    });

    expect(onNewBadge).not.toHaveBeenCalled();
  });

  it('seeds from existing cache on create — does not notify pre-session badges', () => {
    // Pre-populate cache before notifier is created
    qc.setQueryData(['badges'], {
      data: [{ id: 'b1', name: 'Old Badge', earned_at: '2026-01-01T00:00:00Z' }],
    });

    createBadgeNotifier(qc, onNewBadge);

    // Re-set same data (as if a refetch returned the same result)
    qc.setQueryData(['badges'], {
      data: [{ id: 'b1', name: 'Old Badge', earned_at: '2026-01-01T00:00:00Z' }],
    });

    expect(onNewBadge).not.toHaveBeenCalled();
  });

  it('fires callback for each newly unlocked badge when multiple arrive at once', () => {
    createBadgeNotifier(qc, onNewBadge);

    qc.setQueryData(['badges'], {
      data: [
        { id: 'b1', name: 'First Trade', earned_at: '2026-04-09T00:00:00Z' },
        { id: 'b2', name: 'Streak 7',    earned_at: '2026-04-09T00:00:00Z' },
        { id: 'b3', name: 'Locked',      earned_at: null },
      ],
    });

    expect(onNewBadge).toHaveBeenCalledTimes(2);
    expect(onNewBadge).toHaveBeenCalledWith('First Trade');
    expect(onNewBadge).toHaveBeenCalledWith('Streak 7');
  });

  it('unsubscribes cleanly — no more callbacks after unsubscribe', () => {
    const unsubscribe = createBadgeNotifier(qc, onNewBadge);
    unsubscribe();

    qc.setQueryData(['badges'], {
      data: [{ id: 'b1', name: 'First Trade', earned_at: '2026-04-09T00:00:00Z' }],
    });

    expect(onNewBadge).not.toHaveBeenCalled();
  });
});
