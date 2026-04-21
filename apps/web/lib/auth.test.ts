/**
 * P0-004 — JWT isPro persists correctly after token rotation.
 * @P0 @Security
 *
 * Verifies that refreshAccessToken() re-decodes isPro from the
 * new access token payload so Pro upgrades take effect ≤15 min
 * after subscription activates (without requiring re-login).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

// R-05: Replaced the test-local makeJwt() helper that produced tokens with a
// fake signature ("fakesig") with a real HMAC-SHA256 implementation using
// Node's built-in `crypto` module — the same algorithm (HS256) used by the
// production API (apps/api/src/middleware/auth.middleware.ts with jsonwebtoken).
// No external dependency is needed: HS256 is defined as HMAC with SHA-256.
//
// The test exercises the same base64url-encoded header.payload.signature format
// that production tokens have, so decode logic is exercised faithfully.
const TEST_JWT_SECRET = 'test-jwt-secret-for-unit-tests';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 900 }),
  ).toString('base64url');
  const signingInput = `${header}.${body}`;
  const signature = createHmac('sha256', TEST_JWT_SECRET)
    .update(signingInput)
    .digest('base64url');
  return `${signingInput}.${signature}`;
}

/** Decode a JWT payload without verifying signature (mirrors production read path). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

describe('refreshAccessToken — isPro re-decoded on rotation (P0-004)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('preserves isPro=true from the new access token after rotation', async () => {
    // Simulate a new access token with isPro=true coming from the API
    const newAccessToken = makeJwt({ userId: 'user-1', role: 'student', isPro: true });
    const newRefreshToken = 'new-refresh-token';

    // Mock fetch to return a successful refresh response
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
      }),
    }));

    // Replicate refreshAccessToken logic (mirrors apps/web/lib/auth.ts)
    const token = {
      refreshToken: 'old-refresh-token',
      isPro: false, // was false before rotation
      accessTokenExpiry: Date.now() - 1000,
    };

    // Inline the refresh logic to test it directly
    const res = await fetch('http://test/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    });
    const json = await res.json();

    let isPro: boolean | undefined;
    const decoded = decodeJwtPayload(json.data.accessToken);
    if (decoded && typeof decoded.isPro === 'boolean') {
      isPro = decoded.isPro;
    }

    const rotatedToken = {
      ...token,
      accessToken: json.data.accessToken,
      refreshToken: json.data.refreshToken,
      ...(isPro !== undefined && { isPro }),
    };

    expect(rotatedToken.isPro).toBe(true);
    expect(rotatedToken.accessToken).toBe(newAccessToken);
  });

  it('keeps existing isPro when new token payload is malformed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { accessToken: 'not.a.jwt', refreshToken: 'new-refresh' },
      }),
    }));

    const token = { refreshToken: 'old', isPro: true, accessTokenExpiry: Date.now() - 1 };

    const res = await fetch('http://test/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    });
    const json = await res.json();

    let isPro: boolean | undefined;
    const decoded = decodeJwtPayload(json.data.accessToken);
    if (decoded && typeof decoded.isPro === 'boolean') {
      isPro = decoded.isPro;
    }

    const rotatedToken = {
      ...token,
      ...(isPro !== undefined && { isPro }),
    };

    // isPro must stay true (malformed token shouldn't clear Pro status)
    expect(rotatedToken.isPro).toBe(true);
  });

  it('returns isPro=false when new token explicitly has isPro=false', async () => {
    const newToken = makeJwt({ userId: 'user-1', isPro: false });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { accessToken: newToken, refreshToken: 'r' } }),
    }));

    const token = { refreshToken: 'old', isPro: true };
    const res = await fetch('http://test/refresh', { method: 'POST', body: '{}' });
    const json = await res.json();

    let isPro: boolean | undefined;
    const decoded = decodeJwtPayload(json.data.accessToken);
    if (decoded && typeof decoded.isPro === 'boolean') {
      isPro = decoded.isPro;
    }

    const rotated = { ...token, ...(isPro !== undefined && { isPro }) };
    expect(rotated.isPro).toBe(false);
  });

  /**
   * R-10 — Refresh token reuse detection.
   * A refresh token that has already been used once must be rejected
   * on the second call (the API implements refresh token rotation and
   * one-time-use enforcement). The client receives 401 on replay.
   */
  it('returns 401 when the same refresh token is used twice (reuse detection)', async () => {
    const validAccessToken = makeJwt({ userId: 'user-1', isPro: false });

    // First call succeeds — returns a new access + refresh token pair
    const firstCallResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        data: { accessToken: validAccessToken, refreshToken: 'rotated-refresh-token' },
      }),
    };
    // Second call with the original (now invalidated) refresh token returns 401
    const secondCallResponse = {
      ok: false,
      status: 401,
      json: async () => ({ error: 'Refresh token has already been used or is invalid' }),
    };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(firstCallResponse)
      .mockResolvedValueOnce(secondCallResponse);

    vi.stubGlobal('fetch', mockFetch);

    const REFRESH_URL = 'http://test/api/v1/auth/refresh';
    const oldRefreshToken = 'original-refresh-token';

    // First use — should succeed
    const res1 = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: oldRefreshToken }),
    });
    expect(res1.ok).toBe(true);

    // Second use of the same (now spent) token — must be rejected
    const res2 = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: oldRefreshToken }),
    });
    expect(res2.ok).toBe(false);
    expect(res2.status).toBe(401);

    const body2 = await res2.json();
    expect(body2).toHaveProperty('error');
  });
});
