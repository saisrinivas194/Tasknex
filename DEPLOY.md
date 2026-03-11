# Deploy Tasknex to Railway

Deploy the **backend** (FastAPI + PostgreSQL) and **frontend** (Next.js) as two Railway services.

---

## Prerequisites

- [Railway](https://railway.app) account
- GitHub repo with this project (push after adding `.gitignore` so `venv/`, `node_modules/`, `.env` are not committed)

---

## 1. Create a new project on Railway

1. Go to [railway.app](https://railway.app) and create a new project.
2. Add **PostgreSQL**: in the project, click **+ New** → **Database** → **PostgreSQL**. Railway will set `DATABASE_URL` automatically when you link the DB to the backend service.

---

## 2. Deploy the backend

1. In the same project, click **+ New** → **GitHub Repo** and select your repo.
2. Configure the **backend** service:
   - **Root Directory:** `backend`
   - **Build Command:** (leave empty; Nixpacks will run `pip install -r requirements.txt`)
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Or use the **Procfile** in `backend/` (Railway will pick it up if root is `backend`).

3. **Variables** (Settings → Variables):
   - `DATABASE_URL` — from the PostgreSQL service: use **Connect** → **Postgres URL** (or **Variable Reference** to link `DATABASE_URL` from the Postgres service).
   - `SECRET_KEY` — generate a long random string (e.g. `openssl rand -hex 32`).
   - `CORS_ORIGINS` — optional; leave empty to allow `*.railway.app` via regex, or set your frontend URL, e.g. `https://your-frontend.railway.app`.
   - `OPENAI_API_KEY` — optional; for AI workflow generation.

4. **Link PostgreSQL:** In the backend service, **Variables** → **Add variable** → **Add reference** → choose the Postgres service’s `DATABASE_URL`.

5. **Generate domain:** Backend service → **Settings** → **Networking** → **Generate domain**. Note the URL (e.g. `https://your-backend.up.railway.app`). The API base for the frontend is this URL + `/api`, e.g. `https://your-backend.up.railway.app/api`.

---

## 3. Run database migrations (backend)

After the first deploy, run migrations once so the `tasks` table has all columns:

**Option A – Railway CLI**

```bash
railway link   # select your project and backend service
cd backend
railway run python run_migrations.py
```

**Option B – Railway shell**

In the backend service → **Settings** → run a one-off command (if available), or use **Shell** and run:

```bash
cd backend && python run_migrations.py
```

**Option C – Local with production DB**

Temporarily set `DATABASE_URL` to your Railway Postgres URL and run:

```bash
cd backend && source venv/bin/activate && python run_migrations.py
```

---

## 4. Deploy the frontend

1. In the **same** Railway project, click **+ New** → **GitHub Repo** and select the **same** repo again (second service).
2. Configure the **frontend** service:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Variables:**
     - `NEXT_PUBLIC_API_URL` = `https://YOUR_BACKEND_DOMAIN/api`  
       (e.g. `https://your-backend.up.railway.app/api` — no trailing slash, include `/api`)

3. **Generate domain:** Frontend service → **Settings** → **Networking** → **Generate domain**. This is your app URL.

---

## 5. Checklist

| Item | Backend | Frontend |
|------|---------|----------|
| Root Directory | `backend` | `frontend` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` | `npm start` |
| Env vars | `DATABASE_URL`, `SECRET_KEY`, optional `CORS_ORIGINS`, `OPENAI_API_KEY` | `NEXT_PUBLIC_API_URL` = backend URL + `/api` |
| Migrations | Run `python run_migrations.py` once after first deploy | — |

---

## 6. Files to keep (and ignore)

- **Do not commit:** `venv/`, `node_modules/`, `.next/`, `.env`, `.env.local` (handled by `.gitignore`).
- **Keep in repo:** `backend/Procfile`, `backend/railway.toml`, `backend/run_migrations.py`, `backend/migrations/`, `frontend/package.json`, all source code.

---

## 7. Optional: single repo with `railway.json`

You can define services in a root `railway.json` (if using Railway’s monorepo support). Otherwise, configuring **Root Directory** and **Start Command** per service in the dashboard is enough.
