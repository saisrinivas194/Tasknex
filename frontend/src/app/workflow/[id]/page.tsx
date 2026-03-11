"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { api, Workflow, Task, TaskStatus } from "@/lib/api";
import { TaskBoard } from "@/components/TaskBoard";
import { Sidebar } from "@/components/Sidebar";
import { WorkflowEditor } from "@/components/WorkflowEditor";

export default function WorkflowPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const refresh = () => {
    if (!id || id < 1) {
      setLoading(false);
      setWorkflow(null);
      setError("Invalid workflow ID.");
      return;
    }
    setError("");
    api.workflows
      .get(id)
      .then((w) => {
        setWorkflow(w);
        setError("");
      })
      .catch((e) => {
        setError(e.message);
        setWorkflow(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;
    setLoading(true);
    refresh();
  }, [user, authLoading, id, router]);

  const onTaskUpdate = (taskId: number, updates: {
    status?: TaskStatus;
    title?: string;
    description?: string;
    document_url?: string | null;
    priority?: import("@/lib/api").TaskPriority;
    due_date?: string | null;
    labels?: string[];
  }) => {
    if (!workflow) return;
    api.workflows
      .updateTask(workflow.id, taskId, updates)
      .then(() => refresh())
      .catch((e) => setError(e.message));
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  const logout = () => {
    localStorage.removeItem("token");
    router.push("/");
    router.refresh();
  };

  if (loading && !workflow) {
    return (
      <div className="flex min-h-screen">
        <Sidebar userEmail={user.email} onLogout={logout} />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-muted">Loading workflow…</div>
        </main>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex min-h-screen">
        <Sidebar userEmail={user?.email ?? ""} onLogout={logout} />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <p className="text-muted">Workflow not found.</p>
          {error && (
            <p className="text-sm text-amber-500/90 max-w-md text-center">
              {error}
            </p>
          )}
          <Link href="/dashboard" className="btn-primary">
            Back to dashboard
          </Link>
        </main>
      </div>
    );
  }

  const totalTasks = workflow.steps.reduce((acc, s) => acc + s.tasks.length, 0);
  const completedTasks = workflow.steps.reduce(
    (acc, s) => acc + s.tasks.filter((t) => t.status === "completed").length,
    0
  );
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  function exportMarkdown() {
    if (!workflow) return;
    const lines: string[] = [`# ${workflow.title}`, "", `**Goal:** ${workflow.goal}`, ""];
    workflow.steps.forEach((step) => {
      lines.push(`## ${step.title}`, "");
      step.tasks.forEach((t) => {
        const status = t.status === "completed" ? " [x]" : " [ ]";
        const pri = t.priority ? ` [${t.priority}]` : "";
        lines.push(`-${status} ${t.title}${pri}`);
        if (t.description) lines.push(`  ${t.description}`);
        if (t.due_date) lines.push(`  Due: ${t.due_date}`);
        if ((t.labels?.length ?? 0) > 0) lines.push(`  Labels: ${(t.labels ?? []).join(", ")}`);
        if (t.document_url) lines.push(`  Link: ${t.document_url}`);
      });
      lines.push("");
    });
    const text = lines.join("\n");
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => alert("Copied to clipboard."));
    } else {
      const blob = new Blob([text], { type: "text/markdown" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${workflow.title.replace(/[^a-z0-9]/gi, "_")}.md`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }

  function handleDeleteWorkflow() {
    if (!workflow) return;
    if (!confirm("Delete this workflow? This cannot be undone.")) return;
    api.workflows
      .delete(workflow.id)
      .then(() => router.push("/dashboard"))
      .catch((e) => setError(e.message));
  }

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/workflow/${workflow.id}`
      : "";
  const shareSubject = encodeURIComponent(`Tasknex workflow: ${workflow.title}`);
  const shareBody = encodeURIComponent(
    `I'm sharing this workflow with you:\n\n${workflow.title}\n\nOpen it here (you'll need to sign in to your Tasknex account to view):\n${shareUrl}`
  );
  const mailtoHref = `mailto:?subject=${shareSubject}&body=${shareBody}`;

  function copyShareLink() {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar userEmail={user.email} onLogout={logout} />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="min-w-0">
              <Link href="/dashboard" className="text-muted hover:text-white text-sm">
                ← Dashboard
              </Link>
              <h1 className="text-xl font-semibold text-white truncate mt-0.5">
                {workflow.title}
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                onClick={() => setShareOpen(true)}
                className="btn-secondary text-sm"
              >
                Share
              </button>
              <button onClick={exportMarkdown} className="btn-secondary text-sm">
                Export
              </button>
              <button
                onClick={() => setEditOpen(true)}
                className="btn-secondary text-sm"
              >
                Edit workflow
              </button>
              <Link href="/dashboard" className="btn-secondary text-sm">
                All workflows
              </Link>
              <button
                onClick={handleDeleteWorkflow}
                className="text-red-400 hover:bg-red-500/20 px-3 py-1.5 rounded-lg text-sm"
              >
                Delete workflow
              </button>
            </div>
          </div>
          {error && (
            <div className="text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 mb-6">
              {error}
            </div>
          )}

          <div className="mb-6">
            <p className="text-muted text-sm mb-2">Goal: {workflow.goal}</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-muted text-sm whitespace-nowrap">
                {completedTasks}/{totalTasks} tasks
              </span>
            </div>
          </div>

          <TaskBoard
            workflow={workflow}
            onTaskUpdate={onTaskUpdate}
            onRefresh={refresh}
          />
        </div>
      </main>

      {editOpen && (
        <WorkflowEditor
          workflow={workflow}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            refresh();
          }}
        />
      )}

      {shareOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Share workflow</h2>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="text-muted hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-muted text-sm mb-3">
              Share this workflow with others. They’ll need to sign in to Tasknex to view it.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="input-field text-sm flex-1"
              />
              <button
                type="button"
                onClick={copyShareLink}
                className="btn-primary whitespace-nowrap text-sm"
              >
                {shareCopied ? "Copied!" : "Copy link"}
              </button>
            </div>
            <a
              href={mailtoHref}
              className="inline-flex items-center gap-2 btn-secondary text-sm w-full justify-center"
            >
              <span aria-hidden>✉️</span> Share via email
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
