import { db } from '../../config/db';
import { LEVELS } from '@student-investing/shared-types';

export async function seedLevels() {
  for (const level of LEVELS) {
    await db.query(
      `INSERT INTO levels(id, name, min_xp, badge_color)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(id) DO UPDATE SET name=$2, min_xp=$3, badge_color=$4`,
      [level.id, level.name, level.minXp, level.badgeColor],
    );
  }
  console.log(`✅ Seeded ${LEVELS.length} levels`);
}
