-- Scheduled jobs that must run once per day (absence alert) record their run here.
CREATE TABLE IF NOT EXISTS att.job_runs (
  name     TEXT NOT NULL,
  run_date DATE NOT NULL,
  ran_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  result   TEXT,
  PRIMARY KEY (name, run_date)
);
