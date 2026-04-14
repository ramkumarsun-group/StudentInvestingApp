import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Mock Canvas API in Node environment (document not available)
const mockFillText = vi.fn();
const mockContext = {
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fillStyle: '' as string,
  beginPath: vi.fn(),
  roundRect: vi.fn(),
  fill: vi.fn(),
  font: '' as string,
  textAlign: '' as string,
  textBaseline: '' as string,
  fillText: mockFillText,
};

const mockCanvas = {
  width: 0,
  height: 0,
  getContext: () => mockContext,
  toBlob: (cb: (b: Blob) => void) => cb(new Blob(['png'], { type: 'image/png' })),
};

beforeAll(() => {
  // Provide a minimal document.createElement mock for the Node environment
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
      // For the download anchor fallback in handleShare (not tested here)
      return { href: '', download: '', click: vi.fn() } as unknown as HTMLElement;
    },
  });
});

import { generateBadgeCard } from './badge-card';

describe('generateBadgeCard()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a Blob', async () => {
    const blob = await generateBadgeCard({
      name: 'First Trade', icon: '🏆', rarity: 'common', username: 'Alice',
    });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('draws the badge name text', async () => {
    await generateBadgeCard({ name: 'First Trade', icon: '🏆', rarity: 'common', username: 'Alice' });
    expect(mockFillText).toHaveBeenCalledWith('First Trade', expect.any(Number), expect.any(Number));
  });

  it('draws username and branding watermark', async () => {
    await generateBadgeCard({ name: 'First Trade', icon: '🏆', rarity: 'common', username: 'Alice' });
    expect(mockFillText).toHaveBeenCalledWith('Alice • StockPlay', expect.any(Number), expect.any(Number));
  });
});
