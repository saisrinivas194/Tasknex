"use client";

import { useState } from "react";
import { Task, TaskStatus, TaskPriority } from "@/lib/api";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};
const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  low: "bg-slate-500/80 text-slate-200",
  medium: "bg-blue-500/80 text-white",
  high: "bg-amber-500/80 text-white",
  critical: "bg-red-500/80 text-white",
};

function formatDueDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type TaskCardProps = {
  task: Task;
  workflowId: number;
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
  }) => void;
  onDelete: () => void;
};

export function TaskCard({ task, workflowId, onDragStart, onDragEnd, onUpdate, onDelete }: TaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [documentUrl, setDocumentUrl] = useState(task.document_url ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [labelsStr, setLabelsStr] = useState((task.labels ?? []).join(", "));

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
      });
    }
    setEditing(false);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="bg-slate-700/60 rounded-lg p-3 border border-slate-600 cursor-grab active:cursor-grabbing hover:border-slate-500 transition"
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
          <div className="flex items-start justify-between gap-2">
            <p className="text-slate-100 font-medium text-sm flex-1 min-w-0">{task.title}</p>
            <span
              className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${PRIORITY_CLASSES[(task.priority as TaskPriority) ?? "medium"]}`}
              title="Priority"
            >
              {PRIORITY_LABELS[(task.priority as TaskPriority) ?? "medium"]}
            </span>
          </div>
          {task.description && (
            <p className="text-muted text-xs mt-1 line-clamp-2">{task.description}</p>
          )}
          {task.due_date && (
            <p className="text-muted text-xs mt-1" title="Due date">
              📅 {formatDueDate(task.due_date)}
            </p>
          )}
          {(task.labels?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {(task.labels ?? []).map((l) => (
                <span
                  key={l}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-600 text-slate-300"
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
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <select
              value={task.status}
              onChange={(e) => {
                e.stopPropagation();
                onUpdate({ status: e.target.value as TaskStatus });
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-600 border border-slate-500 rounded text-xs text-slate-200 px-2 py-0.5"
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
        </>
      )}
    </div>
  );
}
