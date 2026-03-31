import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock logger BEFORE importing the controller (hoisting requirement).
vi.mock('../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { trackEvent } from './analytics.controller';
import { logger } from '../config/logger';

// P-26 fix: recreate mockRes in beforeEach so state never bleeds between tests.
let mockRes: Response;

function makeMockRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

function makeReq(body: unknown): Request {
  return { body } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRes = makeMockRes();
});

// ─── Generic helpers ──────────────────────────────────────────────────────────

const PII_REJECTED = {
  error: expect.objectContaining({ code: 'ANALYTICS_PII_REJECTED' }),
};

const VALIDATION_ERROR = {
  error: { code: 'VALIDATION_ERROR', message: 'Invalid analytics payload.' },
};

// ─── Happy paths ──────────────────────────────────────────────────────────────

describe('trackEvent() — happy paths', () => {
  it('valid event with no properties → 204, logger.info called', async () => {
    await trackEvent(makeReq({ event: 'page_view' }), mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(204);
    expect(mockRes.send).toHaveBeenCalled();
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('analytics_event', {
      event: 'page_view',
      properties: {},
    });
  });

  it('valid event with non-PII properties → 204, passes through', async () => {
    await trackEvent(
      makeReq({ event: 'button_click', properties: { page: 'dashboard', action: 'buy' } }),
      mockRes,
    );
    expect(mockRes.status).toHaveBeenCalledWith(204);
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('analytics_event', {
      event: 'button_click',
      properties: { page: 'dashboard', action: 'buy' },
    });
  });

  it('event with colon/dot/hyphen chars → 204 (valid format)', async () => {
    await trackEvent(makeReq({ event: 'module:lesson.start' }), mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(204);
  });
});

// ─── Validation errors ────────────────────────────────────────────────────────

describe('trackEvent() — validation errors', () => {
  it('missing event field → 400 VALIDATION_ERROR', async () => {
    await trackEvent(makeReq({ properties: { page: 'home' } }), mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(VALIDATION_ERROR);
    expect(vi.mocked(logger.info)).not.toHaveBeenCalled();
  });

  // P-5: whitespace-only event name is rejected by the new regex
  it('whitespace-only event name → 400 VALIDATION_ERROR', async () => {
    await trackEvent(makeReq({ event: '   ' }), mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(VALIDATION_ERROR);
  });

  // P-5: event name starting with a digit is rejected
  it('event name starting with digit → 400 VALIDATION_ERROR', async () => {
    await trackEvent(makeReq({ event: '1_page_view' }), mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(VALIDATION_ERROR);
  });

  // P-5: newline in event name is rejected (log injection prevention)
  it('event name with newline → 400 VALIDATION_ERROR', async () => {
    await trackEvent(makeReq({ event: 'page_view\nhijacked_log_line' }), mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(VALIDATION_ERROR);
  });

  // P-6: more than 20 properties → 400
  it('21 properties → 400 VALIDATION_ERROR (too many properties)', async () => {
    const tooMany: Record<string, string> = {};
    for (let i = 0; i < 21; i++) tooMany[`prop${i}`] = 'value';
    await trackEvent(makeReq({ event: 'page_view', properties: tooMany }), mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
  });

  // P-6: key longer than 64 chars → 400
  it('property key >64 chars → 400 VALIDATION_ERROR', async () => {
    const longKey = 'a'.repeat(65);
    await trackEvent(makeReq({ event: 'page_view', properties: { [longKey]: 'val' } }), mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(VALIDATION_ERROR);
  });
});

// ─── PII key rejection ────────────────────────────────────────────────────────

describe('trackEvent() — PII key rejection (P-1)', () => {
  // Original spec-required cases
  it('exact key "email" → 400 ANALYTICS_PII_REJECTED', async () => {
    await trackEvent(
      makeReq({ event: 'signup', properties: { email: 'user@example.com' } }),
      mockRes,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(PII_REJECTED);
    expect(vi.mocked(logger.info)).not.toHaveBeenCalled();
  });

  it('exact key "userId" → 400 ANALYTICS_PII_REJECTED', async () => {
    await trackEvent(makeReq({ event: 'login', properties: { userId: 'abc-123' } }), mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(PII_REJECTED);
  });

  it('exact key "name" → 400 ANALYTICS_PII_REJECTED', async () => {
    await trackEvent(
      makeReq({ event: 'profile_view', properties: { name: 'Alice' } }),
      mockRes,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(PII_REJECTED);
  });

  // P-1 expanded: camelCase variants
  it('camelCase key "firstName" → 400 ANALYTICS_PII_REJECTED', async () => {
    await trackEvent(makeReq({ event: 'signup', properties: { firstName: 'Alice' } }), mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(PII_REJECTED);
  });

  it('camelCase key "emailAddress" → 400 ANALYTICS_PII_REJECTED', async () => {
    await trackEvent(
      makeReq({ event: 'signup', properties: { emailAddress: 'x@y.com' } }),
      mockRes,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(PII_REJECTED);
  });

  it('snake_case key "ip_address" → 400 ANALYTICS_PII_REJECTED', async () => {
    await trackEvent(
      makeReq({ event: 'login', properties: { ip_address: '1.2.3.4' } }),
      mockRes,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(PII_REJECTED);
  });

  it('key "phone_number" → 400 ANALYTICS_PII_REJECTED', async () => {
    await trackEvent(
      makeReq({ event: 'verify', properties: { phone_number: '555-1234' } }),
      mockRes,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(PII_REJECTED);
  });

  it('key "dateOfBirth" → 400 ANALYTICS_PII_REJECTED', async () => {
    await trackEvent(
      makeReq({ event: 'register', properties: { dateOfBirth: '2010-01-01' } }),
      mockRes,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(PII_REJECTED);
  });

  // P-7: error message is generic — does NOT echo the key name back
  it('PII key error message is generic (no key echo)', async () => {
    await trackEvent(
      makeReq({ event: 'signup', properties: { email: 'x@x.com' } }),
      mockRes,
    );
    const callArg = (mockRes.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.error.message).not.toContain('email');
    expect(callArg.error.message).toMatch(/disallowed field names/i);
  });
});

// ─── PII value rejection ──────────────────────────────────────────────────────

describe('trackEvent() — PII value rejection (P-2)', () => {
  it('value containing email address → 400 ANALYTICS_PII_REJECTED', async () => {
    await trackEvent(
      makeReq({ event: 'page_view', properties: { ref: 'student@school.edu' } }),
      mockRes,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(PII_REJECTED);
    expect(vi.mocked(logger.info)).not.toHaveBeenCalled();
  });

  it('value containing UUID (user ID format) → 400 ANALYTICS_PII_REJECTED', async () => {
    await trackEvent(
      makeReq({
        event: 'page_view',
        properties: { ctx: '550e8400-e29b-41d4-a716-446655440000' },
      }),
      mockRes,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(PII_REJECTED);
  });

  it('value containing long digit run (phone/SSN) → 400 ANALYTICS_PII_REJECTED', async () => {
    await trackEvent(
      makeReq({ event: 'page_view', properties: { data: '5551234567' } }),
      mockRes,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(PII_REJECTED);
  });

  it('safe numeric value (short) → 204, passes through', async () => {
    await trackEvent(makeReq({ event: 'page_view', properties: { count: '42' } }), mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(204);
  });
});
