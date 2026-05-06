"use client";

import { useState, useEffect } from "react";
import { Trash2, Pencil, Plus, X, Check } from "lucide-react";

interface BlacklistedCustomer {
  id: string;
  name: string;
  note: string | null;
  createdAt: string;
}

export default function BlacklistPage() {
  const [customers, setCustomers] = useState<BlacklistedCustomer[]>([]);
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    try {
      const res = await fetch("/api/blacklist");
      const data = await res.json();
      if (Array.isArray(data)) setCustomers(data);
    } catch {
      setMessage({ type: "error", text: "Chyba při načítání" });
    }
  }

  async function addCustomer() {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, note: newNote || null }),
      });
      if (res.ok) {
        setNewName("");
        setNewNote("");
        fetchCustomers();
        setMessage({ type: "success", text: "Přidáno" });
      }
    } catch {
      setMessage({ type: "error", text: "Chyba při přidávání" });
    }
    setTimeout(() => setMessage(null), 2000);
  }

  async function updateCustomer(id: string) {
    if (!editName.trim()) return;
    try {
      const res = await fetch("/api/blacklist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName, note: editNote || null }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchCustomers();
      }
    } catch {
      setMessage({ type: "error", text: "Chyba při úpravě" });
    }
  }

  async function deleteCustomer(id: string) {
    if (!confirm("Opravdu smazat?")) return;
    try {
      const res = await fetch(`/api/blacklist?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchCustomers();
    } catch {
      setMessage({ type: "error", text: "Chyba při mazání" });
    }
  }

  function startEdit(customer: BlacklistedCustomer) {
    setEditingId(customer.id);
    setEditName(customer.name);
    setEditNote(customer.note || "");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">
            🐍 Kurvy převlečené za zákazníky
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Lidé co nezaplatili nebo jinak poškodili eshop
          </p>
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
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Jméno a příjmení</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomer()}
                placeholder="Jan Novák"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Poznámka (volitelná)</label>
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomer()}
                placeholder="Nezaplatil objednávku..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              onClick={addCustomer}
              disabled={!newName.trim()}
              className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Přidat
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {customers.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              Zatím žádné záznamy. Snad to tak zůstane! 🤞
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Jméno</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Poznámka</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Přidáno</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    {editingId === customer.id ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {new Date(customer.createdAt).toLocaleDateString("cs-CZ")}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => updateCustomer(customer.id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{customer.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{customer.note || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(customer.createdAt).toLocaleDateString("cs-CZ")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => startEdit(customer)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteCustomer(customer.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-2 text-center">
          Celkem: {customers.length} {customers.length === 1 ? "záznam" : customers.length < 5 ? "záznamy" : "záznamů"}
        </div>
      </div>
    </div>
  );
}
