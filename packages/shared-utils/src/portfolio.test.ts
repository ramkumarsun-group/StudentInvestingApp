/**
 * P1-005 — applySpread() returns price within ±0.1% boundary.
 * @P1 @Unit
 *
 * Verifies the simulated paper-trading spread function:
 * - Buy fill: market price × (1 + 0.001)   → within (price, price * 1.001]
 * - Sell fill: market price × (1 - 0.001)  → within [price * 0.999, price)
 * - Zero price → 0 (no NaN)
 * - Boundary exact: price * 1.001 and price * 0.999 are the maximum deviations
 */
import { describe, it, expect } from 'vitest';
import { applySpread } from './portfolio-math';

const SPREAD_PCT = 0.001; // 0.1%

describe('applySpread (P1-005)', () => {
  it('buy fill is greater than market price (taker spread applied)', () => {
    const fill = applySpread(100.0, 'buy');
    expect(fill).toBeGreaterThan(100.0);
  });

  it('buy fill is within ±0.1% above market price', () => {
    const price = 100.0;
    const fill = applySpread(price, 'buy');
    expect(fill).toBeGreaterThanOrEqual(price);
    expect(fill).toBeLessThanOrEqual(price * (1 + SPREAD_PCT));
  });

  it('sell fill is less than market price (bid spread applied)', () => {
    const fill = applySpread(100.0, 'sell');
    expect(fill).toBeLessThan(100.0);
  });

  it('sell fill is within ±0.1% below market price', () => {
    const price = 100.0;
    const fill = applySpread(price, 'sell');
    expect(fill).toBeGreaterThanOrEqual(price * (1 - SPREAD_PCT));
    expect(fill).toBeLessThanOrEqual(price);
  });

  it('zero price returns 0 for buy (no NaN/Infinity)', () => {
    expect(applySpread(0, 'buy')).toBe(0);
  });

  it('zero price returns 0 for sell (no NaN/Infinity)', () => {
    expect(applySpread(0, 'sell')).toBe(0);
  });

  it('buy spread matches exact 0.1% formula', () => {
    expect(applySpread(100.0, 'buy')).toBe(100.1);
  });

  it('sell spread matches exact 0.1% formula', () => {
    expect(applySpread(100.0, 'sell')).toBe(99.9);
  });

  it('high-price stock (NVDA ~$900) stays within boundary', () => {
    const price = 900.0;
    const buyFill = applySpread(price, 'buy');
    const sellFill = applySpread(price, 'sell');
    expect(buyFill).toBeLessThanOrEqual(price * 1.001);
    expect(sellFill).toBeGreaterThanOrEqual(price * 0.999);
  });

  it('fractional price (crypto: $0.0001) stays within boundary', () => {
    const price = 0.0001;
    const buyFill = applySpread(price, 'buy');
    expect(buyFill).toBeGreaterThan(price);
    expect(buyFill).toBeLessThanOrEqual(price * 1.001);
  });
});
