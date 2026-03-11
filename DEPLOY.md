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

> **If you see:** `Railpack could not determine how to build the app` and the build shows `./` with `backend/`, `frontend/`, etc., the service is building from the **repo root** instead of the backend folder. Fix: set **Root Directory** to **`backend`** (step 2.2 below). Then trigger a new deploy.

> **If you see:** `Failed building wheel for asyncpg` or `Failed building wheel for pydantic-core` with Python 3.13, the build is using Python 3.13 (which these packages don’t support yet). The repo has `backend/runtime.txt` and `backend/.python-version` set to **3.12** so Railway uses Python 3.12. If the error persists, in the backend service add a **Variable**: `RAILPACK_PYTHON_VERSION` = `3.12`, then redeploy.

### 2.1 Add the service from GitHub

1. In your Railway project (the same one where you added PostgreSQL), click **"+ New"** (or **"New"**).
2. Choose **"GitHub Repo"** (or **"Deploy from GitHub repo"**).
3. If asked, connect your GitHub account and **select your Tasknex repo** (e.g. `saisrinivas194/Tasknex`).
4. Railway will add a **new service** and start a build. You’ll see a card for this service (e.g. "Tasknex" or the repo name).

### 2.2 Set Root Directory (so Railway uses the `backend` folder)

Your repo has both `backend` and `frontend`. For this service we want only the **backend** folder.

1. Click on the **backend service card** (the one you just added from GitHub).
2. Open **Settings** (tab or "Settings" in the left/side menu).
3. Find the **"Build"** or **"Source"** section.
4. Look for **"Root Directory"** or **"Service Root"**.
5. In the text box, type exactly:
   ```text
   backend
   ```
6. Save if there’s a **Save** or **Update** button. Railway will redeploy using the `backend` folder as the project root.

**Why:** The app code (e.g. `app/main.py`) lives inside `backend/`. If Root Directory is empty, Railway looks at the repo root, Railpack sees both `backend/` and `frontend/` and cannot detect a single app, and the build fails with "could not determine how to build the app". Setting it to `backend` makes Railpack see only `requirements.txt` and `app/`, so it detects Python and builds correctly.

### 2.3 Set the Start Command (how the app runs)

Railway needs to know which command starts your FastAPI app and that it listens on the port Railway provides (`$PORT`).

1. Still in **Settings** for the backend service.
2. Find **"Deploy"** or **"Start Command"** or **"Custom Start Command"**.
3. If you see **"Start Command"** (or "Override Start Command"), set it to:
   ```text
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
4. Leave **Build Command** empty (Railway will run `pip install -r requirements.txt` automatically for Python).

**If you don’t see Start Command:** This repo uses **Config-as-Code**: `backend/railway.toml` already defines the start command. Once **Root Directory** is `backend`, Railway will read that file and use it. You can also type the start command manually in the dashboard if you prefer (see section 7).

### 2.4 Add environment variables (Variables)

1. In the backend service, go to the **Variables** tab (or **Settings** → **Variables**).
2. Add these variables (use **"+ New Variable"** or **"Add Variable"** for each):

| Variable        | What to put |
|----------------|-------------|
| `DATABASE_URL` | See step 2.5 below (link from Postgres). |
| `SECRET_KEY`   | A long random string. Example: run `openssl rand -hex 32` in your terminal and paste the result. |

Optional:

| Variable         | What to put |
|------------------|-------------|
| `CORS_ORIGINS`  | Leave empty, or your frontend URL later (e.g. `https://your-app.railway.app`). |
| `OPENAI_API_KEY`| Your OpenAI API key if you want AI workflow generation. |

### 2.5 Link PostgreSQL to the backend

You need the backend to use the Postgres database you added in step 1.

1. In the **backend service** → **Variables** tab, click **"+ New Variable"** or **"Add Variable"**.
2. Choose **"Add a variable"** or **"Reference"**.
3. If you see **"Add Reference"** or **"Variable Reference"**:  
   - Select the **PostgreSQL** service (the one you created in step 1).  
   - Choose the variable **`DATABASE_URL`**.  
   - Confirm. Railway will inject the database URL into your backend.
4. If you don’t see "Reference":  
   - Click your **PostgreSQL** service.  
   - Open **Connect** or **Variables** and copy the **Postgres URL** (or connection string).  
   - In the **backend** service → Variables, add a variable named **`DATABASE_URL`** and paste that URL.  
   - **Important:** If the URL is `postgresql://...`, change the start to `postgresql+asyncpg://...` (so Python’s async driver is used). Example: `postgresql+asyncpg://postgres:xxx@xxx.railway.app:5432/railway`.

### 2.6 Generate a public URL for the backend

1. In the **backend service**, open **Settings** → **Networking** (or **"Generate domain"**).
2. Click **"Generate domain"** (or **"Add domain"**). Railway will give you a URL like `https://your-service-name.up.railway.app`.
3. **Copy this URL.** The frontend will need: **this URL + `/api`** (e.g. `https://your-service-name.up.railway.app/api`).

After saving Variables and Root Directory, Railway will redeploy. Wait for the build to finish and the deployment to be **Success** (green). Then you can open the generated URL; e.g. `https://your-backend.up.railway.app/api/health` should return `{"status":"ok"}`.

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
     (Railway will then use **Config-as-Code** from `frontend/railway.toml` for build and start commands.)
   - If you set them manually: **Build Command** = `npm ci && npm run build`, **Start Command** = `npm start`.
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

## 7. Config-as-Code (railway.toml)

Railway can read build and deploy settings from a config file in your repo instead of only the dashboard. This repo is set up for that.

**“Manage your build and deployment settings through a config file in this?”**  
→ **Yes.** Once you set **Root Directory** for each service, Railway will use the config file inside that folder.

| Service  | Root Directory (set in dashboard) | Config file Railway uses      |
|----------|------------------------------------|--------------------------------|
| Backend  | `backend`                          | `backend/railway.toml`         |
| Frontend | `frontend`                         | `frontend/railway.toml`        |

- **Backend:** `backend/railway.toml` sets the start command (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`) and restart policy. You still need to set **Root Directory = `backend`** in the dashboard so Railway looks in the right folder.
- **Frontend:** `frontend/railway.toml` sets build command (`npm ci && npm run build`) and start command (`npm start`). Set **Root Directory = `frontend`** in the dashboard.

Settings in these files **override** the same settings in the dashboard. Variables (e.g. `DATABASE_URL`, `SECRET_KEY`) are **not** in the config file; add those in the dashboard **Variables** tab.

Docs: [Railway Config-as-Code](https://docs.railway.com/reference/config-as-code).
