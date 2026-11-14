CREATE TABLE IF NOT EXISTS subscribers (
  chat_id text PRIMARY KEY,
  lat numeric(5,2),
  lon numeric(6,2),
  consent boolean NOT NULL DEFAULT false,
  last_class integer,
  last_alert_ts timestamptz,
  current_label text,
  data_date text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Neon-only provisioning: enable RLS; the app connects as the table owner (owner bypasses RLS); no policies = no other role gets access.
-- ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
