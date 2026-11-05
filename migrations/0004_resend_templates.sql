ALTER TABLE instance_settings ADD COLUMN email_provider TEXT NOT NULL DEFAULT 'smtp' CHECK (email_provider IN ('smtp', 'resend'));

ALTER TABLE forms ADD COLUMN recipient_field TEXT NOT NULL DEFAULT 'email';
ALTER TABLE forms ADD COLUMN confirmation_enabled INTEGER NOT NULL DEFAULT 0 CHECK (confirmation_enabled IN (0, 1));
ALTER TABLE forms ADD COLUMN confirmation_template TEXT NOT NULL DEFAULT '';
ALTER TABLE forms ADD COLUMN follow_up_template TEXT NOT NULL DEFAULT '';

-- SQLite cannot change a CHECK constraint in place, so rebuild the table to
-- allow the submitter-facing kinds and store per-send template variables.
CREATE TABLE email_deliveries_new (
  id TEXT PRIMARY KEY,
  form_id TEXT REFERENCES forms(id) ON DELETE SET NULL,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('submission', 'password_reset', 'test', 'confirmation', 'follow_up')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'retrying', 'delivered', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  variables_json TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);

INSERT INTO email_deliveries_new (id, form_id, submission_id, recipient, kind, status, attempts, last_error, created_at, delivered_at)
  SELECT id, form_id, submission_id, recipient, kind, status, attempts, last_error, created_at, delivered_at FROM email_deliveries;
DROP TABLE email_deliveries;
ALTER TABLE email_deliveries_new RENAME TO email_deliveries;

CREATE INDEX email_deliveries_created_idx ON email_deliveries(created_at DESC);
CREATE INDEX email_deliveries_status_idx ON email_deliveries(status, created_at DESC);
CREATE INDEX email_deliveries_submission_idx ON email_deliveries(submission_id, kind);
