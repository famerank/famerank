-- Add is_human and filter_reason columns to creators table.
-- is_human defaults to true (all existing creators assumed human until filtered).
-- filter_reason stores the rule(s) that triggered the flag.

ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS is_human      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS filter_reason text;

-- Index for fast filtering in rankings / search queries
CREATE INDEX IF NOT EXISTS creators_is_human_idx ON creators (is_human);
