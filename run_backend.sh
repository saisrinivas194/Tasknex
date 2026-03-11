#!/bin/bash
# Run the FastAPI backend from the correct directory (required for "app" module).
cd "$(dirname "$0")/backend" || exit 1
if [ -d "venv/bin" ]; then
  source venv/bin/activate
fi
exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
