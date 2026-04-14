import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/db', () => ({
  db: { query: vi.fn() },
}));

vi.mock('./xp.service', () => ({
  awardXp: vi.fn().mockResolvedValue({ totalXp: 100, newLevel: 1, leveledUp: false }),
}));

// Mock dayjs — avoids package resolution failure in worktree.
// IMPORTANT: parse date strings in LOCAL time (not UTC) to match real dayjs behaviour.
// `new Date('YYYY-MM-DD')` parses as UTC midnight and breaks date comparisons in non-UTC zones.
vi.mock('dayjs', () => {
  function toYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function parseLocal(dateStr: string): Date {
    // Parse 'YYYY-MM-DD' in local time by using the Date(y,m,d) constructor
    const [y, mo, d] = dateStr.split('-').map(Number);
    return new Date(y, mo - 1, d);
  }

  function makeDayjs(d: Date) {
    return {
      format(fmt: string) {
        return fmt === 'YYYY-MM-DD' ? toYMD(d) : d.toISOString();
      },
      subtract(n: number, unit: string) {
        const next = new Date(d);
        if (unit === 'day') next.setDate(next.getDate() - n);
        return makeDayjs(next);
      },
    };
  }

  const dayjsFn = (dateStr?: string) =>
    makeDayjs(dateStr ? parseLocal(dateStr) : new Date());
  dayjsFn.extend = () => {};
  return { default: dayjsFn };
});

import { db } from '../../config/db';
import { awardXp } from './xp.service';
import { recordActivity, resetMissedStreaks } from './streak.service';

const mockDb = vi.mocked(db);

// Native helper to get YYYY-MM-DD relative to today
function dateStr(daysOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TODAY = dateStr(0);
const YESTERDAY = dateStr(-1);
const TWO_DAYS_AGO = dateStr(-2);

describe('recordActivity()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates new streak row on first activity — returns streak 1 (AC1)', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [] } as never)  // SELECT — no row
      .mockResolvedValueOnce({ rows: [] } as never); // INSERT

    const result = await recordActivity('user-1');

    expect(result).toEqual({ currentStreak: 1, longestStreak: 1 });
    expect(mockDb.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO streaks'),
      expect.arrayContaining(['user-1']),
    );
    expect(awardXp).not.toHaveBeenCalled();
  });

  it('returns unchanged streak when last activity was today (AC5 — no double-increment)', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{ current_streak: 3, longest_streak: 5, last_activity_date: TODAY }],
    } as never);

    const result = await recordActivity('user-1');

    expect(result).toEqual({ currentStreak: 3, longestStreak: 5 });
    expect(mockDb.query).toHaveBeenCalledTimes(1);
    expect(awardXp).not.toHaveBeenCalled();
  });

  it('increments streak when last activity was yesterday (AC1)', async () => {
    // Start at 1 → 2 so we don't hit the 3-day milestone branch
    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ current_streak: 1, longest_streak: 5, last_activity_date: YESTERDAY }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never); // UPDATE

    const result = await recordActivity('user-1');

    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(5);
    expect(awardXp).toHaveBeenCalledWith('user-1', 'daily_activity', 5);
  });

  it('resets streak to 1 when last activity was 2+ days ago (AC2 partial)', async () => {
    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ current_streak: 7, longest_streak: 10, last_activity_date: TWO_DAYS_AGO }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await recordActivity('user-1');

    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(10);
    expect(awardXp).toHaveBeenCalledWith('user-1', 'daily_activity', 5);
  });

  it('awards milestone XP at 7-day streak (AC4)', async () => {
    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ current_streak: 6, longest_streak: 6, last_activity_date: YESTERDAY }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await recordActivity('user-1');

    expect(awardXp).toHaveBeenCalledWith('user-1', 'streak_7', 70);
  });

  it('updates longest_streak when current streak exceeds previous best', async () => {
    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ current_streak: 5, longest_streak: 5, last_activity_date: YESTERDAY }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await recordActivity('user-1');

    expect(result.currentStreak).toBe(6);
    expect(result.longestStreak).toBe(6);
  });
});

describe('resetMissedStreaks()', () => {
  it('issues UPDATE to zero out stale streaks, passing yesterday date (AC2)', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

    await resetMissedStreaks();

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE streaks'),
      expect.arrayContaining([YESTERDAY]),
    );
  });
});
