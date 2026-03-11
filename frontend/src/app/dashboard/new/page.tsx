"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { api, BACKEND_HEALTH_URL } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";

export default function NewWorkflowPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    setError("");
    setLoading(true);
    try {
      const workflow = await api.workflows.generate(goal.trim());
      router.push(`/workflow/${workflow.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate workflow");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  async function testConnection() {
    setConnectionOk(null);
    try {
      const res = await fetch(BACKEND_HEALTH_URL);
      setConnectionOk(res.ok);
    } catch {
      setConnectionOk(false);
    }
  }

  const logout = () => {
    localStorage.removeItem("token");
    router.push("/");
    router.refresh();
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar userEmail={user.email} onLogout={logout} />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            AI Generator
          </h1>
          <p className="text-muted mt-1 mb-6">
            Describe your goal and we&apos;ll generate a step-by-step workflow with phases and tasks.
          </p>

          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
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
                {error.includes("Cannot reach the server") && (
                  <div className="mt-3 text-xs text-muted space-y-2">
                    <p className="font-medium text-slate-300">Checklist:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Start the backend in a <strong>separate terminal</strong> and leave it running.</li>
                      <li>
                        <a
                          href={BACKEND_HEALTH_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Verify backend in new tab
                        </a>
                        {" "}— if you see {"{"}"status":"ok"{"}"}, the backend is up.{" "}
                        <button
                          type="button"
                          onClick={testConnection}
                          className="text-primary hover:underline font-medium"
                        >
                          Test connection from app
                        </button>
                        {connectionOk === true && " ✓ OK"}
                        {connectionOk === false && " ✗ Failed"}
                      </li>
                      <li>Use the app at <strong>http://localhost:3000</strong>.</li>
                    </ul>
                    <p className="pt-1">
                      Run: <code className="bg-slate-700 px-1 rounded text-slate-300">cd backend && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000</code>
                    </p>
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
              {loading ? "Generating workflow…" : "Generate workflow"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
