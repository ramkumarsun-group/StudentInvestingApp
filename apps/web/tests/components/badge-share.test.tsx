/**
 * P1-007 + P2-001 through P2-005 — Badge card canvas and share behavior.
 * @P1 @P2 @Component
 *
 * P1-007 — generateBadgeCard canvas utility:
 * 1. Returns a non-null Blob when canvas.toBlob succeeds
 * 2. roundRect shim fires when native support is absent
 * 3. Native ctx.roundRect is called when present
 * 4. Rejects when canvas.toBlob returns null (P2-001)
 *
 * P2-002 — roundRect shim draws correct path with moveTo coordinates
 * P2-003 — Firefox fallback: body-appended anchor before .click()
 * P2-004 — URL.revokeObjectURL deferred 100ms after download click
 * P2-005 — Web Share API AbortError is swallowed silently
 *
 * Runs in 'node' environment using manual global stubs.
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadBadgeCard, shareBadge } from '@/lib/badge-share';

// ── Canvas mock ────────────────────────────────────────────────────────────────
function makeMockCtx(hasRoundRect = false) {
  const ctx = {
    createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    fillStyle: '',
    font: '',
    textAlign: 'center' as CanvasTextAlign,
    textBaseline: 'middle' as CanvasTextBaseline,
    beginPath: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    // roundRect is conditionally present — simulates browser support detection
    ...(hasRoundRect ? { roundRect: vi.fn() } : {}),
  };
  return ctx;
}

// Minimal global stubs so generateBadgeCard can call document.createElement
let mockCtx: ReturnType<typeof makeMockCtx>;
let mockToBlob: ReturnType<typeof vi.fn>;

function stubGlobals(hasRoundRect = false, blobValue: Blob | null = new Blob()) {
  mockCtx = makeMockCtx(hasRoundRect);
  mockToBlob = vi.fn().mockImplementation((cb: (b: Blob | null) => void) => cb(blobValue));

  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(mockCtx),
    toBlob: mockToBlob,
  };

  vi.stubGlobal('document', {
    createElement: vi.fn().mockReturnValue(mockCanvas),
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generateBadgeCard (P1-007)', () => {
  it('returns a non-null Blob when canvas.toBlob succeeds', async () => {
    stubGlobals(true, new Blob(['fake-png'], { type: 'image/png' }));
    const { generateBadgeCard } = await import('@/lib/badge-card');
    const blob = await generateBadgeCard({ name: 'First Trade', icon: '🏆', rarity: 'common', username: 'alice' });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('roundRect shim uses path commands when ctx.roundRect is absent', async () => {
    stubGlobals(false); // no roundRect on ctx
    const { generateBadgeCard } = await import('@/lib/badge-card');
    await generateBadgeCard({ name: 'Rare Badge', icon: '⭐', rarity: 'rare', username: 'bob' });

    // The shim path: moveTo + 4× lineTo + 4× quadraticCurveTo + closePath
    expect(mockCtx.moveTo).toHaveBeenCalled();
    expect(mockCtx.lineTo).toHaveBeenCalled();
    expect(mockCtx.quadraticCurveTo).toHaveBeenCalled();
    expect(mockCtx.closePath).toHaveBeenCalled();
    // Native roundRect must NOT have been called
    expect((mockCtx as { roundRect?: ReturnType<typeof vi.fn> }).roundRect).toBeUndefined();
  });

  it('uses native ctx.roundRect when it is present', async () => {
    stubGlobals(true); // roundRect exists
    const { generateBadgeCard } = await import('@/lib/badge-card');
    await generateBadgeCard({ name: 'Epic Badge', icon: '💎', rarity: 'epic', username: 'carol' });

    expect((mockCtx as { roundRect?: ReturnType<typeof vi.fn> }).roundRect).toHaveBeenCalled();
    // Shim path should NOT fire when native is present
    expect(mockCtx.moveTo).not.toHaveBeenCalled();
  });

  it('rejects when canvas.toBlob returns null', async () => {
    stubGlobals(true, null); // toBlob returns null
    const { generateBadgeCard } = await import('@/lib/badge-card');
    await expect(
      generateBadgeCard({ name: 'Legend', icon: '🌟', rarity: 'legendary', username: 'dave' }),
    ).rejects.toThrow('canvas.toBlob returned null');
  });

  it('does not throw for all four rarity values', async () => {
    const rarities = ['common', 'rare', 'epic', 'legendary'] as const;
    for (const rarity of rarities) {
      stubGlobals(true, new Blob());
      vi.resetModules();
      const { generateBadgeCard } = await import('@/lib/badge-card');
      await expect(
        generateBadgeCard({ name: rarity, icon: '🏅', rarity, username: 'tester' }),
      ).resolves.toBeInstanceOf(Blob);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P2-002 — roundRect shim correctness
// ─────────────────────────────────────────────────────────────────────────────
describe('roundRect shim path correctness (P2-002)', () => {
  it('shim starts path with moveTo(x+r, y) — correct starting corner', async () => {
    stubGlobals(false); // no native roundRect
    const { generateBadgeCard } = await import('@/lib/badge-card');
    await generateBadgeCard({ name: 'Shim Badge', icon: '🔷', rarity: 'common', username: 'u1' });

    // The shim calls moveTo(x+r, y) as the starting point — x=0, y=0, r=16
    // so first moveTo call should be (16, 0)
    const firstMoveTo = mockCtx.moveTo.mock.calls[0];
    expect(firstMoveTo).toEqual([16, 0]); // x+r=0+16, y=0

    // closePath must be called to complete the rounded rectangle path
    expect(mockCtx.closePath).toHaveBeenCalledOnce();
  });

  it('shim calls exactly 4 lineTo segments (one per side)', async () => {
    stubGlobals(false);
    const { generateBadgeCard } = await import('@/lib/badge-card');
    await generateBadgeCard({ name: 'Shim Badge 2', icon: '🔷', rarity: 'common', username: 'u2' });

    // A rounded rectangle has 4 straight sides → 4 lineTo calls
    expect(mockCtx.lineTo).toHaveBeenCalledTimes(4);
  });

  it('shim calls exactly 4 quadraticCurveTo arcs (one per corner)', async () => {
    stubGlobals(false);
    const { generateBadgeCard } = await import('@/lib/badge-card');
    await generateBadgeCard({ name: 'Shim Badge 3', icon: '🔷', rarity: 'common', username: 'u3' });

    // A rounded rectangle has 4 corners → 4 quadraticCurveTo calls
    expect(mockCtx.quadraticCurveTo).toHaveBeenCalledTimes(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P2-003 — Firefox fallback: body-appended anchor
// P2-004 — URL.revokeObjectURL deferred 100ms
// P2-005 — AbortError swallowed silently
//
// These test the exported utility functions from @/lib/badge-share,
// which are used by BadgeCard.handleShare in badges/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────

describe('badge download — Firefox anchor fallback (P2-003)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('document.body.appendChild is called before anchor.click()', async () => {
    vi.useFakeTimers();
    const callOrder: string[] = [];

    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(() => callOrder.push('click')),
    };

    const appendSpy = vi.fn((el: unknown) => {
      void el;
      callOrder.push('appendChild');
    });
    const removeSpy = vi.fn();

    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue(mockAnchor),
      body: { appendChild: appendSpy, removeChild: removeSpy },
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:fake-url'),
      revokeObjectURL: vi.fn(),
    });

    const blob = new Blob(['fake'], { type: 'image/png' });
    void downloadBadgeCard(blob, 'first-trade-badge.png');

    // appendChild must come BEFORE click in the call order
    expect(callOrder.indexOf('appendChild')).toBeLessThan(callOrder.indexOf('click'));
    expect(appendSpy).toHaveBeenCalledWith(mockAnchor);
    expect(mockAnchor.click).toHaveBeenCalledOnce();
  });

  it('anchor.download filename contains the badge slug', async () => {
    vi.useFakeTimers();
    const mockAnchor = { href: '', download: '', click: vi.fn() };
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue(mockAnchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:fake-url'),
      revokeObjectURL: vi.fn(),
    });

    const blob = new Blob(['png']);
    void downloadBadgeCard(blob, 'first-trade-badge.png');

    expect(mockAnchor.download).toContain('badge.png');
  });
});

describe('badge download — URL.revokeObjectURL deferred 100ms (P2-004)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('URL.revokeObjectURL is NOT called immediately after download click', () => {
    vi.useFakeTimers();
    const revokeSpy = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:fake-url'),
      revokeObjectURL: revokeSpy,
    });
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue({ href: '', download: '', click: vi.fn() }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });

    const blob = new Blob(['png']);
    void downloadBadgeCard(blob, 'test-badge.png');

    // Should NOT have been called yet (still within the setTimeout delay)
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it('URL.revokeObjectURL is called exactly once after 100ms', () => {
    vi.useFakeTimers();
    const revokeSpy = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:fake-url'),
      revokeObjectURL: revokeSpy,
    });
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue({ href: '', download: '', click: vi.fn() }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });

    const blob = new Blob(['png']);
    void downloadBadgeCard(blob, 'test-badge.png');

    // Advance fake timers by exactly 100ms — revoke should fire now
    vi.advanceTimersByTime(100);
    expect(revokeSpy).toHaveBeenCalledOnce();
  });

  it('URL.revokeObjectURL is NOT called at 99ms (strictly deferred)', () => {
    vi.useFakeTimers();
    const revokeSpy = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:fake-url'),
      revokeObjectURL: revokeSpy,
    });
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue({ href: '', download: '', click: vi.fn() }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });

    const blob = new Blob(['png']);
    void downloadBadgeCard(blob, 'test-badge.png');

    vi.advanceTimersByTime(99); // one millisecond short
    expect(revokeSpy).not.toHaveBeenCalled();
  });
});

describe('Web Share API — AbortError swallowed silently (P2-005)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not call console.error when navigator.share throws AbortError', async () => {
    const consoleSpy = vi.spyOn(console, 'error');
    const abortError = Object.assign(new Error('The share was cancelled'), { name: 'AbortError' });

    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(abortError),
    });

    await shareBadge({ text: 'I earned a badge!' });

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('calls console.error when navigator.share throws a non-AbortError', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const networkError = Object.assign(new Error('Network error'), { name: 'NetworkError' });

    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(networkError),
    });

    await shareBadge({ text: 'I earned a badge!' });

    expect(consoleSpy).toHaveBeenCalledWith('Badge share failed:', networkError);
  });

  it('resolves without throwing when share is cancelled by user', async () => {
    const abortError = Object.assign(new Error('Cancelled'), { name: 'AbortError' });

    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(abortError),
    });

    // Must NOT throw — user cancelling share is not an error
    await expect(shareBadge({ text: 'Badge' })).resolves.toBeUndefined();
  });
});
