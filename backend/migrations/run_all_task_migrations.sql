-- Run this ONCE if your tasks table was created before document_url / Jira fields were added.
-- From project root: psql -d workflow_builder -f backend/migrations/run_all_task_migrations.sql
-- (Or use full path: /opt/homebrew/opt/postgresql@16/bin/psql -d workflow_builder -f backend/migrations/run_all_task_migrations.sql)

-- Document link
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS document_url VARCHAR(2000);

-- Jira-style: priority, due_date, labels
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS labels TEXT;

UPDATE tasks SET priority = 'medium' WHERE priority IS NULL;
