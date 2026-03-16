const BUILD_TIME_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// Runtime config: load from /config.json so deployed app can use correct backend without rebuild
let runtimeApiBase: string | null = null;
let configLoadPromise: Promise<void> | null = null;

async function loadRuntimeConfig(): Promise<void> {
  if (configLoadPromise) return configLoadPromise;
  configLoadPromise = (async () => {
    if (typeof window === "undefined") return;
    try {
      const r = await fetch("/config.json", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        const url = j?.apiUrl;
        if (typeof url === "string" && url.trim()) {
          const base = url.trim().replace(/\/+$/, "");
          runtimeApiBase = base.includes("/api") ? base : `${base}/api`;
        }
      }
    } catch {
      // ignore
    }
  })();
  return configLoadPromise;
}

/** API base URL (after optional runtime config is loaded). Use getApiBase() in request(). */
function getApiBaseSync(): string {
  return runtimeApiBase ?? BUILD_TIME_API_BASE;
}

/** Call before making API requests so runtime config is used. */
export async function ensureApiConfig(): Promise<void> {
  await loadRuntimeConfig();
}

/** Backend base URL for display/health link. Resolves after ensureApiConfig(). */
export function getBackendHealthUrl(): string {
  const base = getApiBaseSync().replace(/\/api\/?$/, "") || "http://localhost:8000";
  return `${base}/api/health`;
}

/** Report a client-side error to the backend for log tracking. Fire-and-forget; never throws. */
export function reportClientError(payload: {
  message: string;
  stack?: string | null;
  url?: string | null;
  level?: string;
}): void {
  if (typeof window === "undefined") return;
  const body = {
    message: payload.message,
    stack: payload.stack ?? null,
    url: payload.url ?? window.location?.href ?? null,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    level: payload.level ?? "error",
  };
  const base = getApiBaseSync();
  fetch(`${base}/log/client-error`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

/** Backend health URL (build-time default). Prefer getBackendHealthUrl() after ensureApiConfig(). */
export const BACKEND_HEALTH_URL =
  (BUILD_TIME_API_BASE.replace(/\/api\/?$/, "") || "http://localhost:8000") + "/api/health";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export type User = {
  id: number;
  email: string;
  display_name?: string | null;
  bio?: string | null;
  created_at: string;
};

export type Session = {
  id: string;
  created_at: string;
  last_used_at: string | null;
  label: string | null;
  current: boolean;
};

export type TaskStatus = "planned" | "in_progress" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type IssueType = "task" | "bug" | "story" | "subtask";
export type TaskChecklistItem = {
  id: number;
  task_id: number;
  title: string;
  done: boolean;
  sort_order: number;
};

export type TaskComment = {
  id: number;
  task_id: number;
  user_id: number;
  body: string;
  created_at: string;
  author_name?: string | null;
};

export type WorkflowActivityItem = {
  id: number;
  workflow_id: number;
  user_id: number;
  action: string;
  target_type?: string | null;
  target_id?: number | null;
  details?: string | null;
  created_at: string;
  user_name?: string | null;
};

export type Task = {
  id: number;
  step_id: number;
  title: string;
  description: string;
  document_url?: string | null;
  status: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  labels?: string[];
  issue_type?: IssueType | string;
  assignee_id?: number | null;
  assignee_name?: string | null;
  created_at: string;
  updated_at?: string | null;
  checklist_items?: TaskChecklistItem[];
  comment_count?: number;
};
export type Step = {
  id: number;
  workflow_id: number;
  title: string;
  step_order: number;
  tasks: Task[];
};
export type Workflow = {
  id: number;
  user_id: number;
  title: string;
  goal: string;
  created_at: string;
  steps: Step[];
  role?: string | null;
  status_planned_label?: string | null;
  status_in_progress_label?: string | null;
  status_completed_label?: string | null;
  default_issue_type?: string;
  default_priority?: string | null;
};
export type AssignableUser = {
  id: number;
  email: string;
  display_name?: string | null;
};
export type WorkflowListItem = {
  id: number;
  title: string;
  goal: string;
  created_at: string;
  total_tasks: number;
  completed_tasks: number;
  role?: string | null;
  overdue_count?: number;
  due_soon_count?: number;
};

export type Team = {
  id: number;
  name: string;
  owner_id: number;
  created_at: string;
};

export type TeamMemberResponse = {
  id: number;
  user_id: number;
  email?: string | null;
  display_name?: string | null;
};

export type TeamWithMembers = Team & { members: TeamMemberResponse[] };

export type WorkflowShare = {
  id: number;
  workflow_id: number;
  user_id: number | null;
  team_id: number | null;
  role: string;
};

export type AuthTokenResponse = {
  access_token: string;
  user: User;
};

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  await loadRuntimeConfig();
  const base = getApiBaseSync();
  const { token, ...init } = options;
  const t = token ?? getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (t) (headers as Record<string, string>)["Authorization"] = `Bearer ${t}`;
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Failed to fetch" || e instanceof TypeError) {
      const baseDisplay = base.replace(/\/api\/?$/, "") || "http://localhost:8000";
      throw new Error(
        `Cannot reach the server at ${baseDisplay}. Check: (1) Backend is running (e.g. uvicorn on port 8000). (2) API URL is correct — set NEXT_PUBLIC_API_URL to your backend URL + /api (e.g. https://your-backend.up.railway.app/api).`
      );
    }
    throw e;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const message =
      Array.isArray(err.detail) && err.detail[0]?.msg
        ? err.detail.map((d: { msg?: string }) => d.msg).join(" ")
        : typeof err.detail === "string"
          ? err.detail
          : JSON.stringify(err.detail ?? err);
    // Session revoked or invalid
    if (res.status === 401 && (String(message).toLowerCase().includes("elsewhere") || String(message).toLowerCase().includes("revoked"))) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  auth: {
    signup: (email: string, password: string) =>
      request<AuthTokenResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        token: null,
      }),
    login: (email: string, password: string) =>
      request<AuthTokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        token: null,
      }),
    googleLogin: (idToken: string) =>
      request<AuthTokenResponse>("/auth/google", {
        method: "POST",
        body: JSON.stringify({ id_token: idToken }),
        token: null,
      }),
    me: () => request<User>("/auth/me"),
    updateProfile: (data: { display_name?: string | null; bio?: string | null }) =>
      request<User>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    sessions: {
      list: () => request<Session[]>("/auth/sessions"),
      revoke: (sessionId: string) =>
        request<void>(`/auth/sessions/${sessionId}`, { method: "DELETE" }),
      revokeOthers: () =>
        request<void>("/auth/sessions/revoke-others", { method: "POST" }),
    },
  },
  workflows: {
    list: () => request<WorkflowListItem[]>("/workflows"),
    get: (id: number) => request<Workflow>(`/workflows/${id}`),
    generate: (goal: string) =>
      request<Workflow>("/workflows/generate", {
        method: "POST",
        body: JSON.stringify({ goal }),
      }),
    update: (
      id: number,
      data: {
        title: string;
        goal: string;
        status_planned_label?: string | null;
        status_in_progress_label?: string | null;
        status_completed_label?: string | null;
        default_issue_type?: string;
        default_priority?: string | null;
      }
    ) =>
      request<Workflow>(`/workflows/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    assignableUsers: (workflowId: number) =>
      request<AssignableUser[]>(`/workflows/${workflowId}/assignable-users`),
    delete: (id: number) =>
      request<void>(`/workflows/${id}`, { method: "DELETE" }),
    duplicate: (id: number) =>
      request<Workflow>(`/workflows/${id}/duplicate`, { method: "POST" }),
    listShares: (workflowId: number) =>
      request<WorkflowShare[]>(`/workflows/${workflowId}/shares`),
    share: (
      workflowId: number,
      data: {
        share_with_user_email?: string;
        share_with_team_id?: number;
        role: string;
      }
    ) =>
      request<WorkflowShare>(`/workflows/${workflowId}/shares`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    unshare: (workflowId: number, shareId: number) =>
      request<void>(`/workflows/${workflowId}/shares/${shareId}`, {
        method: "DELETE",
      }),
    updateStepOrder: (workflowId: number, stepId: number, step_order: number) =>
      request<Step>(`/workflows/${workflowId}/steps/${stepId}`, {
        method: "PATCH",
        body: JSON.stringify({ step_order }),
      }),
    addStep: (workflowId: number, title: string, step_order: number) =>
      request<Step>(`/workflows/${workflowId}/steps`, {
        method: "POST",
        body: JSON.stringify({ workflow_id: workflowId, title, step_order }),
      }),
    addTask: (
      workflowId: number,
      stepId: number,
      title: string,
      description: string,
      status: TaskStatus = "planned",
      document_url?: string | null,
      priority?: TaskPriority,
      due_date?: string | null,
      labels?: string[],
      issue_type?: IssueType | string,
      assignee_id?: number | null
    ) =>
      request<Task>(`/workflows/${workflowId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          step_id: stepId,
          title,
          description,
          status,
          document_url: document_url ?? null,
          priority: priority ?? "medium",
          due_date: due_date ?? null,
          labels: labels ?? [],
          issue_type: issue_type ?? "task",
          assignee_id: assignee_id ?? null,
        }),
      }),
    updateTask: (
      workflowId: number,
      taskId: number,
      data: {
        title?: string;
        description?: string;
        document_url?: string | null;
        status?: TaskStatus;
        priority?: TaskPriority;
        due_date?: string | null;
        labels?: string[];
        issue_type?: IssueType | string;
        assignee_id?: number | null;
      }
    ) =>
      request<Task>(`/workflows/${workflowId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    deleteTask: (workflowId: number, taskId: number) =>
      request<void>(`/workflows/${workflowId}/tasks/${taskId}`, {
        method: "DELETE",
      }),
    getActivity: (workflowId: number, limit?: number) =>
      request<WorkflowActivityItem[]>(
        `/workflows/${workflowId}/activity${limit != null ? `?limit=${limit}` : ""}`
      ),
    listComments: (workflowId: number, taskId: number) =>
      request<TaskComment[]>(`/workflows/${workflowId}/tasks/${taskId}/comments`),
    addComment: (workflowId: number, taskId: number, body: string) =>
      request<TaskComment>(`/workflows/${workflowId}/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    addChecklistItem: (workflowId: number, taskId: number, title: string) =>
      request<TaskChecklistItem>(`/workflows/${workflowId}/tasks/${taskId}/checklist`, {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    updateChecklistItem: (
      workflowId: number,
      taskId: number,
      itemId: number,
      data: { title?: string; done?: boolean }
    ) =>
      request<TaskChecklistItem>(
        `/workflows/${workflowId}/tasks/${taskId}/checklist/${itemId}`,
        { method: "PATCH", body: JSON.stringify(data) }
      ),
    deleteChecklistItem: (workflowId: number, taskId: number, itemId: number) =>
      request<void>(
        `/workflows/${workflowId}/tasks/${taskId}/checklist/${itemId}`,
        { method: "DELETE" }
      ),
    aiAssistant: (workflowId: number, prompt: string) =>
      request<Workflow>("/workflows/ai-assistant", {
        method: "POST",
        body: JSON.stringify({ workflow_id: workflowId, prompt }),
      }),
  },
  teams: {
    list: () => request<Team[]>("/teams"),
    create: (name: string) =>
      request<Team>("/teams", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    get: (id: number) => request<TeamWithMembers>(`/teams/${id}`),
    addMember: (teamId: number, email: string) =>
      request<TeamMemberResponse>(`/teams/${teamId}/members`, {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    removeMember: (teamId: number, userId: number) =>
      request<void>(`/teams/${teamId}/members/${userId}`, {
        method: "DELETE",
      }),
    delete: (id: number) =>
      request<void>(`/teams/${id}`, { method: "DELETE" }),
  },
  log: {
    reportClientError,
  },
};
