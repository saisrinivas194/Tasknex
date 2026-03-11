# AI Workflow Builder — Run from scratch

**These instructions are for Mac with Apple Silicon (M1 / M2 / M3 / M4 / M5).** Paths use Homebrew on ARM (`/opt/homebrew`).

You need **Python 3.10, 3.11, or 3.12** (not 3.13 or 3.14), **Node.js 18+**, and **PostgreSQL** installed.

---

## Step 0: Prerequisites (Mac M-series)

Install if you don’t have them (all via Homebrew on Apple Silicon):

| Tool       | Check command        | Install |
|-----------|----------------------|--------|
| **Python 3.10–3.12** | `python3 --version` | Use **3.10, 3.11, or 3.12** only. If you see 3.13 or 3.14: `brew install python@3.12` and use it for the backend (Step 3). |
| Node.js 18+  | `node --version`   | `brew install node` |
| npm          | `npm --version`   | Comes with Node.js |
| PostgreSQL   | `psql --version`  | `brew install postgresql@16` |

**Important:** The backend does **not** work with Python 3.13 or 3.14. On M-series Macs, use Python 3.12: `brew install python@3.12` and create the venv with `/opt/homebrew/opt/python@3.12/bin/python3.12` (see Step 3).

---

## Step 1: Open the project folder

In a terminal:

```bash
cd /Users/saisrinivaspedhapolla/Desktop/application
```

You should see folders: `backend`, `frontend`, and files like `README.md`.

---

## Step 2: Start PostgreSQL and create the database (Mac M-series)

If you get **`command not found: createdb`**, install and start PostgreSQL:

```bash
brew install postgresql@16
brew services start postgresql@16
```

Add PostgreSQL to your PATH (Apple Silicon Homebrew path):

```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Create the database. If your default DB user is your Mac username:

```bash
createdb workflow_builder
```

If that fails with “role does not exist”, use the `postgres` user:

```bash
/opt/homebrew/opt/postgresql@16/bin/createuser -s postgres
/opt/homebrew/opt/postgresql@16/bin/createdb -U postgres workflow_builder
```

In `backend/.env` set:

- If you used your Mac user:  
  `DATABASE_URL=postgresql+asyncpg://YOUR_MAC_USERNAME@localhost:5432/workflow_builder`  
  (replace `YOUR_MAC_USERNAME` with `whoami`; often no password.)
- If you used `postgres`:  
  `DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/workflow_builder`

### Troubleshooting Step 2 (Mac M-series)

- **`brew services start postgresql@16` fails with "Bootstrap failed: 5: Input/output error"**  
  Try unloading first: `brew services stop postgresql@16`, then `launchctl bootout gui/501 ~/Library/LaunchAgents/homebrew.mxcl.postgresql@16.plist` (spelling: **launchctl** with letter L, not 1). If **bootout also fails with "Boot-out failed: 5: Input/output error"**, skip the service and **run PostgreSQL manually** (next bullet)—no launchctl needed.

- **Run PostgreSQL manually (without brew services)**  
  Start the server:  
  `/opt/homebrew/opt/postgresql@16/bin/pg_ctl -D /opt/homebrew/var/postgresql@16 start`  
  Check it’s running:  
  `/opt/homebrew/opt/postgresql@16/bin/pg_isready -h localhost`  
  Data directory on Mac M-series is `/opt/homebrew/var/postgresql@16`. Create the DB with `createdb workflow_builder` (or `createdb -U postgres workflow_builder`) with PostgreSQL in your PATH. Stop when done:  
  `/opt/homebrew/opt/postgresql@16/bin/pg_ctl -D /opt/homebrew/var/postgresql@16 stop`

- **Existing database (task document links):** If you created the database before the “task document link” feature was added, run once:  
  `psql -d workflow_builder -f backend/migrations/add_task_document_url.sql`  
  (or the equivalent with your DB name and user.)

- **"column tasks.priority does not exist":** Run migrations once. **Option A:** `cd backend && source venv/bin/activate && python run_migrations.py` **Option B:** `psql -d workflow_builder -f backend/migrations/run_all_task_migrations.sql`

---

## Step 3: Backend setup

**3.1** Go into the backend folder:

```bash
cd /Users/saisrinivaspedhapolla/Desktop/application/backend
```

**3.2** Create a virtual environment and activate it (Mac M-series):

**Recommended on M-series (avoids Python 3.13/3.14 issues):** use Python 3.12:

```bash
brew install python@3.12   # if not already installed

/opt/homebrew/opt/python@3.12/bin/python3.12 -m venv venv
source venv/bin/activate
```

If you already have Python 3.10, 3.11, or 3.12 as `python3`, you can instead run:

```bash
python3 -m venv venv
source venv/bin/activate
```

After activation you should see `(venv)` in your terminal.

**3.3** Install dependencies:

```bash
pip install -r requirements.txt
```

**3.4** Create the `.env` file in the `backend` folder:

```bash
cp .env.example .env
```

Open `backend/.env` in an editor and set (adjust if your PostgreSQL user/password/port are different):

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/workflow_builder
SECRET_KEY=change-this-to-a-random-secret-key
OPENAI_API_KEY=
```

- Leave `OPENAI_API_KEY` empty to use the built-in fallback workflow (no OpenAI needed).
- To use AI generation, put your OpenAI API key there: `OPENAI_API_KEY=sk-...`

**3.5** Start the backend server:

**Option A — from project root (easiest):**
```bash
cd /Users/saisrinivaspedhapolla/Desktop/application
./run_backend.sh
```

**Option B — from backend folder:**
```bash
cd /Users/saisrinivaspedhapolla/Desktop/application/backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Leave this terminal open. You should see something like:

```text
Uvicorn running on http://0.0.0.0:8000
```

- API: http://localhost:8000  
- API docs: http://localhost:8000/docs  

---

## Step 4: Frontend setup (new terminal)

Open a **second terminal**. Keep the backend running in the first one.

**4.1** Go to the frontend folder:

```bash
cd /Users/saisrinivaspedhapolla/Desktop/application/frontend
```

**4.2** Install dependencies:

```bash
npm install
```

**4.3** (Optional) Set API URL  
The app talks to `http://localhost:8000/api` by default. If your backend is on another URL, create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

**4.4** Start the frontend:

```bash
npm run dev
```

You should see something like:

```text
- Local: http://localhost:3000
```

---

## Step 5: Use the app

1. Open a browser and go to: **http://localhost:3000**
2. Click **Sign up** and create an account (email + password).
3. After signup you’ll be on the **Dashboard**.
4. Click **New workflow**, enter a goal (e.g. “Build a portfolio website”), click **Generate workflow**.
5. You’ll see the **task board** (Planned / In progress / Completed). You can:
   - Drag tasks between columns or use the status dropdown.
   - Edit or delete tasks.
   - Click **Edit workflow** to change title/goal, add phases, or add tasks.
   - Use **AI Assistant** to add more steps (e.g. “Add testing steps”) if you set `OPENAI_API_KEY`.

---

## Troubleshooting

| Problem | What to do |
|--------|------------|
| `createdb: command not found` | Install PostgreSQL: `brew install postgresql@16`, then add to PATH: `export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"`. Or run: `/opt/homebrew/opt/postgresql@16/bin/createdb workflow_builder` |
| `Failed building wheel for asyncpg` or `pydantic-core` | You’re on **Python 3.13 or 3.14**. On Mac M-series use 3.12: `brew install python@3.12`, then `rm -rf venv` and `/opt/homebrew/opt/python@3.12/bin/python3.12 -m venv venv`, `source venv/bin/activate`, `pip install -r requirements.txt` |
| `Connection refused` (database) | Start PostgreSQL (e.g. `brew services start postgresql`). Check host/port in `DATABASE_URL`. |
| `ModuleNotFoundError` or `No module named 'app'` when running uvicorn | You must run uvicorn **from inside the backend folder**. Use `./run_backend.sh` from the project root, or `cd backend` then run uvicorn. |
| `[Errno 48] Address already in use` | Port 8000 is taken (e.g. a previous backend still running). Free it: `lsof -i :8000` to see the PID, then `kill <PID>`. Or run the backend on another port: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8001` (and set `NEXT_PUBLIC_API_URL` in frontend to use port 8001). |
| Frontend can’t reach API | Ensure the backend is running on port 8000. Check `NEXT_PUBLIC_API_URL` in `frontend/.env.local`. |
| CORS errors in browser | Backend allows `http://localhost:3000`. If you use another origin, add it in `backend/app/main.py` in `allow_origins`. |

---

## Quick reference: run the app (Mac M-series)

**Terminal 1 (backend):**
```bash
cd /Users/saisrinivaspedhapolla/Desktop/application
./run_backend.sh
```
(Or: `cd backend && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`)

**Terminal 2 (frontend):**

```bash
cd /Users/saisrinivaspedhapolla/Desktop/application/frontend
npm run dev
```

Then open **http://localhost:3000** in your browser.
