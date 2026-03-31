import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { withRetry } from './retry';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAxiosError(status: number) {
  const err = new axios.AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_RESPONSE',
    undefined,
    undefined,
    {
      status,
      data: {},
      headers: {},
      config: {} as Parameters<typeof axios.AxiosError>[2],
      statusText: String(status),
    } as Parameters<typeof axios.AxiosError>[4],
  );
  return err;
}

function makeNetworkError() {
  const err = new axios.AxiosError('Network Error', 'ECONNREFUSED');
  // No err.response — simulates network-level failure
  return err;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// ─── Non-retryable errors ─────────────────────────────────────────────────────

describe('withRetry() — non-retryable', () => {
  it('HTTP 400 → throws immediately, fn called exactly once', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(makeAxiosError(400)));
    // Attach rejection handler immediately before any async work — prevents unhandled rejection warning
    const rejectExpect = expect(withRetry(fn)).rejects.toThrow();
    await vi.runAllTimersAsync();
    await rejectExpect;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('HTTP 404 → throws immediately, fn called exactly once', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(makeAxiosError(404)));
    const rejectExpect = expect(withRetry(fn)).rejects.toThrow();
    await vi.runAllTimersAsync();
    await rejectExpect;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('HTTP 401 → throws immediately, fn called exactly once', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(makeAxiosError(401)));
    const rejectExpect = expect(withRetry(fn)).rejects.toThrow();
    await vi.runAllTimersAsync();
    await rejectExpect;
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ─── Retryable errors ─────────────────────────────────────────────────────────

describe('withRetry() — retryable errors', () => {
  it('HTTP 429 → fn called 3 times total, throws after exhaustion', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(makeAxiosError(429)));
    const rejectExpect = expect(withRetry(fn)).rejects.toThrow();
    await vi.runAllTimersAsync();
    await rejectExpect;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('HTTP 500 → fn called 3 times total, throws after exhaustion', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(makeAxiosError(500)));
    const rejectExpect = expect(withRetry(fn)).rejects.toThrow();
    await vi.runAllTimersAsync();
    await rejectExpect;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('HTTP 503 → fn called 3 times total, throws after exhaustion', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(makeAxiosError(503)));
    const rejectExpect = expect(withRetry(fn)).rejects.toThrow();
    await vi.runAllTimersAsync();
    await rejectExpect;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('network error (no response) → retries 3 times, throws after exhaustion', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(makeNetworkError()));
    const rejectExpect = expect(withRetry(fn)).rejects.toThrow();
    await vi.runAllTimersAsync();
    await rejectExpect;
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// ─── Recovery ─────────────────────────────────────────────────────────────────

describe('withRetry() — success after retry', () => {
  it('succeeds on 2nd attempt → fn called twice, returns value', async () => {
    const fn = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(makeAxiosError(429)))
      .mockResolvedValueOnce({ data: 'ok' });

    const promise = withRetry(fn);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual({ data: 'ok' });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('succeeds on 3rd attempt → fn called 3 times, returns value', async () => {
    const fn = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(makeAxiosError(500)))
      .mockImplementationOnce(() => Promise.reject(makeAxiosError(503)))
      .mockResolvedValueOnce('success');

    const promise = withRetry(fn);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// ─── Custom options ───────────────────────────────────────────────────────────

describe('withRetry() — custom options', () => {
  it('maxAttempts=1 → fn called once even for 429', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(makeAxiosError(429)));
    const rejectExpect = expect(withRetry(fn, { maxAttempts: 1 })).rejects.toThrow();
    await vi.runAllTimersAsync();
    await rejectExpect;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('maxAttempts=5 → fn called 5 times for persistent 429', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(makeAxiosError(429)));
    const rejectExpect = expect(withRetry(fn, { maxAttempts: 5 })).rejects.toThrow();
    await vi.runAllTimersAsync();
    await rejectExpect;
    expect(fn).toHaveBeenCalledTimes(5);
  });
});

// ─── Backoff timing ───────────────────────────────────────────────────────────

describe('withRetry() — backoff delays', () => {
  it('fn not called before delay elapses (attempt 2 waits 100ms)', async () => {
    // P-5 fix: pin Math.random so jitter factor = 1.0, keeping exact-timing assertion valid
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const fn = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(makeAxiosError(429)))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { baseDelayMs: 100 });

    // P-9 fix: await microtask queue so assertion is resilient to async-first implementations
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);

    // Advance 99ms — still waiting for retry
    await vi.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1);

    // Advance 1ms more (total 100ms) — retry fires
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('3rd attempt waits cumulative 100ms + 200ms before firing', async () => {
    // P-5 fix: pin Math.random so jitter factor = 1.0, keeping exact-timing assertion valid
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const fn = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(makeAxiosError(429)))
      .mockImplementationOnce(() => Promise.reject(makeAxiosError(429)))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { baseDelayMs: 100 });

    // P-9 fix: await microtask queue before synchronous call-count assertion
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1); // immediate

    // After first delay (100ms) — 2nd call
    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(2);

    // After second delay (200ms) — 3rd call
    await vi.advanceTimersByTimeAsync(200);
    await promise;
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
