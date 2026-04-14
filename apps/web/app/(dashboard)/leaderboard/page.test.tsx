import { describe, it, expect } from 'vitest';

// Pure helper extracted from leaderboard/page.tsx for testability
function rankEmoji(rank: number): string | null {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

describe('rankEmoji()', () => {
  it('returns gold medal for rank 1', () => {
    expect(rankEmoji(1)).toBe('🥇');
  });

  it('returns silver medal for rank 2', () => {
    expect(rankEmoji(2)).toBe('🥈');
  });

  it('returns bronze medal for rank 3', () => {
    expect(rankEmoji(3)).toBe('🥉');
  });

  it('returns null for rank 4 and beyond', () => {
    expect(rankEmoji(4)).toBeNull();
    expect(rankEmoji(100)).toBeNull();
  });

  it('returns null for rank 0 (edge case)', () => {
    expect(rankEmoji(0)).toBeNull();
  });
});
