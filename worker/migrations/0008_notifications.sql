-- Store in-app notifications for community activity.
CREATE TABLE IF NOT EXISTS user_notifications (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('follow', 'like', 'comment')),
  post_id TEXT REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id TEXT REFERENCES community_post_comments(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  CHECK (recipient_id <> actor_id)
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_created
  ON user_notifications(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_unread
  ON user_notifications(recipient_id, read_at, created_at DESC);
