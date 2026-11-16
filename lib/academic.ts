import { q } from '@/lib/db';

// Creates the timetable / mark-sheet tables if they do not exist yet (safe to run repeatedly),
// so an already-running database gets them without re-running db-setup.
const SQL = `CREATE TABLE IF NOT EXISTS att.timetable (
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
  kind       TEXT NOT NULL CHECK (kind IN ('timetable','marksheet')),
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
CREATE INDEX IF NOT EXISTS notice_log_batch_idx ON att.notice_log(batch);`;

let ready: Promise<void> | null = null;
export function ensureAcademicTables() {
  if (!ready) {
    ready = q(SQL).then(() => undefined).catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export function grade(pct: number) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 35) return 'D';
  return 'E';
}
