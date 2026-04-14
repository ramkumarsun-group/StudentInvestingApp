import { Request, Response } from 'express';
import { db } from '../config/db';
import { v4 as uuidv4 } from 'uuid';

function generateJoinCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createClass(req: Request, res: Response) {
  const { name, semester, academicYear, startingCash } = req.body;
  const teacherId = req.user!.userId;

  const { rows: teacher } = await db.query('SELECT school_id FROM users WHERE id=$1', [teacherId]);
  const schoolId = teacher[0]?.school_id;

  let joinCode = generateJoinCode();
  // Ensure uniqueness
  while ((await db.query('SELECT 1 FROM classes WHERE join_code=$1', [joinCode])).rows.length > 0) {
    joinCode = generateJoinCode();
  }

  const { rows } = await db.query(
    `INSERT INTO classes(school_id, teacher_id, name, join_code, semester, academic_year, starting_cash)
     VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [schoolId, teacherId, name, joinCode, semester || null, academicYear || null, startingCash || 100000],
  );
  return res.status(201).json({ data: rows[0] });
}

export async function getTeacherClasses(req: Request, res: Response) {
  const { rows } = await db.query(
    `SELECT c.*, COUNT(ce.id) AS student_count
     FROM classes c
     LEFT JOIN class_enrollments ce ON ce.class_id=c.id
     WHERE c.teacher_id=$1
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [req.user!.userId],
  );
  return res.json({ data: rows });
}

export async function getClassDetail(req: Request, res: Response) {
  const { classId } = req.params;
  const { rows: cls } = await db.query('SELECT * FROM classes WHERE id=$1 AND teacher_id=$2', [classId, req.user!.userId]);
  if (cls.length === 0) return res.status(404).json({ error: 'Class not found' });

  const { rows: students } = await db.query(
    `SELECT u.id, u.username, u.avatar_url, p.total_value, p.total_return_pct,
       ux.total_xp, ux.current_level, l.name AS level_name,
       COUNT(CASE WHEN ulp.status='completed' THEN 1 END) AS lessons_completed
     FROM class_enrollments ce
     JOIN users u ON u.id=ce.student_id
     LEFT JOIN portfolios p ON p.id=ce.portfolio_id
     LEFT JOIN user_xp ux ON ux.user_id=u.id
     LEFT JOIN levels l ON l.id=ux.current_level
     LEFT JOIN user_lesson_progress ulp ON ulp.user_id=u.id
     WHERE ce.class_id=$1
     GROUP BY u.id, p.id, ux.total_xp, ux.current_level, l.name
     ORDER BY p.total_return_pct DESC`,
    [classId],
  );
  return res.json({ data: { ...cls[0], students } });
}

export async function getClassProgress(req: Request, res: Response) {
  const { classId } = req.params;
  const { rows } = await db.query(
    `SELECT u.id, u.username,
       COUNT(CASE WHEN ulp.status='completed' THEN 1 END) AS lessons_completed,
       ux.total_xp, s.current_streak
     FROM class_enrollments ce
     JOIN users u ON u.id=ce.student_id
     LEFT JOIN user_lesson_progress ulp ON ulp.user_id=u.id
     LEFT JOIN user_xp ux ON ux.user_id=u.id
     LEFT JOIN streaks s ON s.user_id=u.id
     WHERE ce.class_id=$1
     GROUP BY u.id, ux.total_xp, s.current_streak
     ORDER BY lessons_completed DESC`,
    [classId],
  );
  return res.json({ data: rows });
}

export async function joinClass(req: Request, res: Response) {
  const { joinCode } = req.body;
  const studentId = req.user!.userId;

  const { rows: cls } = await db.query(
    'SELECT * FROM classes WHERE join_code=$1 AND is_active=true',
    [joinCode.toUpperCase()],
  );
  if (cls.length === 0) return res.status(404).json({ error: 'Class not found' });

  const classObj = cls[0];
  const existing = await db.query(
    'SELECT id FROM class_enrollments WHERE class_id=$1 AND student_id=$2',
    [classObj.id, studentId],
  );
  if (existing.rows.length > 0) return res.status(409).json({ error: 'Already enrolled' });

  // Create class-specific portfolio
  const { rows: port } = await db.query(
    `INSERT INTO portfolios(user_id, name, virtual_cash, total_value)
     VALUES($1,$2,$3,$3) RETURNING id`,
    [studentId, `${classObj.name} Portfolio`, classObj.starting_cash],
  );

  await db.query(
    'INSERT INTO class_enrollments(class_id, student_id, portfolio_id) VALUES($1,$2,$3)',
    [classObj.id, studentId, port[0].id],
  );

  return res.status(201).json({ data: { classId: classObj.id, portfolioId: port[0].id } });
}

export async function getMyClasses(req: Request, res: Response) {
  const { rows } = await db.query(
    `SELECT c.id, c.name, c.join_code, c.semester, u.username AS teacher_name,
       COUNT(ce2.id) AS student_count
     FROM class_enrollments ce
     JOIN classes c ON c.id=ce.class_id
     JOIN users u ON u.id=c.teacher_id
     LEFT JOIN class_enrollments ce2 ON ce2.class_id=c.id
     WHERE ce.student_id=$1
     GROUP BY c.id, u.username`,
    [req.user!.userId],
  );
  return res.json({ data: rows });
}
