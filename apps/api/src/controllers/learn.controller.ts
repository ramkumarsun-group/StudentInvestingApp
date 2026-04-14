import { Request, Response } from 'express';
import { db } from '../config/db';
import { awardXp } from '../services/gamification/xp.service';
import { recordActivity } from '../services/gamification/streak.service';

export async function getModules(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { rows: modules } = await db.query(
    `SELECT m.*,
       COUNT(l.id) AS lesson_count,
       COUNT(CASE WHEN ulp.status='completed' THEN 1 END) AS completed_lessons,
       COALESCE(SUM(l.estimated_minutes), 0) AS total_estimated_minutes
     FROM modules m
     LEFT JOIN lessons l ON l.module_id = m.id
     LEFT JOIN user_lesson_progress ulp ON ulp.lesson_id=l.id AND ulp.user_id=$1
     WHERE m.is_published=true
     GROUP BY m.id
     ORDER BY m.sort_order`,
    [userId],
  );

  const result = modules.map((m) => ({
    ...m,
    // snake_case to match frontend — completion_pct not completionPct
    completion_pct: Number(m.lesson_count) > 0
      ? Math.round((Number(m.completed_lessons) / Number(m.lesson_count)) * 100)
      : 0,
  }));
  return res.json({ data: result });
}

export async function getModule(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { slug } = req.params;
  // P7: filter unpublished modules so drafts are not accessible by slug
  const { rows } = await db.query('SELECT * FROM modules WHERE slug=$1 AND is_published=true', [slug]);
  if (rows.length === 0) return res.status(404).json({ error: 'Module not found' });
  const mod = rows[0];

  // Pro gate — return 403 before exposing lesson list
  if (mod.requires_pro && !req.user!.isPro) {
    return res.status(403).json({ error: 'Student Pro subscription required' });
  }

  const { rows: lessons } = await db.query(
    `SELECT l.*, ulp.status, ulp.xp_earned
     FROM lessons l
     LEFT JOIN user_lesson_progress ulp ON ulp.lesson_id=l.id AND ulp.user_id=$1
     WHERE l.module_id=$2
     ORDER BY l.sort_order`,
    [userId, mod.id],
  );
  return res.json({ data: { ...mod, lessons } });
}

export async function getLesson(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { lessonId } = req.params;
  const { rows } = await db.query(
    `SELECT l.*, ulp.status, ulp.quiz_score, ulp.xp_earned, m.requires_pro
     FROM lessons l
     JOIN modules m ON m.id = l.module_id
     LEFT JOIN user_lesson_progress ulp ON ulp.lesson_id=l.id AND ulp.user_id=$1
     WHERE l.id=$2`,
    [userId, lessonId],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Lesson not found' });
  if (rows[0].requires_pro && !req.user!.isPro) {
    return res.status(403).json({ error: 'Student Pro subscription required' });
  }

  const { rows: quizzes } = await db.query(
    `SELECT id, question_text, options, xp_reward FROM quizzes WHERE lesson_id=$1`,
    [lessonId],
  );
  // Hide correct answers from response
  const sanitizedQuizzes = quizzes.map((q) => ({
    ...q,
    options: (q.options as { id: string; text: string; is_correct: boolean }[]).map((o) => ({
      id: o.id,
      text: o.text,
    })),
  }));
  return res.json({ data: { ...rows[0], quizzes: sanitizedQuizzes } });
}

export async function startLesson(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { lessonId } = req.params;
  const { rows: lesson } = await db.query(
    `SELECT l.module_id, m.requires_pro
     FROM lessons l
     JOIN modules m ON m.id = l.module_id
     WHERE l.id=$1`,
    [lessonId],
  );
  if (lesson.length === 0) return res.status(404).json({ error: 'Lesson not found' });
  if (lesson[0].requires_pro && !req.user!.isPro) {
    return res.status(403).json({ error: 'Student Pro subscription required' });
  }

  await db.query(
    // P5: WHERE guard prevents regressing a completed lesson back to in_progress
    `INSERT INTO user_lesson_progress(user_id, lesson_id, module_id, status, started_at)
     VALUES($1,$2,$3,'in_progress',NOW())
     ON CONFLICT(user_id, lesson_id) DO UPDATE
     SET status='in_progress', started_at=COALESCE(user_lesson_progress.started_at, NOW())
     WHERE user_lesson_progress.status <> 'completed'`,
    [userId, lessonId, lesson[0].module_id],
  );
  await recordActivity(userId);
  return res.json({ data: { status: 'in_progress' } });
}

export async function completeLesson(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { lessonId } = req.params;
  const { rows: lesson } = await db.query(
    `SELECT l.*, m.requires_pro
     FROM lessons l
     JOIN modules m ON m.id = l.module_id
     WHERE l.id=$1`,
    [lessonId],
  );
  if (lesson.length === 0) return res.status(404).json({ error: 'Lesson not found' });
  if (lesson[0].requires_pro && !req.user!.isPro) {
    return res.status(403).json({ error: 'Student Pro subscription required' });
  }

  // P1: atomic check-and-update — if status is already 'completed' the WHERE clause makes the
  // upsert a no-op and returns no rows, preventing a TOCTOU double-XP race.
  const { rows: updated } = await db.query(
    `INSERT INTO user_lesson_progress(user_id, lesson_id, module_id, status, xp_earned, started_at, completed_at)
     VALUES($1,$2,$3,'completed',$4,NOW(),NOW())
     ON CONFLICT(user_id, lesson_id) DO UPDATE
     SET status='completed', xp_earned=$4, completed_at=NOW()
     WHERE user_lesson_progress.status <> 'completed'
     RETURNING status`,
    [userId, lessonId, lesson[0].module_id, lesson[0].xp_reward],
  );

  if (updated.length === 0) {
    // P7: return actual current level so the frontend leveledUp check works correctly
    const { rows: xpRows } = await db.query('SELECT current_level FROM user_xp WHERE user_id=$1', [userId]);
    const currentLevel = xpRows[0]?.current_level ?? 1;
    return res.json({ data: { alreadyCompleted: true, xpEarned: 0, leveledUp: false, newLevel: currentLevel } });
  }

  const result = await awardXp(userId, 'lesson_complete', lesson[0].xp_reward, lessonId);
  await recordActivity(userId);

  return res.json({ data: { xpEarned: lesson[0].xp_reward, ...result } });
}

export async function submitQuiz(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { quizId } = req.params;
  const { optionId } = req.body;

  // P6: validate optionId presence and type before using it
  if (!optionId || typeof optionId !== 'string') {
    return res.status(400).json({ error: 'optionId is required' });
  }

  const { rows } = await db.query('SELECT * FROM quizzes WHERE id=$1', [quizId]);
  if (rows.length === 0) return res.status(404).json({ error: 'Quiz not found' });

  const quiz = rows[0];

  // Need lesson's module_id to upsert progress record
  const { rows: lessonRows } = await db.query('SELECT module_id FROM lessons WHERE id=$1', [quiz.lesson_id]);
  if (lessonRows.length === 0) return res.status(404).json({ error: 'Lesson not found' });

  const correct = (quiz.options as { id: string; is_correct: boolean }[]).find(
    (o) => o.id === optionId && o.is_correct,
  );
  const score = correct ? 100 : 0;

  // P2+P3: atomically record quiz_score — WHERE quiz_score IS NULL makes this a no-op if already
  // answered, preventing XP replay. RETURNING tells us whether we were the first submission.
  const { rows: updated } = await db.query(
    `INSERT INTO user_lesson_progress(user_id, lesson_id, module_id, status, quiz_score)
     VALUES($1,$2,$3,'in_progress',$4)
     ON CONFLICT(user_id, lesson_id) DO UPDATE
     SET quiz_score=$4
     WHERE user_lesson_progress.quiz_score IS NULL
     RETURNING quiz_score`,
    [userId, quiz.lesson_id, lessonRows[0].module_id, score],
  );

  if (updated.length === 0) {
    // Already answered — do not award XP again.
    // Re-query stored quiz_score so frontend can restore correct/wrong state on retry.
    const { rows: prevRows } = await db.query(
      'SELECT quiz_score FROM user_lesson_progress WHERE user_id=$1 AND lesson_id=$2',
      [userId, quiz.lesson_id],
    );
    const wasCorrect = prevRows[0]?.quiz_score === 100;
    return res.json({ data: { alreadyAnswered: true, xpEarned: 0, explanation: quiz.explanation, correct: wasCorrect } });
  }

  // P4: fetch actual current level so wrong-answer response returns real level, not hardcoded 1
  const { rows: xpRows } = await db.query('SELECT current_level FROM user_xp WHERE user_id=$1', [userId]);
  const currentLevel = xpRows[0]?.current_level ?? 1;
  let leveledUp = false;
  let newLevel = currentLevel;
  if (correct) {
    const xpResult = await awardXp(userId, 'quiz_correct', quiz.xp_reward, quizId);
    leveledUp = xpResult.leveledUp;
    newLevel = xpResult.newLevel;
  }

  return res.json({
    data: {
      correct: !!correct,
      explanation: quiz.explanation,
      xpEarned: correct ? quiz.xp_reward : 0,
      leveledUp,
      newLevel,
    },
  });
}

export async function getProgress(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { rows } = await db.query(
    `SELECT m.id, m.slug, m.title,
       COUNT(l.id) AS lesson_count,
       COUNT(CASE WHEN ulp.status='completed' THEN 1 END) AS completed_lessons
     FROM modules m
     LEFT JOIN lessons l ON l.module_id=m.id
     LEFT JOIN user_lesson_progress ulp ON ulp.lesson_id=l.id AND ulp.user_id=$1
     WHERE m.is_published=true
     GROUP BY m.id
     ORDER BY m.sort_order`,
    [userId],
  );
  // P4: cast pg aggregate strings to numbers so consumers can do arithmetic safely
  return res.json({
    data: rows.map((r) => ({
      ...r,
      lesson_count: Number(r.lesson_count),
      completed_lessons: Number(r.completed_lessons),
    })),
  });
}
