CREATE TABLE IF NOT EXISTS modules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         VARCHAR(80) UNIQUE NOT NULL,
  title        VARCHAR(150) NOT NULL,
  description  TEXT,
  asset_type   VARCHAR(10),
  difficulty   VARCHAR(12) NOT NULL DEFAULT 'beginner',
  xp_reward    INTEGER NOT NULL DEFAULT 100,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  requires_pro BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lessons (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id          UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  slug               VARCHAR(80) NOT NULL,
  title              VARCHAR(150) NOT NULL,
  content_json       JSONB NOT NULL DEFAULT '[]',
  xp_reward          INTEGER NOT NULL DEFAULT 25,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  estimated_minutes  INTEGER NOT NULL DEFAULT 5
);

CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id);

CREATE TABLE IF NOT EXISTS quizzes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options       JSONB NOT NULL DEFAULT '[]',
  explanation   TEXT,
  xp_reward     INTEGER NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS user_lesson_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    UUID NOT NULL REFERENCES lessons(id),
  module_id    UUID NOT NULL REFERENCES modules(id),
  status       VARCHAR(12) NOT NULL DEFAULT 'not_started',
  quiz_score   INTEGER,
  xp_earned    INTEGER NOT NULL DEFAULT 0,
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON user_lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_module ON user_lesson_progress(user_id, module_id);
