"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";

interface Task {
  id: string;
  title: string;
  priority: string;
  deadline: string | null;
  done: boolean;
}

export default function DeadlineReminder() {
  const [dueTasks, setDueTasks] = useState<Task[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkDeadlines();
  }, []);

  async function checkDeadlines() {
    try {
      const res = await fetch("/api/tasks");
      const tasks: Task[] = await res.json();
      if (!Array.isArray(tasks)) return;

      const today = new Date().toISOString().split("T")[0];
      const due = tasks.filter(
        (t) => !t.done && t.deadline && t.deadline.split("T")[0] === today
      );

      if (due.length > 0) setDueTasks(due);
    } catch {
      // ignore
    }
  }

  function dismiss() {
    setDismissed(true);
  }

  if (dismissed || dueTasks.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in">
        <div className="flex items-start gap-3">
          <div className="bg-yellow-100 rounded-full p-2 flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 mb-1">⏰ Připomínka!</h2>
            <p className="text-sm text-gray-600 mb-3">
              {dueTasks.length === 1
                ? "Dnes máš deadline na úkol:"
                : `Dnes máš deadline na ${dueTasks.length} úkoly:`}
            </p>
            <ul className="space-y-2">
              {dueTasks.map((task) => (
                <li key={task.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${task.priority === "high" ? "bg-red-500" : task.priority === "medium" ? "bg-yellow-500" : "bg-green-500"}`} />
                  <span className="text-gray-800">{task.title}</span>
                </li>
              ))}
            </ul>
          </div>
          <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={dismiss}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer"
          >
            OK, rozumím
          </button>
        </div>
      </div>
    </div>
  );
}
