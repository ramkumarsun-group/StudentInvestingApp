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
