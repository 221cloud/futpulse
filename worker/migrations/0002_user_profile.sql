-- Add compact profile avatar data to each FutPulse account.
ALTER TABLE users ADD COLUMN avatar_data TEXT;
