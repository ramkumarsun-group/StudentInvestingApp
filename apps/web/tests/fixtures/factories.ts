import { faker } from '@faker-js/faker';
// P-10: types sourced from @student-investing/shared-types (AC5 compliance)
import type {
  StudentPayload,
  TradePayload,
  PortfolioSeedPayload,
  HoldingPayload,
} from '@student-investing/shared-types';

/**
 * Test data factories for StockPlay E2E and integration tests.
 * All factories return plain objects suitable for seeding via POST /api/v1/test/seed.
 */

// Re-export types so consumers can import from this module without reaching into shared-types
export type { StudentPayload, TradePayload, PortfolioSeedPayload, HoldingPayload };

/**
 * Creates a student payload suitable for seeding.
 * DOB is always 20 years ago to avoid under-18 flag.
 * P-12: displayName removed — no display_name column exists in the users table.
 */
export function createStudent(overrides: Partial<StudentPayload> = {}): StudentPayload {
  const username = faker.internet.username().replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - 20);

  return {
    email: faker.internet.email().toLowerCase(),
    password: 'Password123!',
    username,
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
