export function calcPnl(currentPrice: number, avgCost: number, quantity: number) {
  const marketValue = currentPrice * quantity;
  const costBasis = avgCost * quantity;
  const unrealizedPnl = marketValue - costBasis;
  const unrealizedPnlPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
  return { marketValue, unrealizedPnl, unrealizedPnlPct };
}

export function calcWeightedAvgCost(
  existingQty: number,
  existingAvgCost: number,
  newQty: number,
  newPrice: number,
): number {
  const totalCost = existingQty * existingAvgCost + newQty * newPrice;
  const totalQty = existingQty + newQty;
  return totalQty > 0 ? totalCost / totalQty : 0;
}

export function calcAllocationPct(holdings: { marketValue: number }[], totalValue: number) {
  return holdings.map((h) => ({
    ...h,
    allocationPct: totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0,
  }));
}

export function calcReturnPct(currentValue: number, startingValue: number): number {
  if (startingValue === 0) return 0;
  return ((currentValue - startingValue) / startingValue) * 100;
}

const SPREAD_PCT = 0.001; // 0.1% simulated spread — matches order.service.ts

/**
 * Apply the simulated paper-trading spread to a market price.
 *
 * Buy orders fill slightly above market (taker spread).
 * Sell orders fill slightly below market (bid spread).
 * Zero price returns zero to avoid NaN in downstream calculations.
 */
export function applySpread(price: number, side: 'buy' | 'sell'): number {
  if (price === 0) return 0;
  return side === 'buy' ? price * (1 + SPREAD_PCT) : price * (1 - SPREAD_PCT);
}
