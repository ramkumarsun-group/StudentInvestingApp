import { db } from '../../config/db';
import { awardXp } from './xp.service';
import dayjs from 'dayjs';

export async function recordActivity(userId: string) {
  const today = dayjs().format('YYYY-MM-DD');

  const { rows } = await db.query(
    'SELECT current_streak, longest_streak, last_activity_date FROM streaks WHERE user_id=$1',
    [userId],
  );

  if (rows.length === 0) {
    await db.query(
      'INSERT INTO streaks(user_id, current_streak, longest_streak, last_activity_date) VALUES($1,1,1,$2)',
      [userId, today],
    );
    return { currentStreak: 1, longestStreak: 1 };
  }

  const { current_streak, longest_streak, last_activity_date } = rows[0];
  const last = last_activity_date ? dayjs(last_activity_date).format('YYYY-MM-DD') : null;

  if (last === today) return { currentStreak: current_streak, longestStreak: longest_streak };

  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  const newStreak = last === yesterday ? current_streak + 1 : 1;
  const newLongest = Math.max(newStreak, longest_streak);

  await db.query(
    `UPDATE streaks SET current_streak=$1, longest_streak=$2, last_activity_date=$3, updated_at=NOW()
     WHERE user_id=$4`,
    [newStreak, newLongest, today, userId],
  );

  // Award streak XP milestones
  if ([3, 7, 14, 30, 60, 100].includes(newStreak)) {
    await awardXp(userId, `streak_${newStreak}`, newStreak * 10);
  } else {
    await awardXp(userId, 'daily_activity', 5);
  }

  return { currentStreak: newStreak, longestStreak: newLongest };
}

export async function resetMissedStreaks() {
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  await db.query(
    `UPDATE streaks SET current_streak=0, updated_at=NOW()
     WHERE last_activity_date < $1 AND current_streak > 0`,
    [yesterday],
  );
}
