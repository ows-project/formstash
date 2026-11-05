-- Saved Resend templates per form replace the fixed confirmation and follow-up
-- settings. variables_json is an array of { key, source: "field" | "manual", value }:
-- a field variable takes the named submission field, a manual one a default value
-- the owner can change when sending.
CREATE TABLE email_templates (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  resend_template TEXT NOT NULL,
  variables_json TEXT NOT NULL DEFAULT '[]',
  auto_send INTEGER NOT NULL DEFAULT 0 CHECK (auto_send IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX email_templates_form_idx ON email_templates(form_id, created_at);

INSERT INTO email_templates (id, form_id, name, resend_template, auto_send, created_at, updated_at)
  SELECT lower(hex(randomblob(16))), id, 'Confirmation', confirmation_template, confirmation_enabled, updated_at, updated_at
  FROM forms WHERE confirmation_template != '';
INSERT INTO email_templates (id, form_id, name, resend_template, auto_send, created_at, updated_at)
  SELECT lower(hex(randomblob(16))), id, 'Follow-up', follow_up_template, 0, updated_at, updated_at
  FROM forms WHERE follow_up_template != '';

-- Deliveries record which saved template they sent. Rebuilt to change the kind CHECK.
-- The forms columns confirmation_enabled, confirmation_template, and follow_up_template
-- are no longer read; they stay so a Worker still running the previous version keeps
-- accepting submissions until the new version is deployed.
CREATE TABLE email_deliveries_new (
  id TEXT PRIMARY KEY,
  form_id TEXT REFERENCES forms(id) ON DELETE SET NULL,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  template_id TEXT REFERENCES email_templates(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('submission', 'password_reset', 'test', 'template')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'retrying', 'delivered', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  variables_json TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);

INSERT INTO email_deliveries_new
  (id, form_id, submission_id, template_id, recipient, kind, status, attempts, last_error, variables_json, created_at, delivered_at)
  SELECT d.id, d.form_id, d.submission_id,
    CASE d.kind
      WHEN 'confirmation' THEN (SELECT t.id FROM email_templates t WHERE t.form_id = d.form_id AND t.name = 'Confirmation')
      WHEN 'follow_up' THEN (SELECT t.id FROM email_templates t WHERE t.form_id = d.form_id AND t.name = 'Follow-up')
    END,
    d.recipient, CASE WHEN d.kind IN ('confirmation', 'follow_up') THEN 'template' ELSE d.kind END,
    d.status, d.attempts, d.last_error, d.variables_json, d.created_at, d.delivered_at
  FROM email_deliveries d;
DROP TABLE email_deliveries;
ALTER TABLE email_deliveries_new RENAME TO email_deliveries;

CREATE INDEX email_deliveries_created_idx ON email_deliveries(created_at DESC);
CREATE INDEX email_deliveries_status_idx ON email_deliveries(status, created_at DESC);
CREATE INDEX email_deliveries_submission_idx ON email_deliveries(submission_id, template_id);
