CREATE TABLE IF NOT EXISTS levels (
  id           INTEGER PRIMARY KEY,
  name         VARCHAR(30) NOT NULL,
  min_xp       INTEGER NOT NULL,
  badge_color  VARCHAR(20),
  icon_url     TEXT,
  perks        JSONB
);

CREATE TABLE IF NOT EXISTS user_xp (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  total_xp          INTEGER NOT NULL DEFAULT 0,
  current_level     INTEGER NOT NULL DEFAULT 1 REFERENCES levels(id),
  xp_to_next_level  INTEGER NOT NULL DEFAULT 500,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xp_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type   VARCHAR(40) NOT NULL,
  xp_amount    INTEGER NOT NULL,
  reference_id UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_events_user ON xp_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS badges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           VARCHAR(60) UNIQUE NOT NULL,
  name           VARCHAR(80) NOT NULL,
  description    TEXT,
  icon_url       TEXT,
  category       VARCHAR(20),
  xp_reward      INTEGER NOT NULL DEFAULT 50,
  criteria_json  JSONB NOT NULL DEFAULT '{}',
  rarity         VARCHAR(10) NOT NULL DEFAULT 'common'
);

CREATE TABLE IF NOT EXISTS user_badges (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id  UUID NOT NULL REFERENCES badges(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

CREATE TABLE IF NOT EXISTS streaks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  current_streak     INTEGER NOT NULL DEFAULT 0,
  longest_streak     INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
