"use client";

import { useState, useEffect } from "react";
import { Task, TaskStatus, TaskPriority, AssignableUser, TaskChecklistItem, TaskComment } from "@/lib/api";
import { api } from "@/lib/api";

const ISSUE_TYPE_LABELS: Record<string, string> = {
  task: "Task",
  bug: "Bug",
  story: "Story",
  subtask: "Sub-task",
};
const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};
const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  low: "bg-[#97A0AF]/90 text-slate-900",
  medium: "bg-primary/90 text-white",
  high: "bg-[#FF8B00]/90 text-white",
  critical: "bg-[#DE350B]/90 text-white",
};
const PRIORITY_BORDER: Record<TaskPriority, string> = {
  low: "card-issue-priority-low",
  medium: "card-issue-priority-medium",
  high: "card-issue-priority-high",
  critical: "card-issue-priority-critical",
};

function formatDueDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const DUE_SOON_DAYS = 3;
function getDueStatus(dueDate: string | null | undefined): "overdue" | "due_soon" | "ok" | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();
  const dueTime = d.getTime();
  if (dueTime < todayTime) return "overdue";
  const daysDiff = Math.ceil((dueTime - todayTime) / (24 * 60 * 60 * 1000));
  if (daysDiff <= DUE_SOON_DAYS) return "due_soon";
  return "ok";
}
function dueInDays(dueDate: string | null | undefined): number | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

type TaskCardProps = {
  task: Task;
  workflowId: number;
  canEdit?: boolean;
  assignableUsers?: AssignableUser[];
  onDragStart: () => void;
  onDragEnd: () => void;
  onUpdate: (updates: {
    title?: string;
    description?: string;
    document_url?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    due_date?: string | null;
    labels?: string[];
    issue_type?: string;
    assignee_id?: number | null;
  }) => void;
  onDelete: () => void;
  onRefresh?: () => void;
};

export function TaskCard({ task, workflowId, canEdit = true, assignableUsers = [], onDragStart, onDragEnd, onUpdate, onDelete, onRefresh }: TaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [checklistNewTitle, setChecklistNewTitle] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [description, setDescription] = useState(task.description);
  const [documentUrl, setDocumentUrl] = useState(task.document_url ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [labelsStr, setLabelsStr] = useState((task.labels ?? []).join(", "));
  const [issueType, setIssueType] = useState(task.issue_type ?? "task");
  const [assigneeId, setAssigneeId] = useState<number | null>(task.assignee_id ?? null);

  useEffect(() => {
    if (commentsOpen && workflowId && task.id) {
      api.workflows.listComments(workflowId, task.id).then(setComments).catch(() => setComments([]));
    }
  }, [commentsOpen, workflowId, task.id]);

  const checklistItems = task.checklist_items ?? [];
  const checklistDone = checklistItems.filter((i) => i.done).length;

  const handleToggleChecklist = (item: TaskChecklistItem) => {
    if (!canEdit || !onRefresh) return;
    setChecklistLoading(true);
    api.workflows
      .updateChecklistItem(workflowId, task.id, item.id, { done: !item.done })
      .then(() => onRefresh())
      .finally(() => setChecklistLoading(false));
  };
  const handleAddChecklistItem = () => {
    const t = checklistNewTitle.trim();
    if (!t || !canEdit || !onRefresh) return;
    setChecklistLoading(true);
    api.workflows
      .addChecklistItem(workflowId, task.id, t)
      .then(() => {
        setChecklistNewTitle("");
        onRefresh();
      })
      .finally(() => setChecklistLoading(false));
  };
  const handleDeleteChecklistItem = (itemId: number) => {
    if (!canEdit || !onRefresh) return;
    setChecklistLoading(true);
    api.workflows
      .deleteChecklistItem(workflowId, task.id, itemId)
      .then(() => onRefresh())
      .finally(() => setChecklistLoading(false));
  };
  const handleAddComment = () => {
    const b = commentBody.trim();
    if (!b || !canEdit || !onRefresh) return;
    setCommentLoading(true);
    api.workflows
      .addComment(workflowId, task.id, b)
      .then(() => {
        setCommentBody("");
        onRefresh();
        return api.workflows.listComments(workflowId, task.id);
      })
      .then(setComments)
      .finally(() => setCommentLoading(false));
  };

  const saveEdit = () => {
    if (title.trim()) {
      const labels = labelsStr.split(",").map((s) => s.trim()).filter(Boolean);
      onUpdate({
        title: title.trim(),
        description: description.trim(),
        document_url: documentUrl.trim() || null,
        priority,
        due_date: dueDate.trim() || null,
        labels,
        issue_type: issueType,
        assignee_id: assigneeId,
      });
    }
    setEditing(false);
  };

  const taskPriority = (task.priority as TaskPriority) ?? "medium";
  return (
    <div
      draggable={canEdit}
      onDragStart={canEdit ? onDragStart : undefined}
      onDragEnd={canEdit ? onDragEnd : undefined}
      className={`card card-issue rounded bg-[#253858] p-2.5 border border-[#344563] transition ${PRIORITY_BORDER[taskPriority]} ${canEdit ? "cursor-grab active:cursor-grabbing hover:border-[#4C9AFF]/50" : ""}`}
    >
      {editing ? (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field text-sm py-1.5"
            placeholder="Task title"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field text-sm py-1.5 min-h-[60px] resize-y"
            placeholder="Description (optional)"
          />
          <div>
            <label className="block text-xs text-muted mb-0.5">Document / link (optional)</label>
            <input
              type="url"
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
              className="input-field text-sm py-1.5"
              placeholder="https://docs.google.com/... or any URL"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted mb-0.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="input-field text-sm py-1.5"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-0.5">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input-field text-sm py-1.5"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted mb-0.5">Issue type</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="input-field text-sm py-1.5"
              >
                {Object.entries(ISSUE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-0.5">Assignee</label>
              <select
                value={assigneeId ?? ""}
                onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : null)}
                className="input-field text-sm py-1.5"
              >
                <option value="">Unassigned</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name?.trim() || u.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-0.5">Labels (comma-separated)</label>
            <input
              type="text"
              value={labelsStr}
              onChange={(e) => setLabelsStr(e.target.value)}
              className="input-field text-sm py-1.5"
              placeholder="bug, frontend, urgent"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={saveEdit} className="btn-primary text-sm py-1.5">
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setTitle(task.title);
                setDescription(task.description);
                setDocumentUrl(task.document_url ?? "");
                setPriority(task.priority ?? "medium");
                setDueDate(task.due_date ?? "");
                setLabelsStr((task.labels ?? []).join(", "));
                setIssueType(task.issue_type ?? "task");
                setAssigneeId(task.assignee_id ?? null);
                setEditing(false);
              }}
              className="btn-secondary text-sm py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <span className="text-[10px] font-medium text-muted shrink-0">TASK-{task.id}</span>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <span className="badge bg-[#344563] text-slate-300 text-[10px] shrink-0">
                {ISSUE_TYPE_LABELS[task.issue_type ?? "task"] ?? task.issue_type ?? "Task"}
              </span>
              <span
                className={`badge shrink-0 ${PRIORITY_CLASSES[taskPriority]}`}
                title="Priority"
              >
                {PRIORITY_LABELS[taskPriority]}
              </span>
            </div>
          </div>
          <p className="text-slate-100 font-medium text-sm mt-0.5 flex-1 min-w-0">{task.title}</p>
          {task.assignee_name && (
            <p className="text-muted text-[11px] mt-0.5">👤 {task.assignee_name}</p>
          )}
          {task.description && (
            <p className="text-muted text-xs mt-1 line-clamp-2">{task.description}</p>
          )}
          {task.due_date && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className={`text-xs ${
                  getDueStatus(task.due_date) === "overdue"
                    ? "text-red-400 font-medium"
                    : getDueStatus(task.due_date) === "due_soon"
                      ? "text-amber-400"
                      : "text-muted"
                }`}
                title="Due date"
              >
                📅 {formatDueDate(task.due_date)}
              </span>
              {task.status !== "completed" && getDueStatus(task.due_date) === "overdue" && (
                <span className="badge bg-red-500/30 text-red-300 text-[10px]">Overdue</span>
              )}
              {task.status !== "completed" && getDueStatus(task.due_date) === "due_soon" && (
                <span className="badge bg-amber-500/20 text-amber-400 text-[10px]">
                  Due in {dueInDays(task.due_date)} day{(dueInDays(task.due_date) ?? 0) !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
          {task.updated_at && (
            <p className="text-muted text-[10px] mt-0.5">
              Updated {new Date(task.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          )}
          {(task.labels?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {(task.labels ?? []).map((l) => (
                <span
                  key={l}
                  className="badge bg-[#344563] text-slate-300"
                >
                  {l}
                </span>
              ))}
            </div>
          )}
          {task.document_url && (
            <a
              href={task.document_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-primary text-xs mt-1 hover:underline"
            >
              <span aria-hidden>🔗</span> Document link
            </a>
          )}
          {checklistItems.length > 0 && (
            <div className="mt-1.5 space-y-1" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] text-muted">Checklist ({checklistDone}/{checklistItems.length})</span>
              <ul className="space-y-0.5">
                {checklistItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleToggleChecklist(item)}
                      disabled={!canEdit || checklistLoading}
                      className="rounded border-[#344563] bg-[#1E3A5F] text-primary"
                    />
                    <span className={item.done ? "text-muted line-through flex-1 min-w-0" : "text-slate-300 flex-1 min-w-0 truncate"}>
                      {item.title}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDeleteChecklistItem(item.id)}
                        disabled={checklistLoading}
                        className="text-slate-500 hover:text-red-400 text-[10px] shrink-0"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {canEdit && (
                <div className="flex gap-1 mt-0.5">
                  <input
                    type="text"
                    value={checklistNewTitle}
                    onChange={(e) => setChecklistNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddChecklistItem()}
                    placeholder="Add item..."
                    className="input-field text-xs py-1 flex-1 min-w-0"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    disabled={!checklistNewTitle.trim() || checklistLoading}
                    className="btn-primary text-xs py-1 px-2"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          )}
          {canEdit && checklistItems.length === 0 && (
            <div className="mt-1 flex gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={checklistNewTitle}
                onChange={(e) => setChecklistNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddChecklistItem()}
                placeholder="Add checklist..."
                className="input-field text-xs py-1 flex-1 min-w-0"
              />
              <button
                type="button"
                onClick={handleAddChecklistItem}
                disabled={!checklistNewTitle.trim() || checklistLoading}
                className="btn-primary text-xs py-1 px-2"
              >
                Add
              </button>
            </div>
          )}
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setCommentsOpen(!commentsOpen)}
              className="text-muted hover:text-slate-300 text-xs flex items-center gap-1"
            >
              💬 {task.comment_count ?? 0} comment{(task.comment_count ?? 0) !== 1 ? "s" : ""}
            </button>
            {commentsOpen && (
              <div className="mt-1.5 p-1.5 bg-[#1E3A5F] rounded border border-[#344563] space-y-2">
                <ul className="space-y-1 max-h-32 overflow-auto">
                  {comments.map((c) => (
                    <li key={c.id} className="text-xs">
                      <span className="text-muted">{c.author_name ?? "User"}: </span>
                      <span className="text-slate-200">{c.body}</span>
                    </li>
                  ))}
                </ul>
                {canEdit && (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddComment())}
                      placeholder="Add a comment..."
                      className="input-field text-xs py-1 flex-1 min-w-0"
                    />
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={!commentBody.trim() || commentLoading}
                      className="btn-primary text-xs py-1 px-2"
                    >
                      Post
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <select
                value={task.status}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdate({ status: e.target.value as TaskStatus });
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#1E3A5F] border border-[#344563] rounded text-xs text-slate-200 px-2 py-0.5"
              >
                <option value="planned">Planned</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
                className="text-slate-400 hover:text-white text-xs"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Delete this task?")) onDelete();
                }}
                className="text-red-400 hover:text-red-300 text-xs"
              >
                Delete
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
