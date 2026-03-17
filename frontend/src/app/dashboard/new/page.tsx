"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/Spinner";
import { api, ensureApiConfig, getBackendHealthUrl, BACKEND_HEALTH_URL } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";

const POLL_INTERVAL_MS = 2000;
const POLL_DEADLINE_MS = 120000; // 2 min

export default function NewWorkflowPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [backendHealthUrl, setBackendHealthUrl] = useState(BACKEND_HEALTH_URL);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedGoal = goal.trim();
    if (!trimmedGoal) return;
    setError("");
    setLoading(true);
    try {
      let workflowId: number;
      try {
        const res = await api.workflows.generateAsync(trimmedGoal);
        workflowId = res.workflow_id;
      } catch (asyncErr) {
        const msg = asyncErr instanceof Error ? asyncErr.message : String(asyncErr);
        if (msg.includes("Method Not Allowed") || msg.includes("405")) {
          const workflow = await api.workflows.generate(trimmedGoal);
          workflowId = workflow.id;
          if (!mountedRef.current) return;
          router.push(`/workflow/${workflowId}`);
          router.refresh();
          return;
        }
        throw asyncErr;
      }
      if (!mountedRef.current) return;
      const deadline = Date.now() + POLL_DEADLINE_MS;
      while (Date.now() < deadline && mountedRef.current) {
        const workflow = await api.workflows.get(workflowId);
        if (!mountedRef.current) return;
        if (workflow.steps?.length) {
          router.push(`/workflow/${workflowId}`);
          router.refresh();
          return;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      if (!mountedRef.current) return;
      router.push(`/workflow/${workflowId}`);
      router.refresh();
    } catch (err) {
      if (!mountedRef.current) return;
      try {
        const list = await api.workflows.list();
        if (mountedRef.current && list.length > 0) {
          const sorted = [...list].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          const latest = sorted[0];
          if (Date.now() - new Date(latest.created_at).getTime() < 120000) {
            router.push(`/workflow/${latest.id}`);
            router.refresh();
            return;
          }
        }
      } catch {
        // ignore
      }
      setError(err instanceof Error ? err.message : "Failed to generate workflow");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    ensureApiConfig().then(() => setBackendHealthUrl(getBackendHealthUrl()));
  }, []);

  async function testConnection(): Promise<boolean> {
    setConnectionOk(null);
    await ensureApiConfig();
    const url = getBackendHealthUrl();
    try {
      const res = await fetch(url);
      const ok = res.ok;
      setConnectionOk(ok);
      return ok;
    } catch {
      setConnectionOk(false);
      return false;
    }
  }

  async function wakeBackendAndRetry() {
    setError("");
    const ok = await testConnection();
    if (ok) {
      setSuccessMessage("Backend is up. Click \"Generate workflow\" again.");
      setTimeout(() => setSuccessMessage(""), 5000);
    } else {
      setError("Backend still unreachable. Open the \"Verify backend in new tab\" link to wake Railway, then click \"Wake backend & retry\" again.");
    }
  }

  const logout = () => {
    localStorage.removeItem("token");
    router.push("/");
    router.refresh();
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-navy">
        <Spinner className="h-8 w-8" />
        <p className="text-muted text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-h-0 p-8 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            AI Generator
          </h1>
          <p className="text-muted mt-1 mb-6">
            Describe your goal and we&apos;ll generate a step-by-step workflow with phases and tasks.
          </p>

          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            {successMessage && (
              <div className="text-sm rounded-lg px-3 py-2 border text-emerald-200 bg-emerald-500/10 border-emerald-500/30" role="status">
                {successMessage}
              </div>
            )}
            {error && (
              <div
                className={`text-sm rounded-lg px-3 py-2 border ${
                  error.includes("Cannot reach the server")
                    ? "text-amber-200 bg-amber-500/10 border-amber-500/30"
                    : "text-red-400 bg-red-500/10 border-red-500/30"
                }`}
                role="alert"
              >
                {error}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary/20 border border-primary/40 text-primary font-medium hover:bg-primary/30"
                  >
                    Open Workflows
                  </Link>
                </div>
                <p className="mt-2 text-slate-300 text-xs">
                  If a new workflow appeared in <Link href="/dashboard" className="text-primary hover:underline font-medium">Workflows</Link>, it was created — open it from there.
                </p>
                {error.includes("Cannot reach the server") && typeof window !== "undefined" && !window.location.origin.startsWith("http://localhost") && (
                  <div className="mt-2 p-2 rounded bg-slate-700/50 border border-slate-600 text-slate-200 text-xs">
                    <p className="font-medium">You’re on the live site.</p>
                    <p className="mt-1">The app loads the backend URL from <strong>/config.json</strong>. Ensure <code className="bg-slate-800 px-1 rounded">public/config.json</code> in your repo contains <code className="bg-slate-800 px-1 rounded">{"{\"apiUrl\": \"https://your-backend.up.railway.app/api\"}"}</code> and redeploy the frontend.</p>
                  </div>
                )}
                {error.includes("Cannot reach the server") && connectionOk === true && (
                  <p className="mt-2 text-amber-200/90 text-xs">
                    Connection test passed, so the backend is reachable. The request may have timed out (AI can take 1–2 min). Try &quot;Generate workflow&quot; again, or check <Link href="/dashboard" className="text-primary hover:underline">Workflows</Link> — it may have been created.
                  </p>
                )}
                {error.includes("Request timed out") && (
                  <p className="mt-2 text-amber-200/90 text-xs">
                    Check <Link href="/dashboard" className="text-primary hover:underline">Workflows</Link> — the workflow may have been created.
                  </p>
                )}
                {error.includes("Cannot reach the server") && (
                  <div className="mt-3 text-xs text-muted space-y-2">
                    <p className="font-medium text-slate-300">Quick fix:</p>
                    <button
                      type="button"
                      onClick={wakeBackendAndRetry}
                      className="mt-1 px-3 py-1.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 font-medium hover:bg-amber-500/30"
                    >
                      Wake backend & retry
                    </button>
                    <p className="font-medium text-slate-300 mt-2">Checklist:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>
                        <a
                          href={backendHealthUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Verify backend in new tab
                        </a>
                        {" "}— if you see {"{"}"status":"ok"{"}"}, the backend is up.{" "}
                        <button
                          type="button"
                          onClick={() => testConnection()}
                          className="text-primary hover:underline font-medium"
                        >
                          Test connection from app
                        </button>
                        {connectionOk === true && " ✓ OK"}
                        {connectionOk === false && " ✗ Failed"}
                      </li>
                      {typeof window !== "undefined" && backendHealthUrl.startsWith("https://") ? (
                        <>
                          <li>If the backend is on <strong>Railway</strong>, it may be sleeping — open the link above to wake it, then try again.</li>
                          <li>If you&apos;re running the app at <strong>http://localhost:3000</strong>, the backend now allows CORS from localhost. Redeploy the backend if you just changed it.</li>
                        </>
                      ) : (
                        <>
                          <li>Start the backend in a <strong>separate terminal</strong>: <code className="bg-slate-700 px-1 rounded text-slate-300">cd backend && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000</code></li>
                          <li>Use the app at <strong>http://localhost:3000</strong>.</li>
                        </>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Describe your goal
              </label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="input-field min-h-[120px] resize-y"
                placeholder="e.g. Build a portfolio website, Launch an ecommerce store, Prepare for data science interviews"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Generating workflow… (may take 1–2 min)" : "Generate workflow"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
