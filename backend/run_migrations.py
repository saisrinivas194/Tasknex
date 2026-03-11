#!/usr/bin/env python3
"""
Run task table migrations (document_url, priority, due_date, labels).
Uses DATABASE_URL from backend/.env. Run from project root or backend dir:

  cd backend && python run_migrations.py
"""
import asyncio
import os
import sys

# Run from backend so app imports work
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

# Load .env
env_path = os.path.join(backend_dir, ".env")
if os.path.isfile(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

MIGRATIONS = [
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS document_url VARCHAR(2000);",
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';",
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;",
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS labels TEXT;",
    "UPDATE tasks SET priority = 'medium' WHERE priority IS NULL;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;",
    """CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );""",
    """CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(team_id, user_id)
    );""",
    """CREATE TABLE IF NOT EXISTS workflow_shares (
        id SERIAL PRIMARY KEY,
        workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        role VARCHAR(20) DEFAULT 'viewer' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK ((user_id IS NOT NULL AND team_id IS NULL) OR (user_id IS NULL AND team_id IS NOT NULL))
    );""",
]


async def main():
    from sqlalchemy import text
    from app.database import engine
    print("Connecting to database...")
    async with engine.begin() as conn:
        for sql in MIGRATIONS:
            await conn.execute(text(sql))
            print("OK:", sql.split("(")[0].strip())
    print("Migrations completed successfully.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        if "gaierror" in type(e).__name__ or "nodename nor servname" in str(e):
            print("\nCould not resolve database host. For migrations from your computer,")
            print("use Railway's *public* Postgres URL in backend/.env (Variables → DATABASE_PUBLIC_URL).")
        raise
