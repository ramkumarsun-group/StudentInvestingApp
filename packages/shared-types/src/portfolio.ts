export type AssetType = 'stock' | 'etf' | 'crypto' | 'bond';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus = 'pending' | 'filled' | 'cancelled';

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  virtualCash: number;
  totalValue: number;
  totalReturnPct: number;
  createdAt: string;
  updatedAt: string;
}

export interface Holding {
  id: string;
  portfolioId: string;
  symbol: string;
  assetType: AssetType;
  quantity: number;
  avgCostBasis: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  updatedAt: string;
}

export interface Order {
  id: string;
  portfolioId: string;
  symbol: string;
  assetType: AssetType;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  limitPrice?: number;
  fillPrice?: number;
  fillQuantity?: number;
  status: OrderStatus;
  totalValue?: number;
  errorMessage?: string;
  placedAt: string;
  filledAt?: string;
}

export interface PortfolioPerformance {
  totalValue: number;
  totalReturnPct: number;
  totalReturnUsd: number;
  virtualCash: number;
  investedValue: number;
  allocation: AllocationSlice[];
}

export interface AllocationSlice {
  assetType: AssetType;
  symbol?: string;
  pct: number;
  value: number;
}

export interface PortfolioHistoryPoint {
  date: string;
  value: number;
  returnPct: number;
}
