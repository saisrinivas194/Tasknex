"use client";

import { useState } from "react";
import { Workflow } from "@/lib/api";
import { api } from "@/lib/api";

type WorkflowEditorProps = {
  workflow: Workflow;
  onClose: () => void;
  onSaved: () => void;
};

export function WorkflowEditor({ workflow, onClose, onSaved }: WorkflowEditorProps) {
  const [title, setTitle] = useState(workflow.title);
  const [goal, setGoal] = useState(workflow.goal);
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newTaskStepId, setNewTaskStepId] = useState<number | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const saveWorkflow = async () => {
    setSaving(true);
    try {
      await api.workflows.update(workflow.id, { title, goal });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const addPhase = async () => {
    if (!newPhaseName.trim()) return;
    const maxOrder = Math.max(0, ...workflow.steps.map((s) => s.step_order));
    await api.workflows.addStep(workflow.id, newPhaseName.trim(), maxOrder + 1);
    setNewPhaseName("");
    onSaved();
  };

  const addTask = async () => {
    if (!newTaskStepId || !newTaskTitle.trim()) return;
    await api.workflows.addTask(workflow.id, newTaskStepId, newTaskTitle.trim(), "", "planned");
    setNewTaskStepId(null);
    setNewTaskTitle("");
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Edit workflow</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="p-6 overflow-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Goal</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="input-field min-h-[80px] resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Add phase</label>
            <div className="flex gap-2">
              <input
                value={newPhaseName}
                onChange={(e) => setNewPhaseName(e.target.value)}
                className="input-field flex-1"
                placeholder="New phase name"
              />
              <button type="button" onClick={addPhase} className="btn-secondary">
                Add phase
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Add task</label>
            <div className="flex gap-2 flex-wrap">
              <select
                value={newTaskStepId ?? ""}
                onChange={(e) => setNewTaskStepId(e.target.value ? Number(e.target.value) : null)}
                className="input-field flex-1 min-w-[120px]"
              >
                <option value="">Select phase</option>
                {workflow.steps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="input-field flex-1 min-w-[140px]"
                placeholder="Task title"
              />
              <button
                type="button"
                onClick={addTask}
                disabled={!newTaskStepId || !newTaskTitle.trim()}
                className="btn-secondary"
              >
                Add task
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Phases (reorder)</label>
            <ul className="text-slate-300 text-sm space-y-1">
              {workflow.steps.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="flex-1">
                    {s.title} ({s.tasks.length} tasks)
                  </span>
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={async () => {
                        if (i === 0) return;
                        const prev = workflow.steps[i - 1];
                        await api.workflows.updateStepOrder(workflow.id, s.id, prev.step_order);
                        await api.workflows.updateStepOrder(workflow.id, prev.id, s.step_order);
                        onSaved();
                      }}
                      className="p-1 rounded bg-slate-600 hover:bg-slate-500 disabled:opacity-30"
                      disabled={i === 0}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (i === workflow.steps.length - 1) return;
                        const next = workflow.steps[i + 1];
                        await api.workflows.updateStepOrder(workflow.id, s.id, next.step_order);
                        await api.workflows.updateStepOrder(workflow.id, next.id, s.step_order);
                        onSaved();
                      }}
                      className="p-1 rounded bg-slate-600 hover:bg-slate-500 disabled:opacity-30"
                      disabled={i === workflow.steps.length - 1}
                      title="Move down"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="p-6 border-t border-slate-700 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={saveWorkflow}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
