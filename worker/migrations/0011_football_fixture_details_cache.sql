CREATE TABLE IF NOT EXISTS football_fixture_details_cache (
  fixture_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_football_fixture_details_cache_expires
  ON football_fixture_details_cache (expires_at);
