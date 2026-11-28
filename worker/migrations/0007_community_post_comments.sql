-- Store comments on community posts.
CREATE TABLE IF NOT EXISTS community_post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_post_comments_post
  ON community_post_comments(post_id, created_at);

CREATE INDEX IF NOT EXISTS idx_community_post_comments_user
  ON community_post_comments(user_id);
