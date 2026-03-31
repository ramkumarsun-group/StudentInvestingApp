import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../config/logger';

const MAX_PROPERTIES = 20;

/**
 * P-1: PII term blocklist — checked against individual segments of a key.
 *
 * Algorithm:
 *   1. Normalise camelCase → snake_case  ("firstName" → "first_name")
 *   2. Split on separator chars (_, -, .)   → ["first", "name"]
 *   3. Reject if ANY single segment is in this set
 *   4. Also check consecutive-pair compounds  ("user"+"id" → "userid")
 *
 * This catches standalone keys ("name", "phone"), compound snake_case
 * ("phone_number", "ip_address"), camelCase ("emailAddress", "firstName"),
 * and hyphenated/dot forms ("user-id", "user.name").
 */
const PII_SEGMENTS = new Set([
  'email',
  'phone',
  'name',
  'firstname', 'lastname', 'fullname', 'displayname', 'givenname', 'familyname',
  'username',
  'userid', 'studentid', 'uid',
  'ip', 'ipaddr', 'ipaddress',
  'dob', 'birth', 'birthdate', 'dateofbirth',
  'ssn',
  'address',
]);

function hasPiiKey(key: string): boolean {
  // Normalise camelCase → snake_case, then lowercase
  const normalized = key.replace(/([A-Z])/g, '_$1').toLowerCase();
  // Split on separator chars and drop empty strings
  const segments = normalized.split(/[_\-.]/).filter(Boolean);

  // Check individual segments
  if (segments.some(s => PII_SEGMENTS.has(s))) return true;

  // Check consecutive-pair compounds (e.g. ["user","id"] → "userid")
  for (let i = 0; i < segments.length - 1; i++) {
    if (PII_SEGMENTS.has(segments[i] + segments[i + 1])) return true;
  }

  return false;
}

/**
 * P-2: Value-level PII pattern.
 * Catches: email addresses, UUID v4 (common userId format), and long numeric
 * runs (phone numbers, SSNs).  Even a benign-named key can carry PII in its
 * value, so both key and value are checked.
 */
const PII_VALUE_PATTERN =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\b\d{9,}\b/i;

const trackEventSchema = z.object({
  /**
   * P-5: Constrain event name to safe characters.
   * Must start with a letter; only [a-z0-9_:.-] allowed.
   * Prevents log-injection via newlines, ANSI codes, or JSON fragments.
   */
  event: z
    .string()
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_:.-]{0,99}$/,
      'Event name must start with a letter and contain only alphanumeric, underscore, colon, dot, or hyphen characters.',
    ),
  /**
   * P-6: Cap key/value lengths to prevent memory/log DoS.
   * Key count is enforced imperatively after parse (see below).
   */
  properties: z
    .record(
      z.string().min(1).max(64),  // key: 1–64 chars
      z.string().max(500),         // value: max 500 chars
    )
    .optional(),
});

export async function trackEvent(req: Request, res: Response) {
  const body = trackEventSchema.safeParse(req.body);
  if (!body.success) {
    return res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid analytics payload.' } });
  }

  const { event, properties } = body.data;

  // P-6: Reject oversized property objects to prevent log/CPU DoS.
  if (properties && Object.keys(properties).length > MAX_PROPERTIES) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: `Too many properties (max ${MAX_PROPERTIES}).` },
    });
  }

  if (properties) {
    // P-1: Check keys against expanded PII segment blocklist.
    if (Object.keys(properties).some(hasPiiKey)) {
      // P-7: Generic message — do NOT echo the key name back (prevents regex enumeration).
      return res.status(400).json({
        error: {
          code: 'ANALYTICS_PII_REJECTED',
          message: 'One or more properties contain disallowed field names.',
        },
      });
    }

    // P-2: Check values for recognisable PII patterns.
    const hasPiiValue = Object.values(properties).some(v => PII_VALUE_PATTERN.test(v));
    if (hasPiiValue) {
      return res.status(400).json({
        error: {
          code: 'ANALYTICS_PII_REJECTED',
          message: 'One or more property values appear to contain PII and are not allowed.',
        },
      });
    }
  }

  logger.info('analytics_event', { event, properties: properties ?? {} });
  return res.status(204).send();
}
