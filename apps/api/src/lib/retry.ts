import axios from 'axios';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Retries an async function with exponential backoff on transient upstream errors.
 *
 * Retryable:
 *   - HTTP 429 (rate limited)
 *   - HTTP 5xx (server error)
 *   - Network errors (no response — ECONNREFUSED, ETIMEDOUT, etc.)
 *
 * Non-retryable:
 *   - HTTP 4xx (except 429) — these are client errors; retrying won't help
 *   - Non-Axios errors — rethrow immediately
 *
 * Backoff: baseDelayMs * 2^(attempt-1) * jitter  (50–100% random factor, P-5)
 *   - Attempt 1 (original): immediate
 *   - Attempt 2 (retry 1):  50–100ms   (default base 100ms)
 *   - Attempt 3 (retry 2):  100–200ms  (default base 200ms)
 *   P-6: if a 429 response includes a Retry-After header, that value (seconds)
 *        overrides the computed backoff for that sleep interval.
 *
 * @param fn         The async function to call. Must be idempotent.
 * @param opts.maxAttempts  Total attempts including the first call (default 3)
 * @param opts.baseDelayMs  Base delay in ms for exponential backoff (default 100)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 100 } = opts;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;

        // Non-retryable: 4xx client errors except 429 (rate limit)
        if (status !== undefined && status >= 400 && status < 500 && status !== 429) {
          throw err;
        }
        // Retryable: 429, 5xx, and no response (network error) — fall through to sleep
      } else {
        // Non-Axios errors (programming errors, etc.) — rethrow immediately
        throw err;
      }

      // Do not sleep after the last attempt
      if (attempt < maxAttempts) {
        // P-5: jitter (50–100%) prevents thundering herd on burst failures
        let delayMs = baseDelayMs * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5);

        // P-6: respect Retry-After header on 429 (server-directed backoff takes precedence)
        if (err.response?.status === 429) {
          const retryAfterRaw = err.response.headers?.['retry-after'];
          if (retryAfterRaw) {
            const retryAfterSec = parseFloat(String(retryAfterRaw));
            if (!isNaN(retryAfterSec) && retryAfterSec > 0) {
              delayMs = retryAfterSec * 1000;
            }
          }
        }

        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}
