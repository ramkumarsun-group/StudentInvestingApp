import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../config/db';
import { recordActivity } from '../services/gamification/streak.service';
import { awardXp } from '../services/gamification/xp.service';

const xpAwardSchema = z.object({
  event_type: z.string().min(1).max(40),
  xp_amount: z.number().int().positive(),
  reference_id: z.string().uuid().optional(),
});

export async function getXp(req: Request, res: Response) {
  const { rows } = await db.query(
    `SELECT ux.total_xp, ux.current_level, ux.xp_to_next_level, l.name AS level_name, l.badge_color
     FROM user_xp ux JOIN levels l ON l.id=ux.current_level
     WHERE ux.user_id=$1`,
    [req.user!.userId],
  );
  return res.json({ data: rows[0] ?? { total_xp: 0, current_level: 1, xp_to_next_level: 500, level_name: 'Rookie' } });
}

export async function getBadges(req: Request, res: Response) {
  const { rows } = await db.query(
    `SELECT b.*, ub.earned_at
     FROM badges b
     LEFT JOIN user_badges ub ON ub.badge_id=b.id AND ub.user_id=$1
     ORDER BY b.category, b.rarity`,
    [req.user!.userId],
  );
  return res.json({ data: rows });
}

export async function getStreak(req: Request, res: Response) {
  const { rows } = await db.query(
    'SELECT current_streak, longest_streak, last_activity_date FROM streaks WHERE user_id=$1',
    [req.user!.userId],
  );
  return res.json({ data: rows[0] ?? { current_streak: 0, longest_streak: 0 } });
}

export async function recordActivityEndpoint(req: Request, res: Response) {
  const result = await recordActivity(req.user!.userId);
  return res.json({ data: result });
}

/**
 * POST /gamification/xp/award
 * Awards XP with optional idempotency key (reference_id).
 * Returns 409 if the same reference_id has already been awarded for this user+event_type.
 */
export async function awardXpEndpoint(req: Request, res: Response) {
  const body = xpAwardSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten().fieldErrors });

  try {
    const result = await awardXp(
      req.user!.userId,
      body.data.event_type,
      body.data.xp_amount,
      body.data.reference_id,
    );
    return res.status(201).json({ data: result });
  } catch (err) {
    const typedErr = err as Error & { code?: string };
    if (typedErr.code === 'XP_DUPLICATE') {
      return res.status(409).json({ error: 'XP event already recorded for this reference_id' });
    }
    throw err;
  }
}

export async function getXpLog(req: Request, res: Response) {
  const { rows } = await db.query(
    `SELECT event_type, xp_amount, created_at
     FROM xp_events WHERE user_id=$1
     ORDER BY created_at DESC LIMIT 50`,
    [req.user!.userId],
  );
  return res.json({ data: rows });
}
