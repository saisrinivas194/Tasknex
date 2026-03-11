# Tasknex

**Plan less. Execute faster.**

Tasknex turns your goals into executable workflows with AI. Sign up, describe a goal, get a structured workflow with phases and tasks, then manage progress on a Kanban-style board—with priorities, due dates, labels, document links, and sharing.

---

## Application overview

Tasknex is a full-stack **AI-powered workflow and task management** app. Users create an account, enter a high-level goal (e.g. “Launch a marketing campaign”), and the app generates a workflow made of **phases** (steps) and **tasks**. Tasks can be moved across columns (Planned → In progress → Completed), edited, and enriched with document links, priorities, due dates, and labels. Workflows can be shared via link and email, and exported as Markdown.

| Area | What it does |
|------|----------------|
| **Auth** | Sign up, log in, log out (JWT). Passwords hashed with bcrypt. |
| **Dashboard** | Lists your workflows with progress bars (completed/total tasks). Search, delete, duplicate. “Create workflow” → AI Generator. |
| **AI Generator** | Enter a goal → AI (OpenAI or fallback) returns phases and tasks. Create workflow and open it on the board. |
| **Workflow / Kanban** | View one workflow: columns Planned, In progress, Completed. Drag-and-drop tasks, edit (title, description, document link, priority, due date, labels), delete. Export Markdown, edit workflow (phases/tasks), share (copy link, email). |
| **AI Assistant** | On the workflow page: prompt to add more phases or tasks (e.g. “Add testing steps”). |

---

## Tech stack

### Frontend

| Technology | Purpose |
|------------|--------|
| **Next.js 14** (App Router) | React framework, SSR, file-based routing. |
| **TypeScript** | Typed JavaScript. |
| **Tailwind CSS** | Utility-first styling; Tasknex theme (navy, indigo, green) in `tailwind.config.ts` and `globals.css`. |
| **React 18** | UI components and hooks. |

- **Key paths:** `src/app/` (pages), `src/components/` (Sidebar, Logo, TaskBoard, TaskCard, WorkflowEditor, ThemeProvider, AuthProvider), `src/lib/api.ts` (API client and types).

### Backend

| Technology | Purpose |
|------------|--------|
| **Python 3.10–3.12** | Runtime (3.13+ not supported by some deps). |
| **FastAPI** | REST API, OpenAPI docs at `/docs`. |
| **Uvicorn** | ASGI server. |
| **SQLAlchemy 2 (async)** | ORM, async engine. |
| **asyncpg** | Async PostgreSQL driver. |
| **Pydantic** | Request/response schemas and settings. |
| **python-jose** | JWT (access tokens). |
| **passlib + bcrypt** | Password hashing. |
| **httpx** | HTTP client for OpenAI API. |
| **pydantic-settings** | Load env from `.env`. |

- **Key paths:** `app/main.py` (app, CORS, lifespan), `app/config.py` (settings), `app/database.py` (engine, session), `app/models.py` (User, Workflow, Step, Task), `app/schemas.py` (Pydantic models), `app/auth.py` (JWT, get_current_user), `app/routers/auth.py`, `app/routers/workflows.py`, `app/services/ai_workflow.py` (OpenAI + fallback).

### Database

| Technology | Purpose |
|------------|--------|
| **PostgreSQL** | Primary data store. |

- Tables created on first run via `init_db()` (SQLAlchemy `create_all`). Optional migrations in `backend/migrations/` for adding columns to existing DBs.

### AI

| Technology | Purpose |
|------------|--------|
| **OpenAI API** (optional) | Generate workflow from goal (phases + tasks). |
| **Fallback** | If no key or API error (e.g. 429), a default workflow is returned so the endpoint always succeeds. |

---

## Project structure

```
application/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, CORS, lifespan
│   │   ├── config.py        # Settings (env)
│   │   ├── database.py      # Async engine, session, init_db
│   │   ├── auth.py          # JWT, get_current_user
│   │   ├── models.py        # User, Workflow, Step, Task
│   │   ├── schemas.py       # Pydantic request/response
│   │   ├── routers/
│   │   │   ├── auth.py      # signup, login, me
│   │   │   └── workflows.py # CRUD, generate, duplicate, tasks, steps, AI assistant
│   │   └── services/
│   │       └── ai_workflow.py  # OpenAI + fallback workflow
│   ├── migrations/          # SQL and run_migrations.py for existing DBs
│   ├── requirements.txt
│   ├── Procfile             # For Railway (uvicorn)
│   ├── railway.toml
│   ├── .env.example
│   └── run_migrations.py
├── frontend/
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   │   ├── page.tsx     # Home / landing
│   │   │   ├── layout.tsx
│   │   │   ├── login/       # Login page
│   │   │   ├── signup/      # Signup page
│   │   │   ├── dashboard/   # Dashboard, dashboard/new (AI Generator)
│   │   │   └── workflow/[id]/  # Workflow detail + Kanban
│   │   ├── components/      # Sidebar, Logo, TaskBoard, TaskCard, etc.
│   │   └── lib/
│   │       └── api.ts       # API client, types
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── next.config.*
│   └── .env.local.example
├── run_backend.sh           # Local: run backend from repo root
├── .gitignore
├── README.md                # This file
├── SETUP.md                 # Detailed local run instructions
└── DEPLOY.md                # Railway deployment guide
```

---

## Database schema

| Table | Columns |
|-------|---------|
| **users** | id, email, password_hash, created_at |
| **workflows** | id, user_id, title, goal, created_at |
| **steps** | id, workflow_id, title, step_order |
| **tasks** | id, step_id, title, description, document_url, status (planned \| in_progress \| completed), priority (low \| medium \| high \| critical), due_date, labels (text, comma-separated), created_at |

- **Relations:** User → Workflows; Workflow → Steps (ordered); Step → Tasks.
- Tables are created on app startup via `init_db()`. For DBs created before added columns (e.g. document_url, priority, due_date, labels), run once: `backend/migrations/run_all_task_migrations.sql` or `python backend/run_migrations.py` (see SETUP.md).

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL URL, e.g. `postgresql+asyncpg://user:pass@host:5432/dbname` |
| `SECRET_KEY` | Yes | Secret for JWT signing (use a long random string in production) |
| `OPENAI_API_KEY` | No | OpenAI API key for workflow generation; if missing/error, fallback workflow is used |
| `CORS_ORIGINS` | No | Comma-separated origins; empty allows localhost + `*.railway.app` |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | No (default: `http://localhost:8000/api`) | Backend API base URL (must include `/api`) |

---

## Features (summary)

- **Auth:** Sign up (with validation, confirm password), log in, log out. JWT stored in localStorage.
- **Workflows:** Create (via AI or from scratch), list, get, update, delete, duplicate. Search on dashboard.
- **Phases (steps):** Add, reorder (step_order).
- **Tasks:** Add, update (title, description, document_url, status, priority, due_date, labels), delete. Drag-and-drop between Planned / In progress / Completed.
- **AI:** Generate workflow from goal; AI assistant to add phases/tasks from a prompt.
- **Task extras:** Document link (URL per task), priority (low/medium/high/critical), due date, labels (comma-separated). Export Markdown includes these.
- **Share:** Copy workflow link; “Share via email” opens mailto with pre-filled body.
- **Export:** Copy workflow as Markdown to clipboard (or download).
- **Theme:** Light/dark toggle (Tasknex theme: navy, indigo, green).

---

## Running locally

- **Full steps (Mac, PostgreSQL, Python 3.12):** [SETUP.md](./SETUP.md)
- **Short:**  
  - Backend: `cd backend && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`  
  - Or from repo root: `./run_backend.sh`  
  - Frontend: `cd frontend && npm run dev`  
  - Open http://localhost:3000 and (if needed) set `NEXT_PUBLIC_API_URL=http://localhost:8000/api` in `frontend/.env.local`.

---

## Deployment (Railway)

- **Step-by-step:** [DEPLOY.md](./DEPLOY.md)
- **Summary:** Two services (backend + frontend) from the same repo; add PostgreSQL; set Root Directory per service (`backend` / `frontend`); set env vars (`DATABASE_URL`, `SECRET_KEY`, `NEXT_PUBLIC_API_URL`, etc.); run migrations once for the backend DB.

---

## API overview

- **Base path:** `/api`
- **Auth:** `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me` (Bearer token).
- **Health:** `GET /api/health`
- **Workflows:** `GET /api/workflows`, `POST /api/workflows/generate`, `GET /api/workflows/{id}`, `PATCH /api/workflows/{id}`, `DELETE /api/workflows/{id}`, `POST /api/workflows/{id}/duplicate`.
- **Steps:** `POST /api/workflows/{id}/steps`, `PATCH /api/workflows/{id}/steps/{step_id}` (order).
- **Tasks:** `POST /api/workflows/{id}/tasks`, `PATCH /api/workflows/{id}/tasks/{task_id}`, `DELETE /api/workflows/{id}/tasks/{task_id}`.
- **AI:** `POST /api/workflows/ai-assistant` (body: workflow_id, prompt).

Interactive docs: **http://localhost:8000/docs** when the backend is running.

---

## License and attribution

This project is provided as-is. Use SETUP.md and DEPLOY.md for run and deploy instructions.
