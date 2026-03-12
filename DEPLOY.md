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

> **If you see:** `ConnectionRefusedError: [Errno 111] Connection refused` and **Application startup failed** in the logs, follow the steps in **["Quick fix: Connection refused"](#quick-fix-connection-refused)** below.

> **If you see:** `ModuleNotFoundError: No module named 'psycopg2'` when starting the container, the app is receiving a `postgres://` or `postgresql://` URL and tried to use the wrong driver. The code now converts these to the async driver automatically. **Redeploy** (push the latest code or trigger a new deploy); if the error persists, set `DATABASE_URL` to a URL that starts with `postgresql+asyncpg://` (replace the first `postgres://` or `postgresql://` in the URL with `postgresql+asyncpg://`).

#### Quick fix: Connection refused

Do these in order:

1. **Add PostgreSQL** (if you don’t have it): In the project, click **+ New** → **Database** → **PostgreSQL**. Wait until the Postgres service is running.
2. **Open the backend service**: Click the card for your backend (the one from GitHub).
3. **Open Variables**: Click the **Variables** tab (or **Settings** → **Variables**).
4. **Add `DATABASE_URL`**:
   - Click **+ New Variable** (or **Add Variable**).
   - If you see **"Add Reference"** or **"Variable Reference"**: choose your **PostgreSQL** service, then the variable **`DATABASE_URL`**, and confirm.
   - If you only see a normal "Variable" option: open the **PostgreSQL** service in another tab → **Variables** or **Connect** → copy the full URL. Back in the backend → Variables, add a variable named **`DATABASE_URL`** and paste that URL. (If it starts with `postgresql://`, the app will convert it for the async driver.)
5. **Add `SECRET_KEY`** (if not already set): **+ New Variable** → name `SECRET_KEY`, value = a long random string (e.g. run `openssl rand -hex 32` locally and paste).
6. **Redeploy**: Save any changes; Railway will redeploy. In **Deployments**, wait until the latest deployment is **Success**.
7. **Check**: Open your backend URL (e.g. `https://your-backend.up.railway.app/api/health`). You should see `{"status":"ok"}`.

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
| `GOOGLE_CLIENT_ID` | Your Google Cloud Web client ID if you use Google one-click sign-in. |

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
   - The app accepts `postgres://` or `postgresql://` and uses the async driver automatically; you can paste the URL as-is.

### 2.6 Generate a public URL for the backend

1. In the **backend service**, open **Settings** → **Networking** (or **"Generate domain"**).
2. Click **"Generate domain"** (or **"Add domain"**). Railway will give you a URL like `https://your-service-name.up.railway.app`.
3. **Copy this URL.** Use it as follows:
   - **Root:** `https://your-service-name.up.railway.app` → returns a short API message.
   - **Health check:** `https://your-service-name.up.railway.app/api/health` → should return `{"status":"ok"}`.
   - **Frontend API base URL:** use **this URL + `/api`** (e.g. `https://your-service-name.up.railway.app/api`). Do not add `/api` twice.

After saving Variables and Root Directory, Railway will redeploy. Wait for the build to finish and the deployment to be **Success** (green). Then you can open the generated URL; e.g. `https://your-backend.up.railway.app/api/health` should return `{"status":"ok"}`.

---

## 3. Run database migrations (backend)

### What are migrations and why run them?

When your app first starts on Railway, it creates the basic database tables. The **migrations** step adds a few extra columns to the `tasks` table (e.g. for file links, priority, due date). If you skip this, the app may work but some features can break. You only need to run migrations **once** after the first deploy.

### Easiest way: run from your computer (recommended)

You run a small script on your machine; it connects to your **Railway** database and updates the tables.

1. **Get your Railway database URL (use the public one)**
   - In Railway, click your **PostgreSQL** service (the database).
   - Open the **Variables** or **Connect** tab.
   - Copy the **public** connection URL. It is often named **`DATABASE_PUBLIC_URL`** or shown as "Public network" / "External" in the Connect tab. Use that one when running from your computer; the plain `DATABASE_URL` may be private and only work from inside Railway, which causes "nodename nor servname" when you run migrations locally.

2. **Point your backend at that URL (temporarily)**
   - On your computer, open the file `backend/.env`.
   - Set the line (or add it):
     ```text
     DATABASE_URL=postgres://...paste the URL you copied...
     ```
   - Save the file. (You can remove or change this later after migrations.)

3. **Run the migration script**
   - Open a terminal. Go to your **project folder** (the one that **contains** the `backend` folder). Then run **one** of these:
   - **macOS/Linux – one line (recommended):**
     ```bash
     cd backend && ./venv/bin/python3.12 run_migrations.py
     ```
     If your project is in `Desktop/application`, run that from `Desktop/application` (so that `backend` exists there).
   - **Or:** `cd backend`, then run `./venv/bin/python3.12 run_migrations.py` (must be **inside** the `backend` folder for the second part to work).
   - **Windows:** `cd backend` then `venv\Scripts\python.exe run_migrations.py`.
   - If you see **`ModuleNotFoundError: No module named 'sqlalchemy'`**, the command is not using the venv. Use the venv’s Python explicitly: `./venv/bin/python3.12 run_migrations.py` from inside the `backend` folder (macOS/Linux).
   - If you see **`nodename nor servname provided, or not known`** or **connection refused**, set `DATABASE_URL` in `backend/.env` to Railway’s **public** Postgres URL (e.g. **`DATABASE_PUBLIC_URL`** from the Postgres service Variables). The default `DATABASE_URL` on Railway is often private and only works from Railway’s network.

4. **Check the output**
   - You should see lines like `OK: ALTER TABLE...` and finally `Migrations completed successfully.`

5. **Optional:** Remove or change `DATABASE_URL` in `backend/.env` if you don’t want your local app to use the production database.

### Other ways to run migrations

**Option A – Railway CLI** (if you use the Railway command-line tool)

1. Install: [Railway CLI](https://docs.railway.app/develop/cli).
2. In a terminal, from your **project root** (the folder that contains `backend` and `frontend`):
   ```bash
   railway link
   ```
   When asked, select your **project** and your **backend** service (not the database).
3. Run the script with Railway’s environment (so it uses Railway’s `DATABASE_URL`):
   ```bash
   cd backend
   railway run python run_migrations.py
   ```

**Option B – Railway dashboard (one-off command)**

If your Railway plan supports running a one-off command or a **Shell** in the backend service:

1. Open your **backend** service in Railway.
2. Find **Shell**, **One-off command**, or **Run command** (often under **Settings** or the service menu).
3. Run:
   ```bash
   python run_migrations.py
   ```
   (No `cd backend` needed—the deployed app root is already the backend folder.)

---

## 4. Deploy the frontend

1. **Add the frontend service**  
   In the **same** Railway project (where you have the backend and Postgres), click **+ New** → **GitHub Repo** and select the **same** repo again. You will get a **second** service (the frontend).

2. **Set Root Directory**  
   - Click on the **frontend** service (the one you just added).  
   - Open **Settings**.  
   - Find **Root Directory** (under Build or Source).  
   - In the text box, type exactly: **`frontend`** (no slash, no path—just the word `frontend`).  
   - Save if there is a Save button.  
   This tells Railway to build and run only the `frontend` folder, not the whole repo.

3. **Add the API URL variable**  
   - Open the **Variables** tab for the frontend service.  
   - Click **+ New Variable** (or Add Variable).  
   - **Name:** `NEXT_PUBLIC_API_URL`  
   - **Value:** Get it from your **backend** service:  
     1. In Railway, click your **backend** service (the one with Root Directory = `backend`).  
     2. Go to **Settings** → **Networking** (or the **Deployments** tab).  
     3. Find the **domain** Railway gave the backend (e.g. `https://tasknex-backend.up.railway.app`). Copy it.  
     4. Add `/api` at the end (no space). Example: `https://tasknex-backend.up.railway.app/api`  
     That full URL is what you paste as the **Value** for `NEXT_PUBLIC_API_URL`.

4. **Optional: Google SSO**  
   - In the frontend **Variables** tab, add **`NEXT_PUBLIC_GOOGLE_CLIENT_ID`** = your Google Cloud Web client ID (same as in backend and Google Console).  
   - Redeploy the frontend after adding it.

5. **Generate a domain**  
   - In the frontend service, go to **Settings** → **Networking** (or **Generate domain**).  
   - Click **Generate domain**. Railway will show a URL like `https://your-frontend.up.railway.app`.

6. **Open the app**  
   Open that URL in your browser. That is your deployed app.

### If the frontend loads but the backend seems disconnected

- **Check 1 – Backend URL in the frontend**  
  In Railway → **frontend** service → **Variables**. Ensure **`NEXT_PUBLIC_API_URL`** is set to your **backend** URL + **`/api`**, e.g. `https://your-backend.up.railway.app/api` (no trailing slash). If it is missing or wrong, fix it and **redeploy the frontend** (variables are baked in at build time).

- **Check 2 – Backend is up**  
  In the browser, open: `https://YOUR_BACKEND_DOMAIN/api/health`  
  You should see `{"status":"ok"}`. If you get an error or timeout, the backend service may be down or the URL is wrong.

- **Check 3 – Browser Network tab**  
  On your frontend page, open DevTools (F12) → **Network**. Try logging in or loading the dashboard. Look for requests to your backend domain; if they are red or show CORS/blocked, the frontend is not talking to the right backend or CORS is blocking. Fix `NEXT_PUBLIC_API_URL` and redeploy the frontend.

---

## 5. Google SSO on Railway (optional)

If you use **one-click Google sign-in**, set these so it works in production:

### 5.1 Railway variables

| Service  | Variable | Value |
|----------|----------|--------|
| **Backend** | `GOOGLE_CLIENT_ID` | Your Google Cloud **Web client ID** (same as in Google Cloud Console). |
| **Frontend** | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Same Web client ID as above. |

Add them in each service’s **Variables** tab, then redeploy (frontend must be redeployed so the new env is baked in).

### 5.2 Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com) → your project → **APIs & Services** → **Credentials**.
2. Open your **OAuth 2.0 Client ID** (Web application).
3. Under **Authorized JavaScript origins**, add your **production frontend** URL, e.g.:
   - `https://your-frontend-name.up.railway.app`
   (No path, no trailing slash.)
4. Save. After that, the Google button on your Railway frontend will work.

---

## 6. Checklist

| Item | Backend | Frontend |
|------|---------|----------|
| Root Directory | `backend` | `frontend` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` | `npm start` |
| Env vars | `DATABASE_URL`, `SECRET_KEY`, optional `CORS_ORIGINS`, `OPENAI_API_KEY`, **`GOOGLE_CLIENT_ID`** (for Google SSO) | `NEXT_PUBLIC_API_URL` = backend URL + `/api`, **`NEXT_PUBLIC_GOOGLE_CLIENT_ID`** (for Google SSO) |
| Migrations | Run `python run_migrations.py` once after first deploy | — |

---

## 7. Files to keep (and ignore)

- **Do not commit:** `venv/`, `node_modules/`, `.next/`, `.env`, `.env.local` (handled by `.gitignore`).
- **Keep in repo:** `backend/Procfile`, `backend/railway.toml`, `backend/run_migrations.py`, `backend/migrations/`, `frontend/package.json`, all source code.

---

## 8. Config-as-Code (railway.toml)

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
