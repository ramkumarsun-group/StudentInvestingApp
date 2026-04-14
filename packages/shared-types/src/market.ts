export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume?: number;
  marketCap?: number;
  high24h?: number;
  low24h?: number;
  assetType: 'stock' | 'etf' | 'crypto' | 'bond';
  updatedAt: string;
}

export interface OHLCVBar {
  t: string; // ISO timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  imageUrl?: string;
  publishedAt: string;
  tickers?: string[];
}

export interface SearchResult {
  symbol: string;
  name: string;
  assetType: 'stock' | 'etf' | 'crypto' | 'bond';
  exchange?: string;
  price?: number;
}
