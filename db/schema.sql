CREATE SCHEMA IF NOT EXISTS att;

CREATE TABLE IF NOT EXISTS att.users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT CHECK (phone IS NULL OR phone ~ '^91[6-9][0-9]{9}$'),
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','teacher')),
  instance_name TEXT UNIQUE,
  wa_status     TEXT NOT NULL DEFAULT 'disconnected' CHECK (wa_status IN ('connected','disconnected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS att.classes (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  teacher_id INT REFERENCES att.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS att.students (
  id       SERIAL PRIMARY KEY,
  class_id INT NOT NULL REFERENCES att.classes(id) ON DELETE CASCADE,
  roll_no  INT NOT NULL DEFAULT 0,
  name     TEXT NOT NULL,
  active   BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS students_class_idx ON att.students(class_id);

CREATE TABLE IF NOT EXISTS att.guardians (
  id         SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES att.students(id) ON DELETE CASCADE,
  name       TEXT,
  phone      TEXT NOT NULL CHECK (phone ~ '^91[6-9][0-9]{9}$'),
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  opt_in     BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS guardians_student_idx ON att.guardians(student_id);

CREATE TABLE IF NOT EXISTS att.attendance (
  id         SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES att.students(id) ON DELETE CASCADE,
  att_date   DATE NOT NULL,
  session    TEXT NOT NULL CHECK (session IN ('morning','afternoon')),
  status     CHAR(1) NOT NULL CHECK (status IN ('P','A')),
  marked_by  INT REFERENCES att.users(id),
  marked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, att_date, session)
);

CREATE TABLE IF NOT EXISTS att.session_marks (
  id        SERIAL PRIMARY KEY,
  class_id  INT NOT NULL REFERENCES att.classes(id) ON DELETE CASCADE,
  att_date  DATE NOT NULL,
  session   TEXT NOT NULL CHECK (session IN ('morning','afternoon')),
  marked_by INT REFERENCES att.users(id),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, att_date, session)
);

CREATE TABLE IF NOT EXISTS att.message_log (
  id            BIGSERIAL PRIMARY KEY,
  attendance_id INT NOT NULL REFERENCES att.attendance(id) ON DELETE CASCADE,
  guardian_id   INT NOT NULL REFERENCES att.guardians(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  error         TEXT,
  attempts      INT NOT NULL DEFAULT 0,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attendance_id, guardian_id)
);
CREATE INDEX IF NOT EXISTS message_log_status_idx ON att.message_log(status);

-- Timetable and mark sheets
CREATE TABLE IF NOT EXISTS att.timetable (
  id          SERIAL PRIMARY KEY,
  class_id    INT NOT NULL REFERENCES att.classes(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  period      SMALLINT NOT NULL CHECK (period BETWEEN 1 AND 10),
  subject     TEXT NOT NULL,
  UNIQUE (class_id, day_of_week, period)
);

CREATE TABLE IF NOT EXISTS att.exams (
  id         SERIAL PRIMARY KEY,
  class_id   INT NOT NULL REFERENCES att.classes(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  exam_date  DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS att.exam_subjects (
  exam_id   INT NOT NULL REFERENCES att.exams(id) ON DELETE CASCADE,
  subject   TEXT NOT NULL,
  max_marks INT NOT NULL DEFAULT 100 CHECK (max_marks > 0),
  position  INT NOT NULL DEFAULT 0,
  PRIMARY KEY (exam_id, subject)
);

CREATE TABLE IF NOT EXISTS att.marks (
  exam_id    INT NOT NULL REFERENCES att.exams(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES att.students(id) ON DELETE CASCADE,
  subject    TEXT NOT NULL,
  marks      NUMERIC(6,2) NOT NULL CHECK (marks >= 0),
  PRIMARY KEY (exam_id, student_id, subject)
);

CREATE TABLE IF NOT EXISTS att.notice_log (
  id         BIGSERIAL PRIMARY KEY,
  batch      TEXT NOT NULL,
  kind       TEXT NOT NULL,
  class_id   INT NOT NULL REFERENCES att.classes(id) ON DELETE CASCADE,
  exam_id    INT REFERENCES att.exams(id) ON DELETE CASCADE,
  student_id INT REFERENCES att.students(id) ON DELETE SET NULL,
  phone      TEXT NOT NULL,
  text       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  error      TEXT,
  attempts   INT NOT NULL DEFAULT 0,
  sent_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notice_log_batch_idx ON att.notice_log(batch);

-- Newer features. Older databases get the extra columns/constraints here.
ALTER TABLE att.notice_log DROP CONSTRAINT IF EXISTS notice_log_kind_check;
ALTER TABLE att.notice_log ADD COLUMN IF NOT EXISTS ref_id     INT;
ALTER TABLE att.notice_log ADD COLUMN IF NOT EXISTS media_url  TEXT;
ALTER TABLE att.notice_log ADD COLUMN IF NOT EXISTS media_name TEXT;

CREATE TABLE IF NOT EXISTS att.settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS att.holidays (
  id           SERIAL PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS att.announcements (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  class_id    INT REFERENCES att.classes(id) ON DELETE SET NULL,
  all_school  BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  INT REFERENCES att.users(id) ON DELETE SET NULL,
  recipients  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS att.absence_alerts (
  student_id INT NOT NULL REFERENCES att.students(id) ON DELETE CASCADE,
  last_date  DATE NOT NULL,
  days       INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, last_date)
);

CREATE TABLE IF NOT EXISTS att.fee_items (
  id         SERIAL PRIMARY KEY,
  class_id   INT NOT NULL REFERENCES att.classes(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  amount     NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  due_date   DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS att.fee_dues (
  id          SERIAL PRIMARY KEY,
  fee_item_id INT NOT NULL REFERENCES att.fee_items(id) ON DELETE CASCADE,
  student_id  INT NOT NULL REFERENCES att.students(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  concession  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (concession >= 0),
  UNIQUE (fee_item_id, student_id)
);

CREATE TABLE IF NOT EXISTS att.fee_payments (
  id         SERIAL PRIMARY KEY,
  due_id     INT NOT NULL REFERENCES att.fee_dues(id) ON DELETE CASCADE,
  amount     NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  paid_on    DATE NOT NULL DEFAULT CURRENT_DATE,
  method     TEXT NOT NULL DEFAULT 'Cash',
  note       TEXT,
  created_by INT REFERENCES att.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS att.password_resets (
  user_id    INT PRIMARY KEY REFERENCES att.users(id) ON DELETE CASCADE,
  otp_hash   TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INT NOT NULL DEFAULT 0
);
