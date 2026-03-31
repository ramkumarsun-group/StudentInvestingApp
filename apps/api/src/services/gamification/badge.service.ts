import { db } from '../../config/db';
import { awardXp } from './xp.service';

interface BadgeCriteria {
  type: string;
  threshold?: number;
  eventType?: string;
}

export async function checkAndUnlockBadges(userId: string) {
  // Get all unearned badges
  const { rows: unearnedBadges } = await db.query(
    `SELECT b.* FROM badges b
     WHERE b.id NOT IN (
       SELECT badge_id FROM user_badges WHERE user_id=$1
     )`,
    [userId],
  );

  for (const badge of unearnedBadges) {
    const criteria = badge.criteria_json as BadgeCriteria;
    const earned = await evaluateCriteria(userId, criteria);
    if (earned) {
      await db.query(
        'INSERT INTO user_badges(user_id, badge_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [userId, badge.id],
      );
      await awardXp(userId, 'badge_earned', badge.xp_reward, badge.id);
    }
  }
}

async function evaluateCriteria(userId: string, criteria: BadgeCriteria): Promise<boolean> {
  switch (criteria.type) {
    case 'trade_count': {
      const { rows } = await db.query(
        `SELECT COUNT(*) FROM orders o JOIN portfolios p ON p.id=o.portfolio_id
         WHERE p.user_id=$1 AND o.status='filled'`,
        [userId],
      );
      return parseInt(rows[0].count) >= (criteria.threshold ?? 1);
    }
    case 'portfolio_return': {
      const { rows } = await db.query(
        'SELECT total_return_pct FROM portfolios WHERE user_id=$1 AND is_active=true',
        [userId],
      );
      return rows[0] && parseFloat(rows[0].total_return_pct) >= (criteria.threshold ?? 10);
    }
    case 'lesson_count': {
      const { rows } = await db.query(
        `SELECT COUNT(*) FROM user_lesson_progress WHERE user_id=$1 AND status='completed'`,
        [userId],
      );
      return parseInt(rows[0].count) >= (criteria.threshold ?? 1);
    }
    case 'module_complete': {
      const { rows } = await db.query(
        `SELECT COUNT(DISTINCT module_id) FROM user_lesson_progress WHERE user_id=$1 AND status='completed'`,
        [userId],
      );
      return parseInt(rows[0].count) >= (criteria.threshold ?? 1);
    }
    case 'streak': {
      const { rows } = await db.query(
        'SELECT current_streak FROM streaks WHERE user_id=$1',
        [userId],
      );
      return rows[0] && parseInt(rows[0].current_streak) >= (criteria.threshold ?? 7);
    }
    case 'xp_total': {
      const { rows } = await db.query(
        'SELECT total_xp FROM user_xp WHERE user_id=$1',
        [userId],
      );
      return rows[0] && parseInt(rows[0].total_xp) >= (criteria.threshold ?? 1000);
    }
    case 'asset_type_trade': {
      const { rows } = await db.query(
        `SELECT COUNT(DISTINCT symbol) FROM orders o JOIN portfolios p ON p.id=o.portfolio_id
         WHERE p.user_id=$1 AND o.asset_type=$2 AND o.status='filled'`,
        [userId, criteria.eventType],
      );
      return parseInt(rows[0].count) >= (criteria.threshold ?? 1);
    }
    default:
      return false;
  }
}
