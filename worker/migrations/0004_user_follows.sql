-- Store relationships between public FutPulse profiles.
CREATE TABLE IF NOT EXISTS user_follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_followed_id
  ON user_follows(followed_id);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id
  ON user_follows(follower_id);
