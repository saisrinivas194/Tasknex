# Tasknex — High-Level System Design

**Purpose:** Turn goals into executable workflows with AI; support teams and sharing.

---

## 1. System Overview

Tasknex is a **goal-to-workflow** app: users describe a goal, get an AI-generated workflow (phases + tasks), then track progress on a Kanban board. Users can create teams, share workflows with people or teams (viewer/editor), and manage tasks with priorities, due dates, and labels.

| Concern | Approach |
|--------|----------|
| **Auth** | Email + password; JWT access tokens; bcrypt hashing. |
| **Core entity** | Workflow → Steps (phases) → Tasks. |
| **AI** | OpenAI (goal → JSON workflow); fallback if key missing or API fails. |
| **Collaboration** | Teams (owner + members by email); workflow shares (user or team, viewer/editor). |
| **Deployment** | Frontend + Backend + Postgres (e.g. Railway). |

---

## 2. High-Level Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                      CLIENT (Browser)                      │
                    │  Next.js 14 (App Router) · TypeScript · Tailwind          │
                    │  Dashboard · Workflows · Teams · Settings · Auth          │
                    └───────────────────────────┬─────────────────────────────┘
                                                │ HTTPS / REST
                                                │ (JWT in Authorization header)
                    ┌───────────────────────────▼─────────────────────────────┐
                    │                    BACKEND (FastAPI)                     │
                    │  /api/auth    · /api/workflows   · /api/teams            │
                    │  JWT auth · RBAC (owner/editor/viewer) · CORS            │
                    └───────┬─────────────────────────────┬───────────────────┘
                            │                             │
              ┌─────────────▼─────────────┐   ┌───────────▼───────────┐
              │   PostgreSQL (asyncpg)    │   │   OpenAI API (optional) │
              │   users · workflows       │   │   Chat completions      │
              │   steps · tasks           │   │   (workflow generation)  │
              │   teams · team_members    │   └─────────────────────────┘
              │   workflow_shares         │
              └──────────────────────────┘
```

- **Client:** SPA-style Next.js app; calls backend REST API with JWT.
- **Backend:** Single FastAPI service; stateless; uses DB and optional OpenAI.
- **Database:** Single Postgres instance; all app data.
- **External:** OpenAI for workflow generation (and AI assistant); no other third-party services.

---

## 3. Components

### 3.1 Frontend (Next.js)

| Area | Responsibility |
|------|----------------|
| **Auth** | Login/signup forms; store JWT; AuthProvider; redirect unauthenticated. |
| **Dashboard** | List workflows (owned + shared), search, create/duplicate/delete; link to workflow board. |
| **Create with AI** | Goal input → POST /workflows/generate → redirect to new workflow. |
| **Workflow board** | Single workflow: Kanban (Planned / In progress / Completed), task CRUD, drag-and-drop; role-based edit/delete (owner/editor vs viewer). |
| **Share** | Modal: copy link, invite by email, share with team; list/remove shares (owner only). |
| **Teams** | List/create teams; team detail: members, add by email, remove, delete team. |
| **Settings** | Profile: display name, bio (PATCH /auth/me). |

**API boundary:** `src/lib/api.ts` — base URL from `NEXT_PUBLIC_API_URL`, JWT from `localStorage`, typed requests/responses.

### 3.2 Backend (FastAPI)

| Component | Responsibility |
|-----------|----------------|
| **Config** | Env: `DATABASE_URL`, `SECRET_KEY`, `OPENAI_API_KEY`, `CORS_ORIGINS`, etc. |
| **Database** | Async engine (asyncpg); session per request; `init_db()` creates tables. |
| **Models** | SQLAlchemy: User, Workflow, Step, Task, Team, TeamMember, WorkflowShare. |
| **Auth** | JWT issue/verify; `get_current_user` dependency; password hashing (bcrypt). |
| **Routers** | `auth` (signup, login, me, PATCH me); `workflows` (CRUD, generate, steps, tasks, shares, duplicate, ai-assistant); `teams` (CRUD, members). |
| **Workflow access** | `get_workflow_and_access(db, user_id, workflow_id)` → (workflow, role) for owner/editor/viewer. |
| **AI** | `generate_workflow_from_goal(goal)` → JSON workflow; `ai_assistant_add_tasks(...)` → extra phases/tasks; fallback if no key or error. |

### 3.3 Database (PostgreSQL)

- **Persistence:** All state in Postgres; no server-side session store (stateless JWT).
- **Schema:** Managed by SQLAlchemy models + optional `run_migrations.py` (ALTER/CREATE for existing deploys).
- **Connections:** Async only (asyncpg); connection pool from SQLAlchemy engine.

### 3.4 External: OpenAI

- **Usage:** Goal → workflow (phases + tasks); prompt → extra phases/tasks on existing workflow.
- **Failure mode:** If key missing or API error, backend returns fallback workflow or empty phases; app remains usable.

---

## 4. Data Model (Conceptual)

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    User      │       │   Workflow   │       │    Step      │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id           │──┐    │ id           │──┐    │ id           │
│ email        │  │    │ user_id (FK) │  │    │ workflow_id  │──┐
│ password_hash│  │    │ title, goal  │  │    │ title        │  │
│ display_name │  │    │ created_at   │  │    │ step_order   │  │
│ bio          │  │    └──────────────┘  │    └──────────────┘  │
└──────────────┘  │           │          │           │          │
       │          │           │          │           ▼          │
       │          │           │          │    ┌──────────────┐  │
       │          │           │          │    │    Task      │  │
       │          │           │          └───┤ id           │  │
       │          │           │              │ step_id (FK) │  │
       │          │           │              │ title, desc  │  │
       │          │           │              │ status       │  │
       │          │           │              │ priority     │  │
       │          │           │              │ due_date     │  │
       │          │           │              │ labels       │  │
       │          │           │              └──────────────┘  │
       │          │           │                                 │
       │    ┌─────▼─────┐      │    ┌──────────────────────────┐ │
       │    │   Team    │      │    │     WorkflowShare        │ │
       │    ├───────────┤      └───► workflow_id, user_id?,   │ │
       │    │ id, name  │           │ team_id?, role           │ │
       └───►│ owner_id  │           └──────────────────────────┘
            └─────┬─────┘
                  │
            ┌─────▼─────────┐
            │  TeamMember   │
            │ team_id       │
            │ user_id       │
            └───────────────┘
```

- **User:** Identity and profile; owns workflows and teams; can be in teams and have workflow shares.
- **Workflow:** Belongs to one user (owner); has many Steps (ordered); each Step has many Tasks.
- **Task:** Status (planned / in_progress / completed), priority, due_date, labels, document_url.
- **Team:** Has owner (User); members (TeamMember) by user_id; workflow_shares can reference a team.
- **WorkflowShare:** Either (workflow_id, user_id) or (workflow_id, team_id); role = viewer | editor. Access: owner always; editor = edit; viewer = read-only.

---

## 5. Key Flows

### 5.1 Authentication

1. User signs up or logs in → backend checks credentials, hashes on signup, verifies on login.
2. Backend returns JWT (access token) and user payload.
3. Frontend stores JWT (e.g. localStorage); sends `Authorization: Bearer <token>` on every API call.
4. Protected routes use `get_current_user` (verify JWT, load user from DB); 401 if invalid/missing.

### 5.2 Generate Workflow from Goal

1. User enters goal on “Create with AI” page → POST `/api/workflows/generate` with `{ "goal": "..." }`.
2. Backend calls `generate_workflow_from_goal(goal)` → OpenAI (or fallback) returns `{ title, phases: [{ title, order, tasks }] }`.
3. Backend creates Workflow, Steps, Tasks in one transaction; returns full workflow.
4. Frontend redirects to `/workflow/:id`.

### 5.3 Workflow Access (List / Open / Edit / Delete)

1. **List:** `GET /api/workflows` returns workflows where user is owner or has a share (direct user or via team membership); each item includes `role` (owner | editor | viewer).
2. **Open:** `GET /api/workflows/:id` uses `get_workflow_and_access`; allowed if role is owner/editor/viewer; response includes `role`.
3. **Edit (workflow or tasks):** Allowed if role is owner or editor; viewer gets 403.
4. **Delete workflow:** Allowed only for owner.

### 5.4 Sharing a Workflow

1. Owner opens Share modal → GET `/api/workflows/:id/shares` (403 for non-owner).
2. Owner adds share: POST `/api/workflows/:id/shares` with `share_with_user_email` or `share_with_team_id` and `role` (viewer | editor).
3. Backend creates WorkflowShare (user_id XOR team_id); team members resolve to users when evaluating access.
4. Unshare: DELETE `/api/workflows/:id/shares/:share_id` (owner only).

### 5.5 Teams

1. User creates team → POST `/api/teams` with name.
2. Add member: POST `/api/teams/:id/members` with email (user must exist).
3. List teams / get team with members: GET `/api/teams`, GET `/api/teams/:id`.
4. Remove member / delete team: DELETE (owner only).

---

## 6. API Surface (Summary)

| Area | Methods | Notes |
|------|---------|--------|
| **Auth** | POST signup, login; GET me; PATCH me | JWT in response; PATCH for profile. |
| **Workflows** | GET list, GET one, POST generate, PATCH, DELETE, POST duplicate | List includes shared + role. |
| **Steps** | POST; PATCH (order) | Scoped by workflow; edit requires owner/editor. |
| **Tasks** | POST; PATCH; DELETE | Same. |
| **Shares** | GET list, POST add, DELETE remove | Owner only. |
| **AI** | POST /workflows/ai-assistant | Add phases/tasks from prompt; owner/editor. |
| **Teams** | GET list, POST create, GET one, POST add member, DELETE member, DELETE team | Member add by email. |

All under `/api`; OpenAPI at `/docs`.

---

## 7. Security

- **Passwords:** Bcrypt; never stored or returned in plain text.
- **Auth:** JWT (HS256); expiry from config; no refresh token in current design.
- **Authorization:** Per-route: `get_current_user`; workflow/team actions check owner or membership/share role.
- **CORS:** Configurable origins; regex for *.railway.app in production.
- **Secrets:** SECRET_KEY and OPENAI_API_KEY from env; not committed.
- **DB:** Parameterized queries via ORM; no raw SQL from user input.

---

## 8. Deployment (e.g. Railway)

- **Frontend:** Static/SSR build; served from same or separate origin; `NEXT_PUBLIC_API_URL` points to backend `/api`.
- **Backend:** Single FastAPI app; Uvicorn; env: `DATABASE_URL`, `SECRET_KEY`, `OPENAI_API_KEY`, `CORS_ORIGINS`.
- **Database:** Managed Postgres; migrations via `run_migrations.py` (from repo or CI) using public DB URL when needed.
- **No in-memory state:** Horizontal replication of backend is possible; DB is single source of truth.

---

## 9. Scalability and Evolution

- **Current:** One backend instance, one DB; suitable for small/medium usage.
- **Scaling:** Add read replicas for DB if needed; cache workflow list per user if needed; keep JWT stateless.
- **Possible extensions:** Organizations (above teams), webhooks, audit log, real-time updates (WebSockets), file attachments, mobile app reusing same API.

This document describes the high-level system design for Tasknex as of the current implementation.
