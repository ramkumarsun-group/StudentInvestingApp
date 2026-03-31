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
  const { rows } = await db.query('SELECT * FROM modules WHERE slug=$1', [slug]);
  if (rows.length === 0) return res.status(404).json({ error: 'Module not found' });
  const mod = rows[0];

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
    `SELECT l.*, ulp.status, ulp.quiz_score, ulp.xp_earned
     FROM lessons l
     LEFT JOIN user_lesson_progress ulp ON ulp.lesson_id=l.id AND ulp.user_id=$1
     WHERE l.id=$2`,
    [userId, lessonId],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Lesson not found' });

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
  const { rows: lesson } = await db.query('SELECT module_id FROM lessons WHERE id=$1', [lessonId]);
  if (lesson.length === 0) return res.status(404).json({ error: 'Lesson not found' });

  await db.query(
    `INSERT INTO user_lesson_progress(user_id, lesson_id, module_id, status, started_at)
     VALUES($1,$2,$3,'in_progress',NOW())
     ON CONFLICT(user_id, lesson_id) DO UPDATE SET status='in_progress', started_at=COALESCE(user_lesson_progress.started_at, NOW())`,
    [userId, lessonId, lesson[0].module_id],
  );
  await recordActivity(userId);
  return res.json({ data: { status: 'in_progress' } });
}

export async function completeLesson(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { lessonId } = req.params;
  const { rows: lesson } = await db.query('SELECT * FROM lessons WHERE id=$1', [lessonId]);
  if (lesson.length === 0) return res.status(404).json({ error: 'Lesson not found' });

  const existing = await db.query(
    `SELECT status FROM user_lesson_progress WHERE user_id=$1 AND lesson_id=$2`,
    [userId, lessonId],
  );
  if (existing.rows[0]?.status === 'completed') {
    return res.json({ data: { alreadyCompleted: true, xpEarned: 0 } });
  }

  await db.query(
    `INSERT INTO user_lesson_progress(user_id, lesson_id, module_id, status, xp_earned, started_at, completed_at)
     VALUES($1,$2,$3,'completed',$4,NOW(),NOW())
     ON CONFLICT(user_id, lesson_id) DO UPDATE
     SET status='completed', xp_earned=$4, completed_at=NOW()`,
    [userId, lessonId, lesson[0].module_id, lesson[0].xp_reward],
  );

  const result = await awardXp(userId, 'lesson_complete', lesson[0].xp_reward, lessonId);
  await recordActivity(userId);

  return res.json({ data: { xpEarned: lesson[0].xp_reward, ...result } });
}

export async function submitQuiz(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { quizId } = req.params;
  const { optionId } = req.body;

  const { rows } = await db.query('SELECT * FROM quizzes WHERE id=$1', [quizId]);
  if (rows.length === 0) return res.status(404).json({ error: 'Quiz not found' });

  const quiz = rows[0];
  const correct = (quiz.options as { id: string; is_correct: boolean }[]).find(
    (o) => o.id === optionId && o.is_correct,
  );

  if (correct) {
    await awardXp(userId, 'quiz_correct', quiz.xp_reward, quizId);
  }

  return res.json({
    data: {
      correct: !!correct,
      explanation: quiz.explanation,
      xpEarned: correct ? quiz.xp_reward : 0,
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
  return res.json({ data: rows });
}
