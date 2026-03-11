-- Jira-style fields: priority, due_date, labels (run once if DB existed before this feature).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS labels TEXT;

UPDATE tasks SET priority = 'medium' WHERE priority IS NULL;
