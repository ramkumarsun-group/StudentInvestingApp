import { faker } from '@faker-js/faker';

/**
 * Test data factories for StockPlay E2E and integration tests.
 * All factories return plain objects suitable for seeding via POST /api/v1/test/seed.
 */

export interface StudentPayload {
  email: string;
  password: string;
  username: string;
  displayName: string;
  dateOfBirth: string; // ISO date — must be 18+ to avoid minor flag
}

export interface TradePayload {
  symbol: string;
  action: 'buy' | 'sell';
  shares: number;
}

export interface PortfolioSeedPayload {
  cashBalance: number;
  holdings?: HoldingPayload[];
}

export interface HoldingPayload {
  symbol: string;
  assetType: 'stock' | 'etf' | 'crypto';
  shares: number;
  avgCost: number;
}

/**
 * Creates a student payload suitable for seeding.
 * DOB is always 20 years ago to avoid under-18 flag.
 */
export function createStudent(overrides: Partial<StudentPayload> = {}): StudentPayload {
  const username = faker.internet.username().replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - 20);

  return {
    email: faker.internet.email().toLowerCase(),
    password: 'Password123!',
    username,
    displayName: faker.person.fullName(),
    dateOfBirth: dob.toISOString().split('T')[0],
    ...overrides,
  };
}

/**
 * Creates a trade payload.
 */
export function createTrade(overrides: Partial<TradePayload> = {}): TradePayload {
  return {
    symbol: 'AAPL',
    action: 'buy',
    shares: 1,
    ...overrides,
  };
}

/**
 * Creates a portfolio seed payload.
 */
export function createPortfolio(overrides: Partial<PortfolioSeedPayload> = {}): PortfolioSeedPayload {
  return {
    cashBalance: 100_000,
    holdings: [],
    ...overrides,
  };
}

/**
 * Creates a holding payload for seeding portfolio positions.
 */
export function createHolding(overrides: Partial<HoldingPayload> = {}): HoldingPayload {
  return {
    symbol: 'AAPL',
    assetType: 'stock',
    shares: faker.number.int({ min: 1, max: 100 }),
    avgCost: faker.number.float({ min: 100, max: 300, fractionDigits: 2 }),
    ...overrides,
  };
}
