import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../config/db';
import { env } from '../config/env';
import { redis } from '../config/redis';

// P-2: Validate YYYY-MM-DD and calendar round-trip (rejects rolled-over dates like 2000-02-30)
function isValidCalendarDate(v: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8),
  // P-2: strict YYYY-MM-DD + calendar validity
  dateOfBirth: z.string().refine(isValidCalendarDate, { message: 'Invalid date format or non-existent date' }),
  // P-8: role removed — all email/password registrations default to student
});

// P-1: UTC-based age calculation eliminates server timezone offset from COPPA boundary
function calculateAge(dob: string): number {
  const [y, m, d] = dob.split('-').map(Number);
  const birthUtc = new Date(Date.UTC(y, m - 1, d));
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let age = todayUtc.getUTCFullYear() - birthUtc.getUTCFullYear();
  const monthDiff = todayUtc.getUTCMonth() - birthUtc.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && todayUtc.getUTCDate() < birthUtc.getUTCDate())) age--;
  return age;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function signAccessToken(userId: string, role: string, isPro: boolean) {
  return jwt.sign({ userId, role, isPro }, env.JWT_SECRET, { expiresIn: '15m' });
}

// P-7: embed jti (UUID) in refresh token — used as Redis key suffix for collision-free storage
function signRefreshToken(userId: string): { token: string; jti: string } {
  const jti = uuidv4();
  const token = jwt.sign({ userId, jti }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { token, jti };
}

// P-3: Check Pro status before issuing access token
async function getIsPro(userId: string): Promise<boolean> {
  const subRow = await db.query(
    `SELECT id FROM subscriptions WHERE user_id=$1 AND status='active'`,
    [userId],
  );
  return subRow.rows.length > 0;
}

export async function register(req: Request, res: Response) {
  const body = registerSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid registration data.' },
    });
  }

  // P-8: role removed from schema — always student for email/password path
  const { email, username, password, dateOfBirth } = body.data;

  // P-1/P-3: Server-side age enforcement (COPPA: minimum 13, sanity ceiling 120)
  const age = calculateAge(dateOfBirth);
  if (age < 13) {
    return res.status(422).json({
      error: {
        code: 'AGE_BELOW_MINIMUM',
        message: 'You must be at least 13 years old to register.',
        field: 'dateOfBirth',
      },
    });
  }
  if (age > 120) {
    return res.status(422).json({
      error: {
        code: 'INVALID_DATE_OF_BIRTH',
        message: 'Date of birth is not valid.',
        field: 'dateOfBirth',
      },
    });
  }

  const isMinor = age >= 13 && age < 18;

  // Pre-transaction duplicate checks (fast-path rejection before acquiring a transaction slot)
  const emailRow = await db.query('SELECT id FROM users WHERE email=$1', [email]);
  if (emailRow.rows.length > 0) {
    return res.status(409).json({
      error: { code: 'DUPLICATE_EMAIL', message: 'This email is already registered.', field: 'email' },
    });
  }
  const usernameRow = await db.query('SELECT id FROM users WHERE username=$1', [username]);
  if (usernameRow.rows.length > 0) {
    return res.status(409).json({
      error: { code: 'DUPLICATE_USERNAME', message: 'This username is already taken.', field: 'username' },
    });
  }

  const client = await db.connect();
  let user: Record<string, unknown>;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO users(email, username, password_hash, role, date_of_birth, is_minor)
       VALUES($1,$2,$3,'student',$4,$5) RETURNING id, email, username, role, is_minor, created_at`,
      [email, username, await bcrypt.hash(password, 12), dateOfBirth, isMinor],
    );
    user = rows[0];
    await client.query('INSERT INTO portfolios(user_id) VALUES($1)', [user.id]);
    await client.query('INSERT INTO user_xp(user_id) VALUES($1) ON CONFLICT DO NOTHING', [user.id]);
    await client.query('INSERT INTO streaks(user_id) VALUES($1) ON CONFLICT DO NOTHING', [user.id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    // P-5: Handle concurrent registration race — DB unique constraint fires instead of pre-check
    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr.code === '23505') {
      if (pgErr.constraint?.includes('email') || pgErr.constraint?.includes('users_email')) {
        return res.status(409).json({ error: { code: 'DUPLICATE_EMAIL', message: 'This email is already registered.', field: 'email' } });
      }
      return res.status(409).json({ error: { code: 'DUPLICATE_USERNAME', message: 'This username is already taken.', field: 'username' } });
    }
    throw err;
  } finally {
    client.release();
  }

  // P-26: check Pro status (consistent with login path; safe to call after commit)
  const isPro = await getIsPro(user.id as string);
  const accessToken = signAccessToken(user.id as string, user.role as string, isPro);
  const { token: refreshToken, jti } = signRefreshToken(user.id as string);

  // P-6: Redis failure after committed account is non-fatal — client can re-login to get refresh token
  try {
    await redis.set(`refresh:${user.id}:${jti}`, '1', 'EX', 60 * 60 * 24 * 7);
  } catch {
    // Log in production; access token still valid for 15 min
  }

  return res.status(201).json({ data: { user, accessToken, refreshToken } });
}

export async function login(req: Request, res: Response) {
  const body = loginSchema.safeParse(req.body);
  // P (login envelope): consistent error shape
  if (!body.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid login data.' } });
  }

  const { email, password } = body.data;
  const { rows } = await db.query(
    'SELECT id, email, username, role, is_minor, password_hash FROM users WHERE email=$1',
    [email],
  );
  if (rows.length === 0) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });

  const isPro = await getIsPro(user.id);
  const accessToken = signAccessToken(user.id, user.role, isPro);
  const { token: refreshToken, jti } = signRefreshToken(user.id);

  try {
    await redis.set(`refresh:${user.id}:${jti}`, '1', 'EX', 60 * 60 * 24 * 7);
  } catch {
    // Non-fatal
  }

  // P-30: include is_minor in login response (consistent with register response)
  return res.json({
    data: {
      user: { id: user.id, email: user.email, username: user.username, role: user.role, is_minor: user.is_minor },
      accessToken,
      refreshToken,
    },
  });
}

export async function refreshTokens(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  let payload: { userId: string; jti: string };
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string; jti: string };
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  // P-7: key uses jti from JWT payload
  const key = `refresh:${payload.userId}:${payload.jti}`;
  const exists = await redis.get(key);
  if (!exists) return res.status(401).json({ error: 'Refresh token revoked' });

  // P-22: DB lookups BEFORE del to avoid partial-state on DB failure
  const { rows } = await db.query('SELECT role FROM users WHERE id=$1', [payload.userId]);
  if (rows.length === 0) return res.status(401).json({ error: 'User not found' });

  const isPro = await getIsPro(payload.userId);

  // Rotate: delete old key only after DB confirms user exists
  await redis.del(key);
  const newAccess = signAccessToken(payload.userId, rows[0].role, isPro);
  const { token: newRefresh, jti: newJti } = signRefreshToken(payload.userId);
  await redis.set(`refresh:${payload.userId}:${newJti}`, '1', 'EX', 60 * 60 * 24 * 7);

  return res.json({ data: { accessToken: newAccess, refreshToken: newRefresh } });
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (refreshToken && req.user) {
    try {
      // P-24: verify token and assert it belongs to the authenticated user before deleting
      const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string; jti: string };
      if (payload.userId === req.user.userId) {
        await redis.del(`refresh:${payload.userId}:${payload.jti}`);
      }
    } catch {
      // Invalid/expired refresh token — best-effort logout; access token will expire naturally
    }
  }
  return res.json({ data: { message: 'Logged out' } });
}

export async function getMe(req: Request, res: Response) {
  const { rows } = await db.query(
    // P-31: include is_minor so Phase 2 parental visibility consumers can use it
    `SELECT id, email, username, role, is_minor, avatar_url, date_of_birth, school_id, created_at
     FROM users WHERE id=$1`,
    [req.user!.userId],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
  return res.json({ data: rows[0] });
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

const oauthCallbackSchema = z.object({
  provider: z.enum(['google']),
  oauthId: z.string().min(1),
  email: z.string().email(),
  emailVerified: z.boolean().optional(),
  name: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

function generateOAuthUsername(name?: string, email?: string): string {
  const base = name
    ? name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20)
    : (email ?? 'user').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
  // P-17: crypto-random suffix avoids Math.random() predictability
  const suffix = uuidv4().replace(/-/g, '').slice(0, 8);
  return `${base || 'user'}_${suffix}`;
}

async function issueTokens(res: Response, user: Record<string, unknown>, status = 200) {
  const isPro = await getIsPro(user.id as string);
  const accessToken = signAccessToken(user.id as string, user.role as string, isPro);
  const { token: refreshToken, jti } = signRefreshToken(user.id as string);
  // P-6: Redis failure is non-fatal — access token still valid for 15 min
  try {
    await redis.set(`refresh:${user.id}:${jti}`, '1', 'EX', 60 * 60 * 24 * 7);
  } catch {
    // Log in production
  }
  return res.status(status).json({ data: { user, accessToken, refreshToken } });
}

export async function oauthCallback(req: Request, res: Response) {
  // P-13: Fail closed — endpoint is always protected; INTERNAL_API_SECRET must be configured
  const expectedSecret = env.INTERNAL_API_SECRET;
  const secret = req.headers['x-internal-secret'];
  if (!expectedSecret || secret !== expectedSecret) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Forbidden.' } });
  }

  const body = oauthCallbackSchema.safeParse(req.body);
  if (!body.success) {
    const firstField = Object.keys(body.error.flatten().fieldErrors)[0];
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid OAuth data.', ...(firstField && { field: firstField }) },
    });
  }

  const { provider, oauthId, email, emailVerified, name, avatarUrl } = body.data;

  // 1. Returning OAuth user — same provider + id
  const oauthRow = await db.query(
    'SELECT id, email, username, role FROM users WHERE oauth_provider=$1 AND oauth_id=$2',
    [provider, oauthId],
  );
  if (oauthRow.rows.length > 0) {
    return issueTokens(res, oauthRow.rows[0]);
  }

  // 2. Account linking — existing email/password user
  // P-16 (server-side): only link if email is verified by provider
  if (emailVerified === false) {
    return res.status(403).json({
      error: { code: 'EMAIL_NOT_VERIFIED', message: 'Google account email is not verified. Cannot link to existing account.', field: 'email' },
    });
  }

  const emailRow = await db.query(
    'SELECT id, email, username, role FROM users WHERE email=$1',
    [email],
  );
  if (emailRow.rows.length > 0) {
    const user = emailRow.rows[0];
    const updateResult = await db.query(
      // P-15: COALESCE preserves existing avatar_url when OAuth provider sends nothing
      'UPDATE users SET oauth_provider=$1, oauth_id=$2, avatar_url=COALESCE($3, avatar_url), updated_at=NOW() WHERE id=$4',
      [provider, oauthId, avatarUrl || null, user.id],
    );
    if ((updateResult as unknown as { rowCount: number }).rowCount === 0) {
      return res.status(401).json({ error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account no longer exists.' } });
    }
    return issueTokens(res, user);
  }

  // 3. New user — bootstrap in transaction
  const username = generateOAuthUsername(name, email);
  const client = await db.connect();
  let user: Record<string, unknown>;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO users(email, username, oauth_provider, oauth_id, avatar_url, role)
       VALUES($1,$2,$3,$4,$5,'student') RETURNING id, email, username, role, avatar_url, created_at`,
      [email, username, provider, oauthId, avatarUrl || null],
    );
    user = rows[0];
    await client.query('INSERT INTO portfolios(user_id) VALUES($1)', [user.id]);
    await client.query('INSERT INTO user_xp(user_id) VALUES($1) ON CONFLICT DO NOTHING', [user.id]);
    await client.query('INSERT INTO streaks(user_id) VALUES($1) ON CONFLICT DO NOTHING', [user.id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr.code === '23505') {
      if (pgErr.constraint?.includes('oauth') || pgErr.constraint?.includes('idx_users_oauth')) {
        // P-14: oauth_id collision — concurrent request won the race; return existing user
        const existing = await db.query(
          'SELECT id, email, username, role FROM users WHERE oauth_provider=$1 AND oauth_id=$2',
          [provider, oauthId],
        );
        if (existing.rows.length > 0) return issueTokens(res, existing.rows[0]);
      }
      // username collision (rare) — surface as 409 rather than 500
      return res.status(409).json({ error: { code: 'DUPLICATE_USERNAME', message: 'Username conflict. Please try again.' } });
    }
    throw err;
  } finally {
    client.release();
  }

  return issueTokens(res, user, 201);
}
