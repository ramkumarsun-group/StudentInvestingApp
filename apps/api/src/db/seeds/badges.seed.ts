import { db } from '../../config/db';

const BADGES = [
  // Trading
  { slug: 'first-trade', name: 'First Trade', description: 'Place your first order', icon: '🎯', category: 'trading', xpReward: 100, rarity: 'common', criteria: { type: 'trade_count', threshold: 1 } },
  { slug: 'ten-trades', name: 'Active Trader', description: 'Place 10 orders', icon: '📈', category: 'trading', xpReward: 150, rarity: 'common', criteria: { type: 'trade_count', threshold: 10 } },
  { slug: 'fifty-trades', name: 'Trading Machine', description: 'Place 50 orders', icon: '🤖', category: 'trading', xpReward: 300, rarity: 'rare', criteria: { type: 'trade_count', threshold: 50 } },
  { slug: 'first-profit', name: 'First Profit', description: 'Achieve a positive portfolio return', icon: '💰', category: 'trading', xpReward: 200, rarity: 'common', criteria: { type: 'portfolio_return', threshold: 0.01 } },
  { slug: 'five-percent', name: 'Five Percenter', description: 'Achieve 5%+ portfolio return', icon: '🚀', category: 'trading', xpReward: 300, rarity: 'rare', criteria: { type: 'portfolio_return', threshold: 5 } },
  { slug: 'ten-percent', name: 'Double Digits', description: 'Achieve 10%+ portfolio return', icon: '💎', category: 'trading', xpReward: 500, rarity: 'epic', criteria: { type: 'portfolio_return', threshold: 10 } },
  { slug: 'crypto-curious', name: 'Crypto Curious', description: 'Trade your first crypto', icon: '₿', category: 'trading', xpReward: 100, rarity: 'common', criteria: { type: 'asset_type_trade', eventType: 'crypto', threshold: 1 } },
  { slug: 'etf-explorer', name: 'ETF Explorer', description: 'Trade your first ETF', icon: '📊', category: 'trading', xpReward: 100, rarity: 'common', criteria: { type: 'asset_type_trade', eventType: 'etf', threshold: 1 } },
  // Learning
  { slug: 'first-lesson', name: 'Student', description: 'Complete your first lesson', icon: '📚', category: 'learning', xpReward: 50, rarity: 'common', criteria: { type: 'lesson_count', threshold: 1 } },
  { slug: 'ten-lessons', name: 'Bookworm', description: 'Complete 10 lessons', icon: '🦉', category: 'learning', xpReward: 200, rarity: 'common', criteria: { type: 'lesson_count', threshold: 10 } },
  { slug: 'first-module', name: 'Module Master', description: 'Complete a full module', icon: '🎓', category: 'learning', xpReward: 300, rarity: 'rare', criteria: { type: 'module_complete', threshold: 1 } },
  { slug: 'all-modules', name: 'Scholar', description: 'Complete all beginner modules', icon: '🏫', category: 'learning', xpReward: 1000, rarity: 'epic', criteria: { type: 'module_complete', threshold: 5 } },
  // Streak
  { slug: 'streak-3', name: 'Hat Trick', description: '3-day streak', icon: '🔥', category: 'streak', xpReward: 50, rarity: 'common', criteria: { type: 'streak', threshold: 3 } },
  { slug: 'streak-7', name: 'Week Warrior', description: '7-day streak', icon: '⚡', category: 'streak', xpReward: 150, rarity: 'rare', criteria: { type: 'streak', threshold: 7 } },
  { slug: 'streak-30', name: 'Month Master', description: '30-day streak', icon: '🌟', category: 'streak', xpReward: 500, rarity: 'epic', criteria: { type: 'streak', threshold: 30 } },
  { slug: 'streak-100', name: 'Centurion', description: '100-day streak', icon: '👑', category: 'streak', xpReward: 2000, rarity: 'legendary', criteria: { type: 'streak', threshold: 100 } },
  // XP
  { slug: 'xp-500', name: 'Getting Started', description: 'Earn 500 XP', icon: '⭐', category: 'learning', xpReward: 0, rarity: 'common', criteria: { type: 'xp_total', threshold: 500 } },
  { slug: 'xp-5000', name: 'XP Collector', description: 'Earn 5,000 XP', icon: '🌠', category: 'learning', xpReward: 0, rarity: 'rare', criteria: { type: 'xp_total', threshold: 5000 } },
  { slug: 'xp-25000', name: 'XP Legend', description: 'Earn 25,000 XP', icon: '🔮', category: 'learning', xpReward: 0, rarity: 'legendary', criteria: { type: 'xp_total', threshold: 25000 } },
];

export async function seedBadges() {
  for (const b of BADGES) {
    await db.query(
      `INSERT INTO badges(slug, name, description, icon_url, category, xp_reward, criteria_json, rarity)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(slug) DO UPDATE SET name=$2, description=$3, criteria_json=$7`,
      [b.slug, b.name, b.description, b.icon, b.category, b.xpReward, JSON.stringify(b.criteria), b.rarity],
    );
  }
  console.log(`✅ Seeded ${BADGES.length} badges`);
}
