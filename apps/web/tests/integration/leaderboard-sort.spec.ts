import { test, expect } from '@playwright/test';
import { createStudent } from '../fixtures/factories';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * P1-002 — Leaderboard sorted correctly by portfolio value.
 * @P1 @Integration
 *
 * Seeds 3 students with portfolio values $120k, $95k, $105k.
 * Verifies the leaderboard DB-fallback path returns them in descending order
 * with strictly ordered rank numbers (P1-002-A).
 */
test(
  '@P1 @Integration leaderboard returns students in descending portfolio value order',
  async ({ request }) => {
    const students = [
      { ...createStudent(), portfolioValue: 120_000 }, // rank 1
      { ...createStudent(), portfolioValue: 95_000 },  // rank 3
      { ...createStudent(), portfolioValue: 105_000 }, // rank 2
    ];

    const seedRes = await request.post(`${API_BASE}/test/seed`, {
      data: { users: students },
    });
    expect(seedRes.status()).toBe(201);
    const { seeded } = await seedRes.json();

    // Login as first student to get a token (leaderboard is public but may need auth)
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: { email: students[0].email, password: students[0].password },
    });
    expect(loginRes.status()).toBe(200);

    try {
      // Fetch the global leaderboard (DB fallback — Redis sorted set may not include test users)
      const lbRes = await request.get(`${API_BASE}/leaderboard/global`);
      expect(lbRes.status()).toBe(200);
      const { data } = await lbRes.json();
      expect(Array.isArray(data)).toBe(true);

      type LbEntry = { user_id?: string; userId?: string; total_value?: number; rank?: number };

      // Locate each seeded student's index position in the global leaderboard
      const ids120 = seeded
        .filter((_: unknown, idx: number) => students[idx]?.portfolioValue === 120_000)
        .map((s: { userId: string }) => s.userId);
      const ids105 = seeded
        .filter((_: unknown, idx: number) => students[idx]?.portfolioValue === 105_000)
        .map((s: { userId: string }) => s.userId);
      const ids95 = seeded
        .filter((_: unknown, idx: number) => students[idx]?.portfolioValue === 95_000)
        .map((s: { userId: string }) => s.userId);

      const indexOf = (ids: string[]): number =>
        data.findIndex((e: LbEntry) => ids.includes(e.user_id ?? e.userId ?? ''));

      const rank120 = indexOf(ids120);
      const rank105 = indexOf(ids105);
      const rank95  = indexOf(ids95);

      // P1-002-A: all three students must appear in the leaderboard
      expect(rank120).toBeGreaterThanOrEqual(0);
      expect(rank105).toBeGreaterThanOrEqual(0);
      expect(rank95).toBeGreaterThanOrEqual(0);

      // P1-002-A: $120k must rank above $105k (lower index = better rank)
      expect(rank120).toBeLessThan(rank105);
      // P1-002-A: $105k must rank above $95k
      expect(rank105).toBeLessThan(rank95);

      // P1-002-A: verify descending order across all test entries (contiguous subset)
      const testEntries = [rank120, rank105, rank95]
        .sort((a, b) => a - b)
        .map((idx) => data[idx] as LbEntry);
      for (let i = 0; i < testEntries.length - 1; i++) {
        const currentValue = testEntries[i].total_value ?? 0;
        const nextValue = testEntries[i + 1].total_value ?? 0;
        expect(currentValue).toBeGreaterThanOrEqual(nextValue);
      }
    } finally {
      for (const student of students) {
        await request.delete(`${API_BASE}/test/teardown`, {
          data: { email: student.email },
        });
      }
    }
  },
);

/**
 * P1-002-B — Leaderboard is stable when two users have identical portfolio values.
 * @P1 @Integration
 *
 * Seeds 2 students with the same portfolio value ($110k).
 * Fetches the leaderboard twice and verifies:
 * - No 500 error (tie-breaking logic doesn't crash)
 * - Both entries appear in both responses
 * - The ordering of the two entries is consistent across both calls (stable sort)
 */
test(
  '@P1 @Integration leaderboard handles tied portfolio values stably (no 500, both entries appear)',
  async ({ request }) => {
    const tiedStudents = [
      { ...createStudent(), portfolioValue: 110_000 },
      { ...createStudent(), portfolioValue: 110_000 },
    ];

    const seedRes = await request.post(`${API_BASE}/test/seed`, {
      data: { users: tiedStudents },
    });
    expect(seedRes.status()).toBe(201);
    const { seeded } = await seedRes.json();
    const tiedIds: string[] = seeded.map((s: { userId: string }) => s.userId);

    try {
      type LbEntry = { user_id?: string; userId?: string };

      const fetchLeaderboard = async (): Promise<LbEntry[]> => {
        const res = await request.get(`${API_BASE}/leaderboard/global`);
        expect(res.status()).toBe(200); // must not 500 on tie
        const { data } = await res.json();
        expect(Array.isArray(data)).toBe(true);
        return data as LbEntry[];
      };

      const data1 = await fetchLeaderboard();
      const data2 = await fetchLeaderboard();

      // Both entries must appear in each response
      const entry1InCall1 = data1.findIndex((e) => tiedIds.includes(e.user_id ?? e.userId ?? ''));
      const entry2InCall1 = data1.findLastIndex((e) => tiedIds.includes(e.user_id ?? e.userId ?? ''));
      expect(entry1InCall1).toBeGreaterThanOrEqual(0);
      expect(entry2InCall1).toBeGreaterThanOrEqual(0);
      expect(entry1InCall1).not.toBe(entry2InCall1); // two distinct positions

      // Ordering must be consistent across two calls (stable sort)
      const orderCall1 = data1
        .filter((e) => tiedIds.includes(e.user_id ?? e.userId ?? ''))
        .map((e) => e.user_id ?? e.userId);
      const orderCall2 = data2
        .filter((e) => tiedIds.includes(e.user_id ?? e.userId ?? ''))
        .map((e) => e.user_id ?? e.userId);
      expect(orderCall1).toEqual(orderCall2);
    } finally {
      for (const student of tiedStudents) {
        await request.delete(`${API_BASE}/test/teardown`, {
          data: { email: student.email },
        });
      }
    }
  },
);
