CREATE TABLE IF NOT EXISTS manual_football_fixture_events (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL,
  team_side TEXT NOT NULL CHECK (team_side IN ('home', 'away')),
  event_type TEXT NOT NULL CHECK (event_type IN ('goal', 'own_goal', 'penalty_scored', 'penalty_missed', 'yellow_card', 'red_card', 'substitution', 'var')),
  minute INTEGER NOT NULL CHECK (minute >= 0 AND minute <= 130),
  added_time INTEGER CHECK (added_time IS NULL OR (added_time >= 0 AND added_time <= 30)),
  player_name TEXT NOT NULL,
  related_player_name TEXT,
  detail TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (fixture_id) REFERENCES manual_football_fixtures(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CHECK (length(player_name) BETWEEN 1 AND 100),
  CHECK (related_player_name IS NULL OR length(related_player_name) <= 100),
  CHECK (detail IS NULL OR length(detail) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_manual_fixture_events_fixture_minute
  ON manual_football_fixture_events (fixture_id, minute, added_time, created_at);
