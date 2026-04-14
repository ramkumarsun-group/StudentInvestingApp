export interface BadgeCardOptions {
  name: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  username: string;
}

const RARITY_GRADIENTS: Record<string, [string, string]> = {
  common:    ['#374151', '#1f2937'],
  rare:      ['#1e3a5f', '#1e40af'],
  epic:      ['#3b0764', '#6d28d9'],
  legendary: ['#78350f', '#b45309'],
};

/**
 * P8: roundRect compatibility shim — ctx.roundRect absent in Safari < 15.4 and Chrome < 99.
 */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  if (typeof (ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect === 'function') {
    (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

export async function generateBadgeCard(opts: BadgeCardOptions): Promise<Blob> {
  const SIZE = 280;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // Background gradient
  const [c1, c2] = RARITY_GRADIENTS[opts.rarity] ?? RARITY_GRADIENTS.common;
  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.beginPath();
  // P8: use compat shim instead of ctx.roundRect directly
  roundedRect(ctx, 0, 0, SIZE, SIZE, 16);
  ctx.fill();

  // Badge icon (emoji)
  ctx.font = '64px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(opts.icon, SIZE / 2, SIZE / 2 - 20);

  // Badge name
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(opts.name, SIZE / 2, SIZE / 2 + 50);

  // Username + branding
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(`${opts.username} • StockPlay`, SIZE / 2, SIZE - 20);

  // P1: toBlob can return null in error conditions; reject instead of crashing with b!
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))), 'image/png'),
  );
}
