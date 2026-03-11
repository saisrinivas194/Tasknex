const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/** Backend health check URL (same origin as API). Open in browser to verify backend is running. */
export const BACKEND_HEALTH_URL =
  (API_BASE.replace(/\/api\/?$/, "") || "http://localhost:8000") + "/api/health";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export type User = { id: number; email: string; created_at: string };
export type TaskStatus = "planned" | "in_progress" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "critical";
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
  created_at: string;
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
};
export type WorkflowListItem = {
  id: number;
  title: string;
  goal: string;
  created_at: string;
  total_tasks: number;
  completed_tasks: number;
};

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, ...init } = options;
  const t = token ?? getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (t) (headers as Record<string, string>)["Authorization"] = `Bearer ${t}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Failed to fetch" || e instanceof TypeError) {
      const base = API_BASE.replace(/\/api\/?$/, "") || "http://localhost:8000";
      throw new Error(
        `Cannot reach the server at ${base}. Check: (1) Backend is running (e.g. uvicorn on port 8000). (2) API URL is correct — set NEXT_PUBLIC_API_URL to your backend URL + /api (e.g. https://your-backend.up.railway.app/api).`
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
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  auth: {
    signup: (email: string, password: string) =>
      request<{ access_token: string; user: User }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        token: null,
      }),
    login: (email: string, password: string) =>
      request<{ access_token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        token: null,
      }),
    me: () => request<User>("/auth/me"),
  },
  workflows: {
    list: () => request<WorkflowListItem[]>("/workflows"),
    get: (id: number) => request<Workflow>(`/workflows/${id}`),
    generate: (goal: string) =>
      request<Workflow>("/workflows/generate", {
        method: "POST",
        body: JSON.stringify({ goal }),
      }),
    update: (id: number, data: { title: string; goal: string }) =>
      request<Workflow>(`/workflows/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/workflows/${id}`, { method: "DELETE" }),
    duplicate: (id: number) =>
      request<Workflow>(`/workflows/${id}/duplicate`, { method: "POST" }),
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
      labels?: string[]
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
    aiAssistant: (workflowId: number, prompt: string) =>
      request<Workflow>("/workflows/ai-assistant", {
        method: "POST",
        body: JSON.stringify({ workflow_id: workflowId, prompt }),
      }),
  },
};
