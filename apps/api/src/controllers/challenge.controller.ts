import { Request, Response } from 'express';
import { db } from '../config/db';

export async function getChallenges(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { rows } = await db.query(
    `SELECT c.*,
       cp.is_completed, cp.current_value, cp.rank AS my_rank,
       COUNT(cp2.id) AS participant_count
     FROM challenges c
     LEFT JOIN challenge_participants cp ON cp.challenge_id=c.id AND cp.user_id=$1
     LEFT JOIN challenge_participants cp2 ON cp2.challenge_id=c.id
     WHERE c.status='active' AND (c.class_id IS NULL OR c.class_id IN (
       SELECT class_id FROM class_enrollments WHERE student_id=$1
     ))
     GROUP BY c.id, cp.is_completed, cp.current_value, cp.rank
     ORDER BY c.ends_at ASC`,
    [userId],
  );
  return res.json({ data: rows });
}

export async function joinChallenge(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;

  const { rows: ch } = await db.query('SELECT * FROM challenges WHERE id=$1 AND status=$2', [id, 'active']);
  if (ch.length === 0) return res.status(404).json({ error: 'Challenge not found or not active' });

  await db.query(
    'INSERT INTO challenge_participants(challenge_id, user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [id, userId],
  );
  return res.status(201).json({ data: { joined: true } });
}

export async function getChallengeDetail(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;

  const { rows: ch } = await db.query('SELECT * FROM challenges WHERE id=$1', [id]);
  if (ch.length === 0) return res.status(404).json({ error: 'Challenge not found' });

  const { rows: participants } = await db.query(
    `SELECT u.username, u.avatar_url, cp.current_value, cp.rank, cp.is_completed
     FROM challenge_participants cp
     JOIN users u ON u.id=cp.user_id
     WHERE cp.challenge_id=$1
     ORDER BY cp.rank ASC NULLS LAST
     LIMIT 50`,
    [id],
  );

  const { rows: me } = await db.query(
    'SELECT * FROM challenge_participants WHERE challenge_id=$1 AND user_id=$2',
    [id, userId],
  );

  return res.json({ data: { ...ch[0], participants, myProgress: me[0] ?? null } });
}

export async function createChallenge(req: Request, res: Response) {
  const { classId, title, description, challengeType, targetValue, xpReward, startsAt, endsAt } = req.body;
  const { rows } = await db.query(
    `INSERT INTO challenges(class_id, created_by, title, description, challenge_type, target_value, xp_reward, starts_at, ends_at, status)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'scheduled') RETURNING *`,
    [classId || null, req.user!.userId, title, description, challengeType, targetValue, xpReward || 200, startsAt, endsAt],
  );
  return res.status(201).json({ data: rows[0] });
}
