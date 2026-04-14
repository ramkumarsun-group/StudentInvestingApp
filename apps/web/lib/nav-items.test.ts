import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from './nav-items';

describe('NAV_ITEMS', () => {
  it('includes /badges entry', () => {
    const item = NAV_ITEMS.find((n) => n.href === '/badges');
    expect(item).toBeDefined();
    expect(item?.label).toBe('Badges');
  });

  it('badges appears after /learn and before /leaderboard', () => {
    const hrefs = NAV_ITEMS.map((n) => n.href);
    const learnIdx = hrefs.indexOf('/learn');
    const badgesIdx = hrefs.indexOf('/badges');
    const leaderboardIdx = hrefs.indexOf('/leaderboard');
    expect(badgesIdx).toBeGreaterThan(learnIdx);
    expect(badgesIdx).toBeLessThan(leaderboardIdx);
  });

  it('contains all 6 expected nav items', () => {
    expect(NAV_ITEMS).toHaveLength(6);
  });
});
