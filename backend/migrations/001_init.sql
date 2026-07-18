CREATE TABLE IF NOT EXISTS invites (
  invite_token    text PRIMARY KEY,
  host_token      text UNIQUE NOT NULL,
  host_name       text NOT NULL,
  guest_name      text NOT NULL,
  note            text NOT NULL,
  location        text NOT NULL,              -- Discord voice-channel URL
  event_at        timestamptz NOT NULL,
  expires_at      timestamptz NOT NULL,       -- event_at + grace window
  created_at      timestamptz NOT NULL DEFAULT now(),
  movies          jsonb NOT NULL,             -- ordered [MovieRef x3]
  status          text NOT NULL DEFAULT 'waiting',   -- waiting | answered
  picked_movie_id text,
  answered_at     timestamptz,
  swaps_used      smallint NOT NULL DEFAULT 0,
  opened_at       timestamptz
);

CREATE TABLE IF NOT EXISTS push_subs (
  host_token text NOT NULL REFERENCES invites(host_token) ON DELETE CASCADE,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  PRIMARY KEY (host_token, endpoint)
);
