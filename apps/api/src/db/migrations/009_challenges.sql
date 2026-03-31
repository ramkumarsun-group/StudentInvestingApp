-- Phase 2: Challenges

CREATE TABLE IF NOT EXISTS challenges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id         UUID REFERENCES classes(id),
  created_by       UUID NOT NULL REFERENCES users(id),
  title            VARCHAR(150) NOT NULL,
  description      TEXT,
  challenge_type   VARCHAR(20) NOT NULL,
  target_value     NUMERIC(10,4),
  xp_reward        INTEGER NOT NULL DEFAULT 200,
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ NOT NULL,
  status           VARCHAR(12) NOT NULL DEFAULT 'scheduled'
);

CREATE INDEX IF NOT EXISTS idx_challenges_class ON challenges(class_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);

CREATE TABLE IF NOT EXISTS challenge_participants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  UUID NOT NULL REFERENCES challenges(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  current_value NUMERIC(10,4) NOT NULL DEFAULT 0,
  is_completed  BOOLEAN NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  rank          INTEGER,
  UNIQUE(challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON challenge_participants(challenge_id);
