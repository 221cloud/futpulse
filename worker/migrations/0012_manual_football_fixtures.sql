CREATE TABLE IF NOT EXISTS manual_football_fixtures (
  id TEXT PRIMARY KEY,
  competition_name TEXT NOT NULL,
  season TEXT NOT NULL,
  round_label TEXT,
  kickoff_at TEXT NOT NULL,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  venue TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
  home_score INTEGER,
  away_score INTEGER,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT,
  CHECK (home_score IS NULL OR home_score >= 0),
  CHECK (away_score IS NULL OR away_score >= 0),
  CHECK (home_team_name <> away_team_name)
);

CREATE INDEX IF NOT EXISTS idx_manual_football_fixtures_kickoff
  ON manual_football_fixtures (kickoff_at);

CREATE INDEX IF NOT EXISTS idx_manual_football_fixtures_competition_season
  ON manual_football_fixtures (competition_name, season, kickoff_at);
