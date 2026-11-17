-- Audit trail of every change made through the API, and indexes for the paginated lists.
CREATE TABLE IF NOT EXISTS att.audit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INT,
  school_id  INT,
  action     TEXT NOT NULL,
  target     TEXT,
  ip         TEXT,
  ok         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_school_idx ON att.audit_log (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS message_log_created_idx ON att.message_log (created_at DESC);
CREATE INDEX IF NOT EXISTS message_log_status_lock_idx ON att.message_log (status, locked_at);
CREATE INDEX IF NOT EXISTS notice_log_status_idx ON att.notice_log (status, created_at);
CREATE INDEX IF NOT EXISTS attendance_date_idx ON att.attendance (att_date, session);
CREATE INDEX IF NOT EXISTS classes_school_idx ON att.classes (school_id);
CREATE INDEX IF NOT EXISTS users_school_idx ON att.users (school_id, role);
