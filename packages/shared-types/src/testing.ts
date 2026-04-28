/**
 * Test fixture payload types — shared across E2E, integration, and unit test utilities.
 * These types mirror the POST /api/v1/test/seed request body shape.
 * P-10: Centralised here so factories.ts and any future test helpers share one source of truth.
 */

/** Payload used to seed a student user via POST /api/v1/test/seed */
export interface StudentPayload {
  email: string;
  password: string;
  username: string;
  /** ISO date — must be 18+ to avoid under-18 flag */
  dateOfBirth: string;
  /** Optional: override initial portfolio total value (for leaderboard tests) */
  portfolioValue?: number;
  /** Optional: seed an active Pro subscription */
  isPro?: boolean;
  /** Optional: ISO date for streak last_activity_date seeding */
  streakLastDate?: string;
}

/** Payload used to simulate a trade action in E2E tests */
export interface TradePayload {
  symbol: string;
  action: 'buy' | 'sell';
  shares: number;
}

/** Payload used to describe a seeded portfolio state */
export interface PortfolioSeedPayload {
  cashBalance: number;
  holdings?: HoldingPayload[];
}

/** Payload used to seed an individual portfolio holding */
export interface HoldingPayload {
  symbol: string;
  assetType: 'stock' | 'etf' | 'crypto';
  shares: number;
  avgCost: number;
}
