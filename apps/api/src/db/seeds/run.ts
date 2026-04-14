import '../../config/env';
import { db } from '../../config/db';
import { seedLevels } from './levels.seed';
import { seedBadges } from './badges.seed';
import { seedModules } from './modules.seed';

async function run() {
  console.log('🌱 Running seeds...');
  await seedLevels();
  await seedBadges();
  await seedModules();
  console.log('✅ All seeds complete');
  await db.end();
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
