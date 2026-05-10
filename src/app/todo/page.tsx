"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2, Pencil, Plus, X, Check, Circle, CheckCircle2, GripVertical } from "lucide-react";

interface Task {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  deadline: string | null;
  done: boolean;
  sortOrder: number;
  createdAt: string;
}

const PRIORITY_LABELS: Record<string, string> = {
  high: "Vysoká",
  medium: "Střední",
  low: "Nízká",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-300",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
  low: "bg-green-100 text-green-700 border-green-300",
};

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default function TodoPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [newDeadline, setNewDeadline] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<"low" | "medium" | "high">("medium");
  const [editDeadline, setEditDeadline] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [sortBy, setSortBy] = useState<"priority" | "deadline" | "custom">("custom");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragOverId = useRef<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (Array.isArray(data)) setTasks(data);
    } catch {
      setMessage({ type: "error", text: "Chyba při načítání" });
    }
  }

  async function addTask() {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          priority: newPriority,
          deadline: newDeadline || null,
        }),
      });
      if (res.ok) {
        setNewTitle("");
        setNewDeadline("");
        setNewPriority("medium");
        fetchTasks();
        setMessage({ type: "success", text: "Úkol přidán" });
        setTimeout(() => setMessage(null), 2000);
      }
    } catch {
      setMessage({ type: "error", text: "Chyba při přidávání" });
    }
  }

  async function toggleDone(task: Task) {
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, done: !task.done }),
      });
      fetchTasks();
    } catch {
      setMessage({ type: "error", text: "Chyba při úpravě" });
    }
  }

  async function updateTask(id: string) {
    if (!editTitle.trim()) return;
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title: editTitle,
          priority: editPriority,
          deadline: editDeadline || null,
        }),
      });
      setEditingId(null);
      fetchTasks();
    } catch {
      setMessage({ type: "error", text: "Chyba při úpravě" });
    }
  }

  async function deleteTask(id: string) {
    if (!confirm("Smazat úkol?")) return;
    try {
      await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
      fetchTasks();
    } catch {
      setMessage({ type: "error", text: "Chyba při mazání" });
    }
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditDeadline(task.deadline ? task.deadline.split("T")[0] : "");
  }

  // Drag and drop handlers
  function handleDragStart(taskId: string) {
    setDragId(taskId);
  }

  function handleDragOver(e: React.DragEvent, taskId: string) {
    e.preventDefault();
    dragOverId.current = taskId;
  }

  async function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }

    const dragTask = sorted.find((t) => t.id === dragId);
    const targetTask = sorted.find((t) => t.id === targetId);
    if (!dragTask || !targetTask) { setDragId(null); return; }

    // Only allow reorder within same priority group
    if (dragTask.priority !== targetTask.priority) { setDragId(null); return; }

    // Get tasks in same priority group (from sorted list, non-done only)
    const group = sorted.filter((t) => t.priority === dragTask.priority && !t.done);
    const fromIdx = group.findIndex((t) => t.id === dragId);
    const toIdx = group.findIndex((t) => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { setDragId(null); return; }

    // Reorder
    const reordered = [...group];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Assign new sortOrder values
    const reorderPayload = reordered.map((t, i) => ({ id: t.id, sortOrder: i }));

    // Optimistic update
    setTasks((prev) => {
      const updated = [...prev];
      for (const item of reorderPayload) {
        const idx = updated.findIndex((t) => t.id === item.id);
        if (idx !== -1) updated[idx] = { ...updated[idx], sortOrder: item.sortOrder };
      }
      return updated;
    });

    setDragId(null);

    // Persist
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: reorderPayload }),
      });
    } catch {
      fetchTasks(); // Revert on error
    }
  }

  // Filter and sort
  const filtered = tasks.filter((t) => {
    if (!showDone && t.done) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (sortBy === "priority" || sortBy === "custom") {
      const priDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priDiff !== 0) return priDiff;
      // Within same priority, use sortOrder
      return a.sortOrder - b.sortOrder;
    }
    // Sort by deadline
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });

  function isOverdue(task: Task) {
    if (!task.deadline || task.done) return false;
    return new Date(task.deadline) < new Date(new Date().toDateString());
  }

  function isToday(task: Task) {
    if (!task.deadline) return false;
    const today = new Date().toISOString().split("T")[0];
    return task.deadline.split("T")[0] === today;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">📋 TODO</h1>
        </div>
      </header>

      {message && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          <div className={`p-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {message.text}
          </div>
        </div>
      )}

      {/* Add form */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-0 basis-full sm:basis-0">
              <label className="block text-xs text-gray-500 mb-1">Úkol</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="Co je potřeba udělat..."
                className="w-full border rounded-lg px-3 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Priorita</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as "low" | "medium" | "high")}
                className="border rounded-lg px-3 py-2.5 text-base focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="high">Vysoká</option>
                <option value="medium">Střední</option>
                <option value="low">Nízká</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Deadline</label>
              <input
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="border rounded-lg px-3 py-2.5 text-base focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              onClick={addTask}
              disabled={!newTitle.trim()}
              className="flex items-center gap-1 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-base font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              Přidat
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-4xl mx-auto px-4 pt-3">
        <div className="bg-white rounded-lg shadow p-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer"
            />
            Zobrazit dokončené
          </label>
          <span className="border-l border-gray-300 h-6" />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Priorita:</span>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="border rounded px-2 py-1 text-sm cursor-pointer outline-none"
            >
              <option value="">Všechny</option>
              <option value="high">Vysoká</option>
              <option value="medium">Střední</option>
              <option value="low">Nízká</option>
            </select>
          </div>
          <span className="border-l border-gray-300 h-6" />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Řadit:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "priority" | "deadline" | "custom")}
              className="border rounded px-2 py-1 text-sm cursor-pointer outline-none"
            >
              <option value="custom">Vlastní pořadí</option>
              <option value="priority">Podle priority</option>
              <option value="deadline">Podle deadline</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="space-y-3">
          {sorted.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-10 text-center text-gray-400 text-lg">
              Žádné úkoly. Všechno hotovo! 🎉
            </div>
          ) : (
            sorted.map((task) => (
              <div
                key={task.id}
                draggable={!task.done && sortBy !== "deadline"}
                onDragStart={() => handleDragStart(task.id)}
                onDragOver={(e) => handleDragOver(e, task.id)}
                onDrop={(e) => handleDrop(e, task.id)}
                onDragEnd={() => setDragId(null)}
                className={`bg-white rounded-lg shadow px-3 sm:px-4 py-3 sm:py-4 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 transition-all ${
                  task.done ? "opacity-50" : ""
                } ${isOverdue(task) ? "border-l-4 border-red-500" : isToday(task) ? "border-l-4 border-yellow-500" : ""} ${
                  dragId === task.id ? "opacity-40 scale-95" : ""
                } ${dragId && dragId !== task.id && !task.done ? "hover:bg-blue-50" : ""}`}
              >
                {editingId === task.id ? (
                  <div className="flex-1 flex items-center gap-3 flex-wrap">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && updateTask(task.id)}
                      className="flex-1 min-w-[200px] border rounded px-3 py-2 text-base outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value as "low" | "medium" | "high")}
                      className="border rounded px-3 py-2 text-sm cursor-pointer outline-none"
                    >
                      <option value="high">Vysoká</option>
                      <option value="medium">Střední</option>
                      <option value="low">Nízká</option>
                    </select>
                    <input
                      type="date"
                      value={editDeadline}
                      onChange={(e) => setEditDeadline(e.target.value)}
                      className="border rounded px-3 py-2 text-sm outline-none"
                    />
                    <button onClick={() => updateTask(task.id)} className="p-2 text-green-600 hover:bg-green-50 rounded cursor-pointer">
                      <Check className="w-5 h-5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded cursor-pointer">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    {!task.done && sortBy !== "deadline" && (
                      <GripVertical className="w-5 h-5 text-gray-300 cursor-grab flex-shrink-0 hidden sm:block" />
                    )}
                    <button onClick={() => toggleDone(task)} className="flex-shrink-0 cursor-pointer">
                      {task.done ? (
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      ) : (
                        <Circle className="w-6 h-6 text-gray-300 hover:text-blue-500" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0 basis-[calc(100%-4rem)] sm:basis-0">
                      <span className={`text-sm sm:text-base ${task.done ? "line-through text-gray-400" : "text-gray-900"}`}>
                        {task.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 ml-8 sm:ml-0 flex-shrink-0">
                      <span className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded border font-medium whitespace-nowrap ${PRIORITY_COLORS[task.priority]}`}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                      {task.deadline && (
                        <span className={`text-xs sm:text-sm whitespace-nowrap ${isOverdue(task) ? "text-red-600 font-medium" : isToday(task) ? "text-yellow-600 font-medium" : "text-gray-500"}`}>
                          {isOverdue(task) && "⚠️ "}
                          {new Date(task.deadline).toLocaleDateString("cs-CZ")}
                        </span>
                      )}
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => startEdit(task)} className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteTask(task.id)} className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        <div className="text-sm text-gray-400 mt-4 text-center">
          {sorted.filter((t) => !t.done).length} aktivních úkolů
          {tasks.filter((t) => t.done).length > 0 && ` • ${tasks.filter((t) => t.done).length} dokončených`}
        </div>
      </div>
    </div>
  );
}
