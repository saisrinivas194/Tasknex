"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { Spinner } from "@/components/Spinner";
import { api, WorkflowListItem } from "@/lib/api";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  const filtered =
    search.trim() === ""
      ? workflows
      : workflows.filter((w) => {
          const q = search.trim().toLowerCase();
          return (
            w.title.toLowerCase().includes(q) || w.goal.toLowerCase().includes(q)
          );
        });

  const load = () => {
    if (!user) return;
    api.workflows
      .list()
      .then(setWorkflows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;
    load();
  }, [user, authLoading, router]);

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this workflow? This cannot be undone.")) return;
    setDeletingId(id);
    api.workflows
      .delete(id)
      .then(() => load())
      .catch((err) => setError(err.message))
      .finally(() => setDeletingId(null));
  };

  const handleDuplicate = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDuplicatingId(id);
    api.workflows
      .duplicate(id)
      .then((w) => router.push(`/workflow/${w.id}`))
      .catch((err) => setError(err.message))
      .finally(() => setDuplicatingId(null));
  };

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
      <Sidebar userEmail={user.email} onLogout={logout} />
      <main className="flex-1 min-h-0 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">
                Workflows
              </h1>
              <p className="text-muted text-sm mt-0.5">
                Your projects and progress
              </p>
            </div>
            <Link href="/dashboard/new" className="btn-primary w-fit shrink-0 text-sm">
              Create
            </Link>
          </div>

          {workflows.length > 0 && (
            <div className="mb-6">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title or goal..."
                className="input-field max-w-md"
                aria-label="Search workflows"
              />
              {search.trim() && (
                <p className="text-muted text-sm mt-1">
                  {filtered.length} of {workflows.length} workflow
                  {workflows.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 mb-6">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Spinner className="h-8 w-8" />
              <p className="text-muted text-sm">Loading workflows…</p>
            </div>
          ) : workflows.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-muted mb-1 font-medium text-white/90">No workflows yet</p>
              <p className="text-muted text-sm mb-6">Create a workflow to break down a goal into steps and tasks.</p>
              <Link href="/dashboard/new" className="btn-primary inline-block">
                Create workflow
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-muted">No workflows match your search.</p>
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-primary hover:underline mt-2 text-sm font-medium"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((w) => {
                const pct =
                  w.total_tasks > 0
                    ? Math.round((w.completed_tasks / w.total_tasks) * 100)
                    : 0;
                return (
                  <div
                    key={w.id}
                    className="card p-4 hover:bg-[#253858] transition relative group border border-[#253858]"
                  >
                    <Link href={`/workflow/${w.id}`} className="block">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-medium text-muted uppercase tracking-wide">
                          WF-{w.id}
                        </span>
                        <span className="badge bg-primary/20 text-primary-200 text-[10px]">
                          {w.completed_tasks}/{w.total_tasks}
                        </span>
                      </div>
                      <h2 className="font-semibold text-white text-sm mt-1 truncate pr-14">
                        {w.title}
                      </h2>
                      <p className="text-muted text-xs mt-0.5 line-clamp-2">
                        {w.goal}
                      </p>
                      <div className="mt-3 h-1.5 w-full rounded-full bg-[#253858] overflow-hidden">
                        <div
                          className="h-full bg-success rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-muted text-[11px] mt-2">
                        {new Date(w.created_at).toLocaleDateString()}
                      </p>
                    </Link>
                    <div
                      className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition"
                      onClick={(e) => e.preventDefault()}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleDuplicate(e, w.id)}
                        disabled={duplicatingId === w.id}
                        className="p-1.5 rounded bg-[#253858] hover:bg-[#344563] text-slate-300 text-xs disabled:opacity-50"
                        title="Duplicate"
                      >
                        {duplicatingId === w.id ? "…" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, w.id)}
                        disabled={deletingId === w.id}
                        className="p-1.5 rounded bg-[#253858] hover:bg-red-500/20 text-red-400 text-xs disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === w.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
