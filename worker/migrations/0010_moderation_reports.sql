CREATE TABLE IF NOT EXISTS moderation_reports (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN (
      'spam',
      'harassment',
      'hate_speech',
      'false_information',
      'inappropriate_content',
      'other'
    )
  ),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'reviewed', 'dismissed')
  ),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  reviewed_by TEXT,
  FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (post_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_moderation_reports_status
ON moderation_reports(status, created_at);

CREATE INDEX IF NOT EXISTS idx_moderation_reports_post
ON moderation_reports(post_id);
