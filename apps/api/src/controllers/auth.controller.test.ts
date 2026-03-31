import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// ── Mock external dependencies before importing the controller ──────────────

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

vi.mock('../config/db', () => ({
  db: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

vi.mock('../config/redis', () => ({
  redis: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
}));

vi.mock('../config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-32-characters-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-chars',
    // P-13: secret present so fail-closed check passes in oauthCallback tests that supply the header
    INTERNAL_API_SECRET: 'test-internal-secret-16c',
  },
}));

import jwt from 'jsonwebtoken';
import { register, oauthCallback, logout, refreshTokens } from './auth.controller';
import { db } from '../config/db';
import { redis } from '../config/redis';

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    email: 'jordan@example.com',
    username: 'trader_pro',
    password: 'Password123',
    dateOfBirth: '2005-01-15',
    ...overrides,
  };
}

// P-13: helper to add required internal secret header to oauthCallback requests
function oauthHeaders() {
  return { 'x-internal-secret': 'test-internal-secret-16c' };
}

function setupTransactionMocks(userId = 'user-uuid-1', email = 'jordan@example.com') {
  const dbQueryMock = vi.mocked(db.query);
  dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // email check
  dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // username check

  vi.mocked(db.connect).mockResolvedValueOnce(mockClient as never);
  mockClient.query
    .mockResolvedValueOnce(undefined as never)                            // BEGIN
    .mockResolvedValueOnce({                                              // INSERT users
      rows: [{ id: userId, email, username: 'trader_pro', role: 'student', is_minor: false, created_at: '2026-03-25T00:00:00.000Z' }],
      rowCount: 1,
    } as never)
    .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)           // INSERT portfolios
    .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)           // INSERT user_xp
    .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)           // INSERT streaks
    .mockResolvedValueOnce(undefined as never);                          // COMMIT

  // P-26: getIsPro() subscription check called after COMMIT
  dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
  vi.mocked(redis.set).mockResolvedValueOnce('OK' as never);
}

// ── register() tests ─────────────────────────────────────────────────────────

describe('register()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC1 — creates account, bootstraps portfolio in a transaction, returns 201', async () => {
    setupTransactionMocks();

    const req = { body: validBody() } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          user: expect.objectContaining({ email: 'jordan@example.com' }),
        }),
      }),
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClient.query).toHaveBeenNthCalledWith(3, 'INSERT INTO portfolios(user_id) VALUES($1)', ['user-uuid-1']);
    expect(mockClient.query).toHaveBeenNthCalledWith(6, 'COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
    expect(vi.mocked(redis.set)).toHaveBeenCalledWith(
      expect.stringMatching(/^refresh:user-uuid-1:/),
      '1', 'EX', 604800,
    );
  });

  it('P1 — rolls back transaction and releases client on insert failure', async () => {
    const dbQueryMock = vi.mocked(db.query);
    dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    vi.mocked(db.connect).mockResolvedValueOnce(mockClient as never);
    mockClient.query
      .mockResolvedValueOnce(undefined as never)
      .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'jordan@example.com', username: 'trader_pro', role: 'student', is_minor: false, created_at: '2026-03-25T00:00:00.000Z' }], rowCount: 1 } as never)
      .mockRejectedValueOnce(new Error('DB constraint error'));

    mockClient.query.mockResolvedValueOnce(undefined as never); // ROLLBACK

    const req = { body: validBody() } as Request;
    const res = mockRes();

    await expect(register(req, res)).rejects.toThrow('DB constraint error');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('AC2 — blocks registration when age < 13', async () => {
    // P-1: use UTC-based DOB computation matching the fixed calculateAge
    const now = new Date();
    const under13 = new Date(Date.UTC(now.getUTCFullYear() - 12, now.getUTCMonth(), now.getUTCDate()));
    const dob = under13.toISOString().split('T')[0];

    const req = { body: validBody({ dateOfBirth: dob }) } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'AGE_BELOW_MINIMUM', message: 'You must be at least 13 years old to register.', field: 'dateOfBirth' },
    });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('AC2 — allows registration when age is exactly 13', async () => {
    const now = new Date();
    const exactly13 = new Date(Date.UTC(now.getUTCFullYear() - 13, now.getUTCMonth(), now.getUTCDate()));
    const dob = exactly13.toISOString().split('T')[0];

    setupTransactionMocks('user-uuid-2', 'teen@example.com');

    const req = { body: validBody({ email: 'teen@example.com', username: 'teen_trader', dateOfBirth: dob }) } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('P2 — blocks registration when dateOfBirth is not a valid date string', async () => {
    const req = { body: validBody({ dateOfBirth: 'not-a-date' }) } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid registration data.' },
    });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('P2 — blocks registration when dateOfBirth is a rolled-over invalid date (2000-02-30)', async () => {
    const req = { body: validBody({ dateOfBirth: '2000-02-30' }) } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid registration data.' },
    });
    expect(db.query).not.toHaveBeenCalled();
  });

  // P-3: separate error code for age > 120
  it('P6 — blocks registration when age > 120 with INVALID_DATE_OF_BIRTH code', async () => {
    const req = { body: validBody({ dateOfBirth: '1800-01-01' }) } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INVALID_DATE_OF_BIRTH', message: 'Date of birth is not valid.', field: 'dateOfBirth' },
    });
  });

  it('AC3 — returns 409 DUPLICATE_EMAIL when email already exists', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 } as never);

    const req = { body: validBody() } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'DUPLICATE_EMAIL', message: 'This email is already registered.', field: 'email' },
    });
  });

  it('P3 — returns 409 DUPLICATE_USERNAME when username already exists', async () => {
    const dbQueryMock = vi.mocked(db.query);
    dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    dbQueryMock.mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 } as never);

    const req = { body: validBody() } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'DUPLICATE_USERNAME', message: 'This username is already taken.', field: 'username' },
    });
  });

  it('AC4 — returns 400 VALIDATION_ERROR when password is too short', async () => {
    const req = { body: validBody({ password: 'short' }) } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid registration data.' },
    });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('AC4 — returns 400 VALIDATION_ERROR when dateOfBirth is missing', async () => {
    const { dateOfBirth: _dob, ...bodyWithoutDob } = validBody();
    const req = { body: bodyWithoutDob } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid registration data.' },
    });
  });

  // P-8: role field removed from schema — must not be accepted
  it('P8 — ignores role field if supplied (always registers as student)', async () => {
    setupTransactionMocks();
    const req = { body: { ...validBody(), role: 'teacher' } } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    // Verify INSERT used 'student' (position 4 in params: email, username, hash, dateOfBirth, isMinor)
    const insertCall = mockClient.query.mock.calls[1];
    expect(insertCall[0]).toContain("'student'");
  });
});

// ── oauthCallback() tests ────────────────────────────────────────────────────

function validOAuthBody(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'google',
    oauthId: 'google-sub-12345',
    email: 'oauth@example.com',
    name: 'Jordan Smith',
    avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
    ...overrides,
  };
}

function setupNewOAuthUserMocks(userId = 'oauth-uuid-1') {
  const dbQueryMock = vi.mocked(db.query);
  dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // oauth lookup: not found
  dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // email lookup: not found

  vi.mocked(db.connect).mockResolvedValueOnce(mockClient as never);
  mockClient.query
    .mockResolvedValueOnce(undefined as never) // BEGIN
    .mockResolvedValueOnce({
      rows: [{ id: userId, email: 'oauth@example.com', username: 'jordan_smith_ab12', role: 'student', created_at: '2026-03-25T00:00:00.000Z' }],
      rowCount: 1,
    } as never) // INSERT users
    .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never) // INSERT portfolios
    .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never) // INSERT user_xp
    .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never) // INSERT streaks
    .mockResolvedValueOnce(undefined as never); // COMMIT

  dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // getIsPro
  vi.mocked(redis.set).mockResolvedValueOnce('OK' as never);
}

describe('oauthCallback()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // P-13: fail-closed guard tests
  it('P13 — returns 401 when INTERNAL_API_SECRET header is absent', async () => {
    const req = { body: validOAuthBody(), headers: {} } as unknown as Request;
    const res = mockRes();

    await oauthCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'UNAUTHORIZED', message: 'Forbidden.' } });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('P13 — returns 401 when INTERNAL_API_SECRET header is wrong', async () => {
    const req = { body: validOAuthBody(), headers: { 'x-internal-secret': 'wrong-secret' } } as unknown as Request;
    const res = mockRes();

    await oauthCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('AC1 — new Google user: creates account, bootstraps portfolio, returns 201 with JWT pair', async () => {
    setupNewOAuthUserMocks('oauth-uuid-1');

    const req = { body: validOAuthBody(), headers: oauthHeaders() } as unknown as Request;
    const res = mockRes();

    await oauthCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          // P-19: assert role: student
          user: expect.objectContaining({ id: 'oauth-uuid-1', role: 'student' }),
        }),
      }),
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClient.query).toHaveBeenNthCalledWith(6, 'COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
    expect(vi.mocked(redis.set)).toHaveBeenCalledWith(
      expect.stringMatching(/^refresh:oauth-uuid-1:/),
      '1', 'EX', 604800,
    );
  });

  it('AC1 — returning Google user (same oauth_id): returns 200 without new insert', async () => {
    const dbQueryMock = vi.mocked(db.query);
    dbQueryMock.mockResolvedValueOnce({
      rows: [{ id: 'existing-oauth-user', email: 'oauth@example.com', username: 'jordan_abc1', role: 'student' }],
      rowCount: 1,
    } as never);
    dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // getIsPro
    vi.mocked(redis.set).mockResolvedValueOnce('OK' as never);

    const req = { body: validOAuthBody(), headers: oauthHeaders() } as unknown as Request;
    const res = mockRes();

    await oauthCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessToken: expect.any(String),
          user: expect.objectContaining({ id: 'existing-oauth-user' }),
        }),
      }),
    );
    expect(db.connect).not.toHaveBeenCalled();
  });

  it('AC2 — account linking: existing email user gets oauth columns set, returns 200', async () => {
    const dbQueryMock = vi.mocked(db.query);
    dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // oauth lookup: not found
    dbQueryMock.mockResolvedValueOnce({
      rows: [{ id: 'email-user-1', email: 'oauth@example.com', username: 'existing_user', role: 'student' }],
      rowCount: 1,
    } as never); // email lookup: found
    dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never); // UPDATE
    dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // getIsPro
    vi.mocked(redis.set).mockResolvedValueOnce('OK' as never);

    const req = { body: validOAuthBody(), headers: oauthHeaders() } as unknown as Request;
    const res = mockRes();

    await oauthCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(vi.mocked(db.query)).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users SET oauth_provider'),
      ['google', 'google-sub-12345', 'https://lh3.googleusercontent.com/photo.jpg', 'email-user-1'],
    );
    // P-15: verify COALESCE is used in UPDATE SQL
    expect(vi.mocked(db.query)).toHaveBeenCalledWith(
      expect.stringContaining('COALESCE'),
      expect.any(Array),
    );
    expect(db.connect).not.toHaveBeenCalled();
  });

  // P-20: emailVerified: false must be rejected (prevents account-takeover linking)
  it('P20 — returns 403 EMAIL_NOT_VERIFIED when emailVerified is false', async () => {
    const dbQueryMock = vi.mocked(db.query);
    dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // oauth lookup: not found

    const req = { body: validOAuthBody({ emailVerified: false }), headers: oauthHeaders() } as unknown as Request;
    const res = mockRes();

    await oauthCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'EMAIL_NOT_VERIFIED', message: expect.any(String), field: 'email' },
    });
    expect(db.connect).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR when provider is missing', async () => {
    const req = { body: { oauthId: 'abc', email: 'test@example.com' }, headers: oauthHeaders() } as unknown as Request;
    const res = mockRes();

    await oauthCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid OAuth data.', field: 'provider' },
    });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('P1 — rolls back transaction and releases client on new-user insert failure', async () => {
    const dbQueryMock = vi.mocked(db.query);
    dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    vi.mocked(db.connect).mockResolvedValueOnce(mockClient as never);
    mockClient.query
      .mockResolvedValueOnce(undefined as never) // BEGIN
      .mockRejectedValueOnce(new Error('DB insert failure'));

    mockClient.query.mockResolvedValueOnce(undefined as never); // ROLLBACK

    const req = { body: validOAuthBody(), headers: oauthHeaders() } as unknown as Request;
    const res = mockRes();

    await expect(oauthCallback(req, res)).rejects.toThrow('DB insert failure');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});

// ── logout() tests ────────────────────────────────────────────────────────────

describe('logout()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC1 — invalidates Redis refresh token key and returns 200 with message', async () => {
    // P-24: logout now verifies the JWT to extract jti — must use a real signed token
    const fakeRefreshToken = jwt.sign(
      { userId: 'user-uuid-1', jti: 'logoutjti1234567' },
      'test-refresh-secret-minimum-32-chars',
      { expiresIn: '7d' },
    );
    vi.mocked(redis.del).mockResolvedValueOnce(1 as never);

    const req = {
      body: { refreshToken: fakeRefreshToken },
      user: { userId: 'user-uuid-1', role: 'student', isPro: false },
    } as unknown as Request;
    const res = mockRes();

    await logout(req, res);

    expect(vi.mocked(redis.del)).toHaveBeenCalledWith('refresh:user-uuid-1:logoutjti1234567');
    expect(res.json).toHaveBeenCalledWith({ data: { message: 'Logged out' } });
  });

  it('AC1 — returns 200 without Redis call when refreshToken is missing from body', async () => {
    const req = {
      body: {},
      user: { userId: 'user-uuid-1', role: 'student', isPro: false },
    } as unknown as Request;
    const res = mockRes();

    await logout(req, res);

    expect(vi.mocked(redis.del)).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ data: { message: 'Logged out' } });
  });

  it('AC1 — returns 200 without Redis call when req.user is absent', async () => {
    const req = {
      body: { refreshToken: 'some.token.here' },
    } as unknown as Request;
    const res = mockRes();

    await logout(req, res);

    expect(vi.mocked(redis.del)).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ data: { message: 'Logged out' } });
  });

  // P-24: cross-user token injection is silently ignored
  it('P24 — does not delete key when refresh token userId does not match authenticated user', async () => {
    const otherUserToken = jwt.sign(
      { userId: 'other-user-uuid', jti: 'otherjti123' },
      'test-refresh-secret-minimum-32-chars',
      { expiresIn: '7d' },
    );

    const req = {
      body: { refreshToken: otherUserToken },
      user: { userId: 'user-uuid-1', role: 'student', isPro: false },
    } as unknown as Request;
    const res = mockRes();

    await logout(req, res);

    expect(vi.mocked(redis.del)).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ data: { message: 'Logged out' } });
  });
});

// ── refreshTokens() tests ─────────────────────────────────────────────────────

describe('refreshTokens()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // P-7: tokens now include jti — use fixed jti for deterministic key assertions
  function makeRefreshToken(userId = 'user-uuid-1', jti = 'test-jti-fixed-1234') {
    return jwt.sign({ userId, jti }, 'test-refresh-secret-minimum-32-chars', { expiresIn: '7d' });
  }

  it('AC2/AC3 — valid refresh: rotates tokens, returns 200 with new accessToken + refreshToken', async () => {
    const oldToken = makeRefreshToken('user-uuid-1', 'test-jti-fixed-1234');
    const oldKey = 'refresh:user-uuid-1:test-jti-fixed-1234';

    vi.mocked(redis.get).mockResolvedValueOnce('1' as never);
    // P-22: DB queries come BEFORE del
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ role: 'student' }], rowCount: 1 } as never); // SELECT role
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // getIsPro
    vi.mocked(redis.del).mockResolvedValueOnce(1 as never);
    vi.mocked(redis.set).mockResolvedValueOnce('OK' as never);

    const req = { body: { refreshToken: oldToken } } as Request;
    const res = mockRes();

    await refreshTokens(req, res);

    expect(vi.mocked(redis.del)).toHaveBeenCalledWith(oldKey);
    expect(vi.mocked(redis.set)).toHaveBeenCalledWith(
      expect.stringMatching(/^refresh:user-uuid-1:/),
      '1', 'EX', 604800,
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        }),
      }),
    );
  });

  // P-22: del must happen AFTER DB queries (so DB failure doesn't orphan consumed token)
  it('P22 — rotation order: DB queries complete before redis.del fires', async () => {
    const oldToken = makeRefreshToken('user-uuid-1', 'test-jti-order-check');

    vi.mocked(redis.get).mockResolvedValueOnce('1' as never);
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ role: 'student' }], rowCount: 1 } as never);
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    vi.mocked(redis.del).mockResolvedValueOnce(1 as never);
    vi.mocked(redis.set).mockResolvedValueOnce('OK' as never);

    const req = { body: { refreshToken: oldToken } } as Request;
    const res = mockRes();

    await refreshTokens(req, res);

    const dbOrder = vi.mocked(db.query).mock.invocationCallOrder[0];
    const delOrder = vi.mocked(redis.del).mock.invocationCallOrder[0];
    const setOrder = vi.mocked(redis.set).mock.invocationCallOrder[0];
    // DB query fires first, then del, then set
    expect(dbOrder).toBeLessThan(delOrder);
    expect(delOrder).toBeLessThan(setOrder);
  });

  it('returns 400 when refreshToken is missing from body', async () => {
    const req = { body: {} } as Request;
    const res = mockRes();

    await refreshTokens(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Refresh token required' });
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('returns 401 when refresh token JWT signature is invalid', async () => {
    const req = { body: { refreshToken: 'header.payload.invalidsignature' } } as Request;
    const res = mockRes();

    await refreshTokens(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid refresh token' });
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('AC3 — returns 401 when refresh token is not in Redis (revoked or replayed)', async () => {
    const oldToken = makeRefreshToken('user-uuid-1');
    vi.mocked(redis.get).mockResolvedValueOnce(null as never);

    const req = { body: { refreshToken: oldToken } } as Request;
    const res = mockRes();

    await refreshTokens(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Refresh token revoked' });
    expect(redis.del).not.toHaveBeenCalled();
  });

  // AC3: verify single-use — second call with same token returns 401
  it('AC3 — replay: second use of same token returns 401 (key deleted on first use)', async () => {
    const token = makeRefreshToken('user-uuid-1', 'replay-jti-test-1234');

    // First call: key exists
    vi.mocked(redis.get).mockResolvedValueOnce('1' as never);
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ role: 'student' }], rowCount: 1 } as never);
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    vi.mocked(redis.del).mockResolvedValueOnce(1 as never);
    vi.mocked(redis.set).mockResolvedValueOnce('OK' as never);

    const req1 = { body: { refreshToken: token } } as Request;
    const res1 = mockRes();
    await refreshTokens(req1, res1);
    expect(res1.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ accessToken: expect.any(String) }) }));

    // Second call: key gone (already deleted)
    vi.mocked(redis.get).mockResolvedValueOnce(null as never);

    const req2 = { body: { refreshToken: token } } as Request;
    const res2 = mockRes();
    await refreshTokens(req2, res2);

    expect(res2.status).toHaveBeenCalledWith(401);
    expect(res2.json).toHaveBeenCalledWith({ error: 'Refresh token revoked' });
  });
});

// ── register() — is_minor flagging tests ─────────────────────────────────────

// P-33: UTC-based DOB computation — eliminates DST/timezone variance in tests
function dobAtAge(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString().split('T')[0];
}

function setupMinorTransactionMocks(userId = 'minor-uuid-1', email = 'teen@example.com') {
  const dbQueryMock = vi.mocked(db.query);
  dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // email check
  dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // username check
  vi.mocked(db.connect).mockResolvedValueOnce(mockClient as never);
  mockClient.query
    .mockResolvedValueOnce(undefined as never)
    .mockResolvedValueOnce({
      rows: [{ id: userId, email, username: 'teen_user', role: 'student', is_minor: true, created_at: '2026-03-25T00:00:00.000Z' }],
      rowCount: 1,
    } as never)
    .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)
    .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)
    .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)
    .mockResolvedValueOnce(undefined as never);
  // P-26: getIsPro subscription check after COMMIT
  dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
  vi.mocked(redis.set).mockResolvedValueOnce('OK' as never);
}

describe('register() — is_minor flagging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC2 — age 13 sets is_minor: true in INSERT', async () => {
    setupMinorTransactionMocks();

    const req = { body: validBody({ email: 'teen13@example.com', username: 'teen_13', dateOfBirth: dobAtAge(13) }) } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const insertCall = mockClient.query.mock.calls[1];
    const params = insertCall[1] as unknown[];
    // Params: [email, username, hashedPw, dateOfBirth, isMinor] — isMinor is index 4
    expect(params[4]).toBe(true);
  });

  it('AC2 — age 17 sets is_minor: true in INSERT', async () => {
    setupMinorTransactionMocks('minor-uuid-2', 'teen17@example.com');

    const req = { body: validBody({ email: 'teen17@example.com', username: 'teen_17', dateOfBirth: dobAtAge(17) }) } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const insertCall = mockClient.query.mock.calls[1];
    const params = insertCall[1] as unknown[];
    expect(params[4]).toBe(true);
  });

  it('AC3 — age 18 sets is_minor: false in INSERT', async () => {
    setupTransactionMocks('adult-uuid-1', 'adult18@example.com');

    const req = { body: validBody({ email: 'adult18@example.com', username: 'adult_18', dateOfBirth: dobAtAge(18) }) } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const insertCall = mockClient.query.mock.calls[1];
    const params = insertCall[1] as unknown[];
    expect(params[4]).toBe(false);
  });

  it('AC3 — age 25 sets is_minor: false in INSERT', async () => {
    setupTransactionMocks('adult-uuid-2', 'adult25@example.com');

    const req = { body: validBody({ email: 'adult25@example.com', username: 'adult_25', dateOfBirth: dobAtAge(25) }) } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const insertCall = mockClient.query.mock.calls[1];
    const params = insertCall[1] as unknown[];
    expect(params[4]).toBe(false);
  });
});
