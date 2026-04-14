import { Request, Response } from 'express';
import { db } from '../config/db';
import { redis } from '../config/redis';

const LEADERBOARD_KEY = 'leaderboard:global';

export async function getGlobalLeaderboard(_req: Request, res: Response) {
  // Try Redis sorted set first (score = return_pct * 100 to avoid float issues)
  const members = await redis.zrevrange(LEADERBOARD_KEY, 0, 99, 'WITHSCORES');
  if (members.length > 0) {
    const entries = [];
    for (let i = 0; i < members.length; i += 2) {
      const userId = members[i];
      const score = parseFloat(members[i + 1]) / 100;
      entries.push({ userId, returnPct: score, rank: Math.floor(i / 2) + 1 });
    }
    // Enrich with user data
    const enriched = await Promise.all(
      entries.map(async (e) => {
        const { rows } = await db.query(
          `SELECT u.username, u.avatar_url, ux.current_level, l.name AS level_name, p.total_value
           FROM users u
           JOIN user_xp ux ON ux.user_id=u.id
           JOIN levels l ON l.id=ux.current_level
           JOIN portfolios p ON p.user_id=u.id AND p.is_active=true
           WHERE u.id=$1`,
          [e.userId],
        );
        return rows.length ? { ...e, ...rows[0] } : e;
      }),
    );
    return res.json({ data: enriched });
  }

  // Fallback to DB
  const { rows } = await db.query(
    `SELECT u.id AS user_id, u.username, u.avatar_url, ux.current_level,
       l.name AS level_name, p.total_value, p.total_return_pct AS return_pct,
       ROW_NUMBER() OVER (ORDER BY p.total_return_pct DESC) AS rank
     FROM users u
     JOIN portfolios p ON p.user_id=u.id AND p.is_active=true
     JOIN user_xp ux ON ux.user_id=u.id
     JOIN levels l ON l.id=ux.current_level
     ORDER BY p.total_return_pct DESC
     LIMIT 100`,
  );
  return res.json({ data: rows });
}

export async function getMyRank(req: Request, res: Response) {
  const userId = req.user!.userId;
  const rank = await redis.zrevrank(LEADERBOARD_KEY, userId);
  const score = await redis.zscore(LEADERBOARD_KEY, userId);

  if (rank !== null) {
    return res.json({ data: { rank: rank + 1, returnPct: score ? parseFloat(score) / 100 : 0 } });
  }

  const { rows } = await db.query(
    `SELECT COUNT(*) + 1 AS rank FROM portfolios
     WHERE total_return_pct > (SELECT total_return_pct FROM portfolios WHERE user_id=$1 AND is_active=true)
     AND is_active=true`,
    [userId],
  );
  return res.json({ data: { rank: parseInt(rows[0].rank), returnPct: 0 } });
}

export async function refreshLeaderboard() {
  const { rows } = await db.query(
    'SELECT user_id, total_return_pct FROM portfolios WHERE is_active=true',
  );
  const pipeline = redis.pipeline();
  pipeline.del(LEADERBOARD_KEY);
  for (const row of rows) {
    pipeline.zadd(LEADERBOARD_KEY, parseFloat(row.total_return_pct) * 100, row.user_id);
  }
  await pipeline.exec();
}
