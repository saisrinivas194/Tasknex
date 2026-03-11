"use client";

import { useState } from "react";
import { Workflow, Task, TaskStatus, AssignableUser } from "@/lib/api";
import { api } from "@/lib/api";
import { TaskCard } from "./TaskCard";

const DEFAULT_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "planned", label: "Planned" },
  { status: "in_progress", label: "In progress" },
  { status: "completed", label: "Completed" },
];

type DueFilter = "all" | "overdue" | "due_week" | "due_soon";

function getDueStatus(dueDate: string | null | undefined): "overdue" | "due_soon" | "ok" | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d.getTime() < today.getTime()) return "overdue";
  const days = Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 3) return "due_soon";
  return "ok";
}

function taskMatchesDueFilter(task: Task, filter: DueFilter): boolean {
  if (filter === "all") return true;
  if (!task.due_date) return false;
  const status = getDueStatus(task.due_date);
  const days = dueInDays(task.due_date);
  if (filter === "overdue") return status === "overdue";
  if (filter === "due_soon") return status === "due_soon";
  if (filter === "due_week") return status === "overdue" || (days !== null && days <= 7);
  return true;
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

function sortTasksByDueDate(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    const da = new Date(a.due_date).getTime();
    const db = new Date(b.due_date).getTime();
    return da - db;
  });
}

type TaskBoardProps = {
  workflow: Workflow;
  onTaskUpdate: (taskId: number, updates: {
    status?: TaskStatus;
    title?: string;
    description?: string;
    document_url?: string | null;
    priority?: import("@/lib/api").TaskPriority;
    due_date?: string | null;
    labels?: string[];
    issue_type?: import("@/lib/api").IssueType | string;
    assignee_id?: number | null;
  }) => void;
  onRefresh: () => void;
  canEdit?: boolean;
  assignableUsers?: AssignableUser[];
};

export function TaskBoard({ workflow, onTaskUpdate, onRefresh, canEdit = true, assignableUsers = [] }: TaskBoardProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");

  const columns = DEFAULT_COLUMNS.map((col, i) => ({
    ...col,
    label:
      (i === 0 && workflow.status_planned_label) ||
      (i === 1 && workflow.status_in_progress_label) ||
      (i === 2 && workflow.status_completed_label) ||
      col.label,
  }));

  const allTasks = workflow.steps.flatMap((s) => s.tasks);

  const handleDragStart = (task: Task) => setDraggedTask(task);
  const handleDragEnd = () => setDraggedTask(null);

  const handleDrop = (status: TaskStatus) => {
    if (!canEdit || !draggedTask || draggedTask.status === status) return;
    onTaskUpdate(draggedTask.id, { status });
    setDraggedTask(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-muted text-xs font-medium">Deadline filter:</span>
        {(["all", "overdue", "due_week", "due_soon"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setDueFilter(f)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              dueFilter === f
                ? "bg-primary/30 text-primary-200"
                : "bg-[#253858] text-slate-400 hover:text-white"
            }`}
          >
            {f === "all" ? "All" : f === "overdue" ? "Overdue" : f === "due_week" ? "Due this week" : "Due soon"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {columns.map((col) => {
          const tasks = sortTasksByDueDate(
            allTasks.filter((t) => t.status === col.status && taskMatchesDueFilter(t, dueFilter))
          );
          return (
            <div
              key={col.status}
              className={`rounded bg-[#1E3A5F] border border-[#253858] p-3 min-h-[280px] flex flex-col ${canEdit ? "" : ""}`}
              onDragOver={canEdit ? (e) => e.preventDefault() : undefined}
              onDrop={canEdit ? () => handleDrop(col.status) : undefined}
            >
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      col.status === "planned"
                        ? "bg-slate-500"
                        : col.status === "in_progress"
                        ? "bg-primary-400"
                        : "bg-success"
                    }`}
                  />
                  {col.label}
                </span>
                <span className="badge bg-[#253858] text-muted font-normal">
                  {tasks.length}
                </span>
              </h2>
              <div className="flex-1 space-y-2 overflow-auto min-h-0">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    workflowId={workflow.id}
                    canEdit={canEdit}
                    assignableUsers={assignableUsers}
                    onDragStart={() => handleDragStart(task)}
                    onDragEnd={handleDragEnd}
                    onUpdate={(updates) => onTaskUpdate(task.id, updates)}
                    onDelete={() => {
                      api.workflows.deleteTask(workflow.id, task.id).then(onRefresh);
                    }}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
