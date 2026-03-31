-- Phase 2: Schools & Classes

CREATE TABLE IF NOT EXISTS schools (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR(200) NOT NULL,
  slug               VARCHAR(100) UNIQUE NOT NULL,
  license_type       VARCHAR(20) NOT NULL DEFAULT 'trial',
  license_expires_at DATE,
  max_teachers       INTEGER NOT NULL DEFAULT 5,
  max_students       INTEGER NOT NULL DEFAULT 150,
  stripe_customer_id VARCHAR(100),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD CONSTRAINT fk_users_school FOREIGN KEY (school_id) REFERENCES schools(id);

CREATE TABLE IF NOT EXISTS classes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID REFERENCES schools(id),
  teacher_id    UUID NOT NULL REFERENCES users(id),
  name          VARCHAR(150) NOT NULL,
  join_code     VARCHAR(8) UNIQUE NOT NULL,
  semester      VARCHAR(20),
  academic_year VARCHAR(9),
  starting_cash NUMERIC(14,2) NOT NULL DEFAULT 100000.00,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_join_code ON classes(join_code);

CREATE TABLE IF NOT EXISTS class_enrollments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     UUID NOT NULL REFERENCES classes(id),
  student_id   UUID NOT NULL REFERENCES users(id),
  portfolio_id UUID REFERENCES portfolios(id),
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_class ON class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON class_enrollments(student_id);
