"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { api, Workflow, Task, TaskStatus, WorkflowShare, Team, AssignableUser, WorkflowActivityItem } from "@/lib/api";
import { TaskBoard } from "@/components/TaskBoard";
import { Sidebar } from "@/components/Sidebar";
import { Spinner } from "@/components/Spinner";
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
  const [shares, setShares] = useState<WorkflowShare[]>([]);
  const [shareModalOwner, setShareModalOwner] = useState<boolean | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTeamId, setInviteTeamId] = useState<number | null>(null);
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor">("viewer");
  const [sharing, setSharing] = useState(false);
  const [removingShareId, setRemovingShareId] = useState<number | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [activity, setActivity] = useState<WorkflowActivityItem[]>([]);
  const [activityOpen, setActivityOpen] = useState(false);

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
        api.workflows.assignableUsers(id).then(setAssignableUsers).catch(() => setAssignableUsers([]));
      })
      .catch((e) => {
        setError(e.message);
        setWorkflow(null);
        setAssignableUsers([]);
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

  useEffect(() => {
    if (activityOpen && workflow?.id) {
      api.workflows.getActivity(workflow.id, 30).then(setActivity).catch(() => setActivity([]));
    }
  }, [activityOpen, workflow?.id]);

  useEffect(() => {
    if (!shareOpen || !workflow) return;
    setShareModalOwner(null);
    api.workflows
      .listShares(workflow.id)
      .then((list) => {
        setShares(list);
        setShareModalOwner(true);
      })
      .catch(() => setShareModalOwner(false));
    api.teams.list().then(setTeams).catch(() => setTeams([]));
  }, [shareOpen, workflow?.id]);

  const onTaskUpdate = (taskId: number, updates: {
    status?: TaskStatus;
    title?: string;
    description?: string;
    document_url?: string | null;
    priority?: import("@/lib/api").TaskPriority;
    due_date?: string | null;
    labels?: string[];
    issue_type?: string;
    assignee_id?: number | null;
  }) => {
    if (!workflow) return;
    api.workflows
      .updateTask(workflow.id, taskId, updates)
      .then(() => refresh())
      .catch((e) => setError(e.message));
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-navy">
        <Spinner className="h-8 w-8" />
        <p className="text-muted text-sm">Loading…</p>
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
      <div className="flex h-screen overflow-hidden">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-8">
          <Spinner className="h-8 w-8" />
          <p className="text-muted text-sm">Loading workflow…</p>
        </main>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar user={user!} onLogout={logout} />
        <main className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 p-8">
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
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-h-0 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="min-w-0">
              <nav className="flex items-center gap-1 text-xs text-muted">
                <Link href="/dashboard" className="hover:text-white transition">
                  Workflows
                </Link>
                <span aria-hidden>/</span>
                <span className="text-white truncate max-w-[200px] sm:max-w-[320px]">
                  {workflow.title}
                </span>
              </nav>
              <h1 className="text-lg font-semibold text-white truncate mt-0.5 flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted uppercase tracking-wide shrink-0">
                  WF-{workflow.id}
                </span>
                {workflow.title}
              </h1>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              <button
                onClick={() => setShareOpen(true)}
                className="px-3 py-1.5 rounded text-sm text-slate-300 hover:bg-[#253858] hover:text-white transition"
              >
                Share
              </button>
              <button onClick={exportMarkdown} className="px-3 py-1.5 rounded text-sm text-slate-300 hover:bg-[#253858] hover:text-white transition">
                Export
              </button>
              {(workflow.role === "owner" || workflow.role === "editor") && (
                <button
                  onClick={() => setEditOpen(true)}
                  className="px-3 py-1.5 rounded text-sm text-slate-300 hover:bg-[#253858] hover:text-white transition"
                >
                  Edit
                </button>
              )}
              <Link href="/dashboard" className="px-3 py-1.5 rounded text-sm text-slate-300 hover:bg-[#253858] hover:text-white transition inline-block">
                Back
              </Link>
              {workflow.role === "owner" && (
                <button
                  onClick={handleDeleteWorkflow}
                  className="text-red-400 hover:bg-red-500/20 px-3 py-1.5 rounded text-sm transition"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 mb-6">
              {error}
            </div>
          )}

          <div className="mb-4 py-3 px-4 rounded bg-[#1E3A5F] border border-[#253858]">
            <p className="text-muted text-xs mb-2">Goal</p>
            <p className="text-white text-sm mb-3">{workflow.goal}</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-[#253858] overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-muted text-xs whitespace-nowrap">
                {completedTasks} of {totalTasks} tasks
              </span>
            </div>
          </div>

          <TaskBoard
            workflow={workflow}
            onTaskUpdate={onTaskUpdate}
            onRefresh={refresh}
            canEdit={workflow.role !== "viewer"}
            assignableUsers={assignableUsers}
          />

          <div className="mt-6">
            <button
              type="button"
              onClick={() => setActivityOpen(!activityOpen)}
              className="text-muted hover:text-white text-sm font-medium flex items-center gap-2"
            >
              {activityOpen ? "▼" : "▶"} Activity
            </button>
            {activityOpen && (
              <div className="mt-2 p-4 rounded bg-[#1E3A5F] border border-[#253858] max-h-64 overflow-auto">
                {activity.length === 0 ? (
                  <p className="text-muted text-sm">No activity yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {activity.map((a) => (
                      <li key={a.id} className="text-xs flex gap-2">
                        <span className="text-muted shrink-0">
                          {new Date(a.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="text-slate-300">
                          <span className="text-muted">{a.user_name ?? "Someone"}</span>
                          {" "}
                          {a.action === "task_created" && "created task"}
                          {a.action === "task_updated" && "updated task"}
                          {a.action === "task_deleted" && "deleted task"}
                          {a.action === "step_created" && "added step"}
                          {a.action === "comment_added" && "added a comment"}
                          {!["task_created", "task_updated", "task_deleted", "step_created", "comment_added"].includes(a.action) && a.action}
                          {a.details && `: ${a.details}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
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

      {shareOpen && workflow && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-auto">
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
            <p className="text-muted text-sm mb-4">
              Share this workflow with others. They need to sign in to Tasknex to view it.
            </p>
            <div className="flex gap-2 mb-4">
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
              className="inline-flex items-center gap-2 btn-secondary text-sm w-full justify-center mb-6"
            >
              <span aria-hidden>✉️</span> Share via email
            </a>

            {shareModalOwner === null && (
              <div className="flex items-center gap-2 py-4 text-muted text-sm">
                <Spinner className="h-4 w-4" /> Loading…
              </div>
            )}
            {shareModalOwner === true && (
              <>
                <hr className="border-[#253858] mb-4" />
                <p className="text-muted text-xs font-medium uppercase tracking-wider mb-2">
                  Shared with
                </p>
                {shares.length > 0 ? (
                  <ul className="space-y-2 mb-4">
                    {shares.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between py-2 px-3 rounded bg-[#253858]/50 text-sm"
                      >
                        <span className="text-white">
                          {s.user_id ? `User #${s.user_id}` : `Team #${s.team_id}`} · {s.role}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setRemovingShareId(s.id);
                            api.workflows
                              .unshare(workflow.id, s.id)
                              .then(() => setShares((prev) => prev.filter((x) => x.id !== s.id)))
                              .catch((e) => setError(e.message))
                              .finally(() => setRemovingShareId(null));
                          }}
                          disabled={removingShareId === s.id}
                          className="text-red-400 hover:bg-red-500/20 px-2 py-1 rounded text-xs disabled:opacity-50"
                        >
                          {removingShareId === s.id ? "…" : "Remove"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted text-sm mb-4">Not shared with anyone yet.</p>
                )}
                <p className="text-muted text-xs font-medium uppercase tracking-wider mb-2">
                  Invite by email
                </p>
                <div className="flex gap-2 mb-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="input-field flex-1 text-sm"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "viewer" | "editor")}
                    className="input-field w-24 text-sm"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button
                    type="button"
                    disabled={sharing || !inviteEmail.trim()}
                    onClick={() => {
                      setSharing(true);
                      api.workflows
                        .share(workflow.id, {
                          share_with_user_email: inviteEmail.trim(),
                          role: inviteRole,
                        })
                        .then((newShare) => {
                          setShares((prev) => [...prev, newShare]);
                          setInviteEmail("");
                        })
                        .catch((e) => setError(e.message))
                        .finally(() => setSharing(false));
                    }}
                    className="btn-primary text-sm whitespace-nowrap disabled:opacity-50"
                  >
                    {sharing ? "…" : "Add"}
                  </button>
                </div>
                {teams.length > 0 && (
                  <>
                    <p className="text-muted text-xs font-medium uppercase tracking-wider mb-2">
                      Share with team
                    </p>
                    <div className="flex gap-2">
                      <select
                        value={inviteTeamId ?? ""}
                        onChange={(e) =>
                          setInviteTeamId(e.target.value ? Number(e.target.value) : null)
                        }
                        className="input-field flex-1 text-sm"
                      >
                        <option value="">Select team</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as "viewer" | "editor")}
                        className="input-field w-24 text-sm"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>
                      <button
                        type="button"
                        disabled={sharing || !inviteTeamId}
                        onClick={() => {
                          if (!inviteTeamId) return;
                          setSharing(true);
                          api.workflows
                            .share(workflow.id, {
                              share_with_team_id: inviteTeamId,
                              role: inviteRole,
                            })
                            .then((newShare) => {
                              setShares((prev) => [...prev, newShare]);
                              setInviteTeamId(null);
                            })
                            .catch((e) => setError(e.message))
                            .finally(() => setSharing(false));
                        }}
                        className="btn-primary text-sm whitespace-nowrap disabled:opacity-50"
                      >
                        {sharing ? "…" : "Add team"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
