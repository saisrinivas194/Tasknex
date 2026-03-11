"use client";

import { useState } from "react";
import { Workflow, Task, TaskStatus } from "@/lib/api";
import { api } from "@/lib/api";
import { TaskCard } from "./TaskCard";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "planned", label: "Planned" },
  { status: "in_progress", label: "In progress" },
  { status: "completed", label: "Completed" },
];

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
  }) => void;
  onRefresh: () => void;
  canEdit?: boolean;
};

export function TaskBoard({ workflow, onTaskUpdate, onRefresh, canEdit = true }: TaskBoardProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {COLUMNS.map((col) => {
          const tasks = allTasks.filter((t) => t.status === col.status);
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
                    onDragStart={() => handleDragStart(task)}
                    onDragEnd={handleDragEnd}
                    onUpdate={(updates) => onTaskUpdate(task.id, updates)}
                    onDelete={() => {
                      api.workflows.deleteTask(workflow.id, task.id).then(onRefresh);
                    }}
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
