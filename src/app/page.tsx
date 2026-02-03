"use client";

import { useState, useEffect } from "react";
import { Package, Mail, FileText, Plus, Trash2, Printer } from "lucide-react";

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice?: string;
  label?: {
    id: string;
    nazev: string;
    slozeni: string;
    nutricniHodnoty: string;
    skladovani: string;
    vyrobce: string;
  } | null;
}

interface Order {
  id: string;
  orderNumber: string;
  emailDate: string;
  totalPrice?: string;
  items: OrderItem[];
}

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [daysBack, setDaysBack] = useState(30);
  const [startPosition, setStartPosition] = useState(1);
  const [labelModal, setLabelModal] = useState<{
    open: boolean;
    productName: string;
  } | null>(null);
  const [labelForm, setLabelForm] = useState({
    nazev: "",
    slozeni: "",
    nutricniHodnoty: "",
    skladovani: "",
    vyrobce: "",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    checkAuth();
    fetchOrders();
  }, []);

  async function checkAuth() {
    const res = await fetch("/api/gmail");
    const data = await res.json();
    setAuthenticated(data.authenticated);
  }

  async function fetchOrders() {
    const res = await fetch("/api/orders");
    const data = await res.json();
    if (Array.isArray(data)) {
      setOrders(data);
    }
  }

  async function syncEmails() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysBack }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage({ type: "error", text: data.error });
      } else {
        setMessage({
          type: "success",
          text: `Nalezeno: ${data.found}, Uloženo: ${data.saved}, Přeskočeno: ${data.skipped}`,
        });
        fetchOrders();
      }
    } catch {
      setMessage({ type: "error", text: "Chyba při synchronizaci" });
    }
    setLoading(false);
  }

  async function deleteOrders() {
    if (selectedOrders.length === 0) return;
    if (!confirm(`Opravdu smazat ${selectedOrders.length} objednávek?`)) return;

    await fetch("/api/orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: selectedOrders }),
    });
    setSelectedOrders([]);
    fetchOrders();
  }

  async function generateLabels() {
    if (selectedOrders.length === 0) {
      setMessage({ type: "error", text: "Vyberte alespoň jednu objednávku" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/labels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedOrders, startPosition }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.missingLabels) {
          setMessage({
            type: "error",
            text: `Chybí štítky pro: ${data.missingLabels.join(", ")}`,
          });
        } else {
          setMessage({ type: "error", text: data.error || "Chyba generování" });
        }
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stitky-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage({ type: "error", text: "Chyba při generování PDF" });
    }
    setLoading(false);
  }

  async function saveLabel() {
    if (!labelModal) return;

    await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productName: labelModal.productName,
        ...labelForm,
      }),
    });

    setLabelModal(null);
    setLabelForm({
      nazev: "",
      slozeni: "",
      nutricniHodnoty: "",
      skladovani: "",
      vyrobce: "",
    });
    fetchOrders();
  }

  function toggleOrder(orderId: string) {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  }

  function selectAll() {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map((o) => o.id));
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-7 h-7 text-blue-600" />
              VšeBezLepku Objednávky
            </h1>
            {!authenticated ? (
              <a
                href="/api/auth"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Připojit Gmail
              </a>
            ) : (
              <span className="text-green-600 font-medium">✓ Gmail připojen</span>
            )}
          </div>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div
          className={`max-w-7xl mx-auto px-4 mt-4 p-3 rounded-lg ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Dní zpět:</label>
            <input
              type="number"
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="w-20 border rounded px-2 py-1"
              min={1}
              max={365}
            />
          </div>
          <button
            onClick={syncEmails}
            disabled={!authenticated || loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            {loading ? "Načítám..." : "Synchronizovat emaily"}
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Počáteční pozice:</label>
            <input
              type="number"
              value={startPosition}
              onChange={(e) => setStartPosition(Number(e.target.value))}
              className="w-20 border rounded px-2 py-1"
              min={1}
              max={24}
            />
          </div>

          <button
            onClick={generateLabels}
            disabled={selectedOrders.length === 0 || loading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Generovat štítky ({selectedOrders.length})
          </button>

          {selectedOrders.length > 0 && (
            <button
              onClick={deleteOrders}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Smazat
            </button>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedOrders.length === orders.length && orders.length > 0}
                    onChange={selectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Č. objednávky
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Datum
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Položky
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Celkem
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className={`hover:bg-gray-50 ${
                    selectedOrders.includes(order.id) ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.id)}
                      onChange={() => toggleOrder(order.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">
                    {order.orderNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(order.emailDate).toLocaleDateString("cs-CZ")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="font-medium">{item.quantity}×</span>
                          <span className="truncate max-w-xs">
                            {item.productName}
                          </span>
                          {item.label ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              Štítek ✓
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setLabelModal({
                                  open: true,
                                  productName: item.productName,
                                });
                                setLabelForm({
                                  nazev: item.productName,
                                  slozeni: "",
                                  nutricniHodnoty: "",
                                  skladovani: "",
                                  vyrobce: "",
                                });
                              }}
                              className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded hover:bg-yellow-200 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Přidat štítek
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{order.totalPrice || "-"}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Žádné objednávky. Synchronizujte emaily pro načtení objednávek.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Label Modal */}
      {labelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Vytvořit štítek
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Produkt: <strong>{labelModal.productName}</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Název
                </label>
                <input
                  type="text"
                  value={labelForm.nazev}
                  onChange={(e) =>
                    setLabelForm({ ...labelForm, nazev: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Název produktu na štítku"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Složení
                </label>
                <textarea
                  value={labelForm.slozeni}
                  onChange={(e) =>
                    setLabelForm({ ...labelForm, slozeni: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                  placeholder="Seznam ingrediencí"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nutriční hodnoty
                </label>
                <textarea
                  value={labelForm.nutricniHodnoty}
                  onChange={(e) =>
                    setLabelForm({
                      ...labelForm,
                      nutricniHodnoty: e.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                  placeholder="Energie, bílkoviny, tuky, sacharidy..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Skladování
                </label>
                <input
                  type="text"
                  value={labelForm.skladovani}
                  onChange={(e) =>
                    setLabelForm({ ...labelForm, skladovani: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Skladujte v suchu a chladu"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Výrobce
                </label>
                <input
                  type="text"
                  value={labelForm.vyrobce}
                  onChange={(e) =>
                    setLabelForm({ ...labelForm, vyrobce: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Název a adresa výrobce"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setLabelModal(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Zrušit
              </button>
              <button
                onClick={saveLabel}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Uložit štítek
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

