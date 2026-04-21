import { db } from '../../config/db';
import { LEVELS } from '@student-investing/shared-types';
import { checkAndUnlockBadges } from './badge.service';

export async function awardXp(
  userId: string,
  eventType: string,
  xpAmount: number,
  referenceId?: string,
) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Record XP event
    await client.query(
      'INSERT INTO xp_events(user_id, event_type, xp_amount, reference_id) VALUES($1,$2,$3,$4)',
      [userId, eventType, xpAmount, referenceId || null],
    );

    // Update total XP
    await client.query(
      `INSERT INTO user_xp(user_id, total_xp) VALUES($1,$2)
       ON CONFLICT(user_id) DO UPDATE SET total_xp=user_xp.total_xp+$2, updated_at=NOW()`,
      [userId, xpAmount],
    );

    // Check level up
    const xpRes = await client.query('SELECT total_xp, current_level FROM user_xp WHERE user_id=$1', [userId]);
    const { total_xp: totalXp, current_level: currentLevel } = xpRes.rows[0];

    let newLevel = currentLevel;
    for (const level of LEVELS.slice().reverse()) {
      if (totalXp >= level.minXp) {
        newLevel = level.id;
        break;
      }
    }

    const nextLevel = LEVELS.find((l) => l.id === newLevel + 1);
    const xpToNext = nextLevel ? nextLevel.minXp - totalXp : 0;

    if (newLevel !== currentLevel) {
      await client.query(
        'UPDATE user_xp SET current_level=$1, xp_to_next_level=$2, updated_at=NOW() WHERE user_id=$3',
        [newLevel, xpToNext, userId],
      );
      // Award level-up XP bonus
      await client.query(
        'INSERT INTO xp_events(user_id, event_type, xp_amount) VALUES($1,$2,$3)',
        [userId, 'level_up', newLevel * 50],
      );
    } else {
      await client.query(
        'UPDATE user_xp SET xp_to_next_level=$1, updated_at=NOW() WHERE user_id=$2',
        [xpToNext, userId],
      );
    }

    await client.query('COMMIT');

    // Check badge unlocks after commit
    await checkAndUnlockBadges(userId);

    return { totalXp, newLevel, leveledUp: newLevel !== currentLevel };
  } catch (err) {
    await client.query('ROLLBACK');
    // Surface idempotency violation as a typed error so controllers can return 409
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      const idempotencyError = new Error('XP event already recorded for this reference_id');
      (idempotencyError as Error & { code: string }).code = 'XP_DUPLICATE';
      throw idempotencyError;
    }
    throw err;
  } finally {
    client.release();
  }
}
