-- Requires the PostGIS extension — every managed free-tier Postgres
-- that supports extensions (Render, Railway, Supabase, Neon w/ addon)
-- can enable this with a single CREATE EXTENSION call.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  display_name    TEXT,
  is_moderator    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token        TEXT UNIQUE NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions (token);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       UUID NOT NULL REFERENCES users(id),
  location          GEOGRAPHY(POINT, 4326) NOT NULL,
  photo_url         TEXT,
  photo_object_key  TEXT,
  category          TEXT NOT NULL,
  model_confidence  REAL NOT NULL DEFAULT 0,
  -- AI-generated (or later, user-edited) free-text caption of the
  -- photo, separate from `category` — see ai-service's BLIP stage.
  -- Nullable: reports filed before this existed, or where captioning
  -- had nothing usable to say, have none.
  description       TEXT,
  user_confirmed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  status            TEXT NOT NULL DEFAULT 'open',
  upvotes           INTEGER NOT NULL DEFAULT 0,
  flag_count        INTEGER NOT NULL DEFAULT 0,
  merged_into_id    UUID REFERENCES reports(id),
  -- CLIP image embedding (512-dim for ViT-B-32) from ai-service's
  -- /embed endpoint. Plain REAL[] rather than pgvector, since most
  -- free-tier managed Postgres instances (Render, Railway) don't ship
  -- the pgvector extension — cosine similarity is computed in Node
  -- instead (see reports.ts /nearby-similar). Good enough at the
  -- report volumes this scans (nearby-only, already GPS-filtered).
  embedding         REAL[]
);

-- Track which users have flagged which reports (1 flag per user per report)
CREATE TABLE IF NOT EXISTS report_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)
);
CREATE INDEX IF NOT EXISTS report_flags_report_idx ON report_flags (report_id);
CREATE INDEX IF NOT EXISTS report_flags_user_idx ON report_flags (user_id);

-- Mirrors report_flags for confirms — 1 confirm per user per report, so
-- the same account can't inflate a report's score by clicking Confirm
-- repeatedly. Enforced the same way flags already were: a UNIQUE
-- constraint the /confirm route checks before inserting.
CREATE TABLE IF NOT EXISTS report_confirms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)
);
CREATE INDEX IF NOT EXISTS report_confirms_report_idx ON report_confirms (report_id);
CREATE INDEX IF NOT EXISTS report_confirms_user_idx ON report_confirms (user_id);

-- GIST index on the geography column is what makes ST_DWithin (the
-- nearby/duplicate-check query in routes/reports.js) fast instead of a
-- full table scan as report volume grows.
CREATE INDEX IF NOT EXISTS reports_location_gix ON reports USING GIST (location);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status);
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports (reporter_id);

-- Backs the Activity tab — every state change on a report (created,
-- confirmed, flagged, sent to review, resolved, removed, restored)
-- is appended here, never mutated, so it reads as a genuine audit
-- trail rather than a derived/recomputed view.
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  report_id   UUID NOT NULL REFERENCES reports(id),
  category    TEXT NOT NULL,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta        TEXT
);
CREATE INDEX IF NOT EXISTS activity_log_at_idx ON activity_log (at DESC);
