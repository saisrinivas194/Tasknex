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
};

export function TaskBoard({ workflow, onTaskUpdate, onRefresh }: TaskBoardProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const allTasks = workflow.steps.flatMap((s) => s.tasks);

  const handleDragStart = (task: Task) => setDraggedTask(task);
  const handleDragEnd = () => setDraggedTask(null);

  const handleDrop = (status: TaskStatus) => {
    if (!draggedTask || draggedTask.status === status) return;
    onTaskUpdate(draggedTask.id, { status });
    setDraggedTask(null);
  };

  const handleAiAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      await api.workflows.aiAssistant(workflow.id, aiPrompt.trim());
      onRefresh();
      setAiPrompt("");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const tasks = allTasks.filter((t) => t.status === col.status);
          return (
            <div
              key={col.status}
              className="card p-4 min-h-[280px] flex flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.status)}
            >
              <h2 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    col.status === "planned"
                      ? "bg-slate-500"
                      : col.status === "in_progress"
                      ? "bg-blue-500"
                      : "bg-success"
                  }`}
                />
                {col.label}
                <span className="text-slate-500 text-sm font-normal">
                  ({tasks.length})
                </span>
              </h2>
              <div className="flex-1 space-y-2 overflow-auto">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    workflowId={workflow.id}
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

      <div className="card p-4">
        <h3 className="font-medium text-slate-200 mb-2">AI Assistant</h3>
        <p className="text-slate-400 text-sm mb-3">
          Ask the AI to add phases or tasks, e.g. &quot;Add testing steps&quot; or &quot;Add a deployment phase&quot;.
        </p>
        <form onSubmit={handleAiAssistant} className="flex gap-2">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="input-field flex-1"
            placeholder="Add testing steps"
            disabled={aiLoading}
          />
          <button type="submit" disabled={aiLoading} className="btn-primary whitespace-nowrap">
            {aiLoading ? "Adding..." : "Apply"}
          </button>
        </form>
      </div>
    </div>
  );
}
