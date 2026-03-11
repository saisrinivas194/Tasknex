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
    asyncio.run(main())
