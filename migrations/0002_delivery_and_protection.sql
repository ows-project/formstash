ALTER TABLE forms ADD COLUMN strict_fields INTEGER NOT NULL DEFAULT 0 CHECK (strict_fields IN (0, 1));
ALTER TABLE forms ADD COLUMN turnstile_enabled INTEGER NOT NULL DEFAULT 0 CHECK (turnstile_enabled IN (0, 1));
ALTER TABLE forms ADD COLUMN rate_limit_per_minute INTEGER NOT NULL DEFAULT 60;

CREATE TABLE instance_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  smtp_enabled INTEGER NOT NULL DEFAULT 0 CHECK (smtp_enabled IN (0, 1)),
  smtp_host TEXT NOT NULL DEFAULT '',
  smtp_port INTEGER NOT NULL DEFAULT 465,
  smtp_security TEXT NOT NULL DEFAULT 'tls' CHECK (smtp_security IN ('tls', 'starttls')),
  smtp_username TEXT NOT NULL DEFAULT '',
  smtp_password_encrypted TEXT,
  smtp_from_name TEXT NOT NULL DEFAULT 'Formstash',
  smtp_from_email TEXT NOT NULL DEFAULT '',
  retention_days INTEGER NOT NULL DEFAULT 0,
  turnstile_site_key TEXT NOT NULL DEFAULT '',
  turnstile_secret_encrypted TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE email_deliveries (
  id TEXT PRIMARY KEY,
  form_id TEXT REFERENCES forms(id) ON DELETE SET NULL,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('submission', 'password_reset', 'test')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'retrying', 'delivered', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);

CREATE INDEX email_deliveries_created_idx ON email_deliveries(created_at DESC);
CREATE INDEX email_deliveries_status_idx ON email_deliveries(status, created_at DESC);

CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX password_resets_user_idx ON password_resets(user_id);

CREATE TABLE rate_limits (
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  bucket_key TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (form_id, bucket_key, window_start)
);

CREATE INDEX rate_limits_window_idx ON rate_limits(window_start);
