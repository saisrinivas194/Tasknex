-- Add optional document/link URL to tasks (run once if DB was created before this feature).
-- Safe to run: uses IF NOT EXISTS where supported, or run once manually.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS document_url VARCHAR(2000);
