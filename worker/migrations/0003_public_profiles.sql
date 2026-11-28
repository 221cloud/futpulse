-- Add optional public profile fields. Existing accounts remain private by default.
ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN profile_public INTEGER NOT NULL DEFAULT 0;
