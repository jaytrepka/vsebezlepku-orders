"use client";

import { useState, useEffect } from "react";
import { Calendar, Plus, Trash2, AlertTriangle, Check } from "lucide-react";

interface ExpirationDate {
  id: string;
  expirationDate: string;
  count: number;
  neplytvatConfirmed: boolean;
}

interface StockProduct {
  id: string;
  productName: string;
  totalCount: number;
  expirations: ExpirationDate[];
}

interface Prediction {
  overallDate: string | null;
  trendingDate: string | null;
  overallVelocity: number | null;
  trendingVelocity: number | null;
  totalSold: number;
  orderCount: number;
  atRisk: boolean;
  atRiskOverall: boolean;
  unsoldCountTrending: number | null;
  unsoldCountOverall: number | null;
}

function getExpirationColor(dateStr: string): "red" | "yellow" | "green" {
  const now = new Date();
  const expDate = new Date(dateStr);
  const diffMs = expDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= 30) return "red";
  if (diffDays <= 60) return "yellow";
  return "green";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("cs-CZ");
}

const colorClasses = {
  red: "bg-red-100 text-red-800 border-red-300",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
  green: "bg-green-100 text-green-800 border-green-300",
};

export default function StockPage() {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newExpDate, setNewExpDate] = useState("");
  const [newExpCount, setNewExpCount] = useState("");
  const [editingExp, setEditingExp] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editCount, setEditCount] = useState("");
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [editStockCount, setEditStockCount] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "count" | "soldout">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterRedExp, setFilterRedExp] = useState(false);
  const [filterYellowExp, setFilterYellowExp] = useState(false);
  const [filterAtRisk, setFilterAtRisk] = useState(false);
  const [filterAtRiskOverall, setFilterAtRiskOverall] = useState(false);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});

  useEffect(() => {
    fetchProducts();
    fetchPredictions();
  }, []);

  async function fetchProducts() {
    try {
      const res = await fetch("/api/stock");
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
    } catch {
      setMessage({ type: "error", text: "Chyba při načítání produktů" });
    }
  }

  async function fetchPredictions() {
    try {
      const res = await fetch("/api/stock/predictions");
      const data = await res.json();
      if (data && typeof data === "object" && !data.error) setPredictions(data);
    } catch {
      // Predictions are non-critical
    }
  }

  async function addExpiration(stockProductId: string) {
    if (!newExpDate || !newExpCount) return;
    try {
      const res = await fetch("/api/stock/expirations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockProductId,
          expirationDate: new Date(newExpDate).toISOString(),
          count: parseInt(newExpCount, 10),
        }),
      });
      if (res.ok) {
        setAddingTo(null);
        setNewExpDate("");
        setNewExpCount("");
        fetchProducts();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Chyba" });
      }
    } catch {
      setMessage({ type: "error", text: "Chyba při přidávání data" });
    }
  }

  async function updateExpiration(id: string) {
    try {
      const updateData: { count?: number; expirationDate?: string } = {};
      if (editCount) updateData.count = parseInt(editCount, 10);
      if (editDate) updateData.expirationDate = new Date(editDate).toISOString();

      const res = await fetch("/api/stock/expirations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updateData }),
      });
      if (res.ok) {
        setEditingExp(null);
        setEditDate("");
        setEditCount("");
        fetchProducts();
      }
    } catch {
      setMessage({ type: "error", text: "Chyba při úpravě" });
    }
  }

  async function deleteExpiration(id: string) {
    if (!confirm("Opravdu smazat tento záznam trvanlivosti?")) return;
    try {
      await fetch("/api/stock/expirations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchProducts();
    } catch {
      setMessage({ type: "error", text: "Chyba při mazání" });
    }
  }

  async function toggleNeplýtvat(expiration: ExpirationDate) {
    try {
      await fetch("/api/stock/expirations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: expiration.id,
          neplytvatConfirmed: !expiration.neplytvatConfirmed,
        }),
      });
      fetchProducts();
    } catch {
      setMessage({ type: "error", text: "Chyba při potvrzení" });
    }
  }

  async function updateStockCount(productId: string) {
    const count = parseInt(editStockCount, 10);
    if (isNaN(count) || count < 0) {
      setMessage({ type: "error", text: "Neplatný počet" });
      return;
    }
    try {
      const res = await fetch("/api/stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId, totalCount: count }),
      });
      if (res.ok) {
        setEditingStock(null);
        setEditStockCount("");
        fetchProducts();
        fetchPredictions();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Chyba" });
      }
    } catch {
      setMessage({ type: "error", text: "Chyba při úpravě počtu" });
    }
  }

  function startEditing(exp: ExpirationDate) {
    setEditingExp(exp.id);
    setEditDate(new Date(exp.expirationDate).toISOString().split("T")[0]);
    setEditCount(String(exp.count));
  }

  function handleSort(column: "date" | "name" | "count" | "soldout") {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  }

  function getSortIndicator(column: "date" | "name" | "count" | "soldout") {
    if (sortBy !== column) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  function getPredictionDate(product: StockProduct): Date | null {
    const pred = predictions[product.productName];
    if (!pred) return null;
    const dateStr = pred.trendingDate || pred.overallDate;
    return dateStr ? new Date(dateStr) : null;
  }

  const sortedProducts = [...products].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "name") {
      return dir * a.productName.localeCompare(b.productName, "cs");
    }
    if (sortBy === "count") {
      return dir * (a.totalCount - b.totalCount);
    }
    if (sortBy === "soldout") {
      const predA = predictions[a.productName];
      const predB = predictions[b.productName];
      // At-risk products first when ascending
      if (predA?.atRisk && !predB?.atRisk) return -1 * dir;
      if (!predA?.atRisk && predB?.atRisk) return 1 * dir;
      const dateA = getPredictionDate(a);
      const dateB = getPredictionDate(b);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dir * (dateA.getTime() - dateB.getTime());
    }
    // date: sort by earliest expiration
    const aDate = a.expirations[0]?.expirationDate;
    const bDate = b.expirations[0]?.expirationDate;
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return dir * (new Date(aDate).getTime() - new Date(bDate).getTime());
  });

  const anyFilter = filterRedExp || filterYellowExp || filterAtRisk || filterAtRiskOverall;
  const filteredProducts = anyFilter
    ? sortedProducts.filter((p) => {
        const expMatch = p.expirations.some((e) => {
          const color = getExpirationColor(e.expirationDate);
          return (filterRedExp && color === "red") || (filterYellowExp && color === "yellow");
        });
        const pred = predictions[p.productName];
        const riskMatch = filterAtRisk && pred?.atRisk;
        const riskOverallMatch = filterAtRiskOverall && pred?.atRiskOverall;
        return expMatch || riskMatch || riskOverallMatch;
      })
    : sortedProducts;

  const totalProducts = filteredProducts.length;
  const totalPieces = filteredProducts.reduce((sum, p) => sum + p.totalCount, 0);
  const atRiskProducts = products.filter((p) => predictions[p.productName]?.atRisk);
  const atRiskCount = atRiskProducts.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-blue-600" />
            Minimální trvanlivosti
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Přehled skladových zásob a dat trvanlivosti
            {totalProducts > 0 && (
              <span className="ml-3 font-medium text-gray-700">
                — {totalProducts} produktů, {totalPieces} ks celkem
              </span>
            )}
          </p>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div
          className={`max-w-7xl mx-auto px-4 mt-4 p-3 rounded-lg ${
            message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* At-risk flash message */}
      {atRiskCount > 0 && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-800">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-sm font-medium">
              {atRiskCount} {atRiskCount === 1 ? "produkt se nestihne vyprodat" : atRiskCount < 5 ? "produkty se nestihnou vyprodat" : "produktů se nestihne vyprodat"} před datem trvanlivosti!
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="bg-white rounded-lg shadow p-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={filterRedExp}
              onChange={(e) => setFilterRedExp(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer accent-red-500"
            />
            <span className="inline-block w-3 h-3 rounded-full bg-red-400" />
            Do 1 měsíce
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={filterYellowExp}
              onChange={(e) => setFilterYellowExp(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer accent-yellow-500"
            />
            <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" />
            1–2 měsíce
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={filterAtRisk}
              onChange={(e) => setFilterAtRisk(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer accent-red-700"
            />
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Nestihne se vyprodat (📈 trend)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={filterAtRiskOverall}
              onChange={(e) => setFilterAtRiskOverall(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer accent-orange-500"
            />
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            Nestihne se vyprodat (📊 celkově)
          </label>
        </div>
      </div>

      {/* Products list */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort("name")}
                >
                  Produkt{getSortIndicator("name")}
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-gray-600 w-24 cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort("count")}
                >
                  Ks celkem{getSortIndicator("count")}
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort("date")}
                >
                  Trvanlivosti{getSortIndicator("date")}
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-gray-600 w-48 cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort("soldout")}
                >
                  Předpokládaný vyprodej{getSortIndicator("soldout")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 w-20">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredProducts.map((product) => {
                const assignedCount = product.expirations.reduce((sum, e) => sum + e.count, 0);
                const unassigned = product.totalCount - assignedCount;

                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-sm">{product.productName}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono font-bold">
                      {editingStock === product.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={editStockCount}
                            onChange={(e) => setEditStockCount(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") updateStockCount(product.id);
                              if (e.key === "Escape") { setEditingStock(null); setEditStockCount(""); }
                            }}
                            className="w-16 border rounded px-1 py-0.5 text-sm text-center"
                            autoFocus
                          />
                          <button onClick={() => updateStockCount(product.id)} className="text-green-600 hover:text-green-800 cursor-pointer">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => { setEditingStock(null); setEditStockCount(""); }} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xs">
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span
                          className="cursor-pointer hover:text-blue-600 hover:underline"
                          title="Klikněte pro úpravu počtu"
                          onClick={() => { setEditingStock(product.id); setEditStockCount(String(product.totalCount)); }}
                        >
                          {product.totalCount}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1.5">
                        {product.expirations.map((exp) => {
                          const color = getExpirationColor(exp.expirationDate);
                          const isExpiringSoon = color === "red";

                          if (editingExp === exp.id) {
                            return (
                              <div key={exp.id} className="flex items-center gap-2">
                                <input
                                  type="date"
                                  value={editDate}
                                  onChange={(e) => setEditDate(e.target.value)}
                                  className="border rounded px-2 py-1 text-sm"
                                />
                                <input
                                  type="number"
                                  value={editCount}
                                  onChange={(e) => setEditCount(e.target.value)}
                                  className="w-16 border rounded px-2 py-1 text-sm"
                                  min={1}
                                />
                                <span className="text-sm text-gray-500">ks</span>
                                <button
                                  onClick={() => updateExpiration(exp.id)}
                                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 cursor-pointer"
                                >
                                  Uložit
                                </button>
                                <button
                                  onClick={() => setEditingExp(null)}
                                  className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                                >
                                  Zrušit
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div key={exp.id} className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${colorClasses[color]}`}
                              >
                                {formatDate(exp.expirationDate)} — {exp.count} ks
                              </span>
                              {isExpiringSoon && !exp.neplytvatConfirmed && (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                              )}
                              {isExpiringSoon && (
                                <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={exp.neplytvatConfirmed}
                                    onChange={() => toggleNeplýtvat(exp)}
                                    className="w-4 h-4 rounded cursor-pointer"
                                  />
                                  Přesunuto do neplýtvat
                                </label>
                              )}
                              <button
                                onClick={() => startEditing(exp)}
                                className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                              >
                                Upravit
                              </button>
                              <button
                                onClick={() => deleteExpiration(exp.id)}
                                className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                        {unassigned > 0 && (
                          <span className="text-xs text-gray-400 italic">
                            {unassigned} ks bez data trvanlivosti
                          </span>
                        )}
                        {/* Inline add form */}
                        {addingTo === product.id && (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="date"
                              value={newExpDate}
                              onChange={(e) => setNewExpDate(e.target.value)}
                              className="border rounded px-2 py-1 text-sm"
                            />
                            <input
                              type="number"
                              value={newExpCount}
                              onChange={(e) => setNewExpCount(e.target.value)}
                              placeholder="ks"
                              className="w-16 border rounded px-2 py-1 text-sm"
                              min={1}
                            />
                            <button
                              onClick={() => addExpiration(product.id)}
                              className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 cursor-pointer"
                            >
                              Přidat
                            </button>
                            <button
                              onClick={() => { setAddingTo(null); setNewExpDate(""); setNewExpCount(""); }}
                              className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                            >
                              Zrušit
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const pred = predictions[product.productName];
                        if (!pred || (!pred.overallDate && !pred.trendingDate)) {
                          return <span className="text-xs text-gray-400 italic">Žádná data</span>;
                        }
                        return (
                          <div className="space-y-1">
                            {pred.trendingDate && (
                              <div className="flex items-center gap-1">
                                <span className={`text-xs font-medium ${pred.atRisk ? "text-red-700" : "text-gray-700"}`}>
                                  📈 {formatDate(pred.trendingDate)}
                                </span>
                                {pred.atRisk && (
                                  <span className="flex items-center gap-1" title="Nestihne se vyprodat před expirací!">
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                    {pred.unsoldCountTrending != null && (
                                      <span className="text-xs font-bold text-red-600">{pred.unsoldCountTrending} ks</span>
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                            {pred.overallDate && (
                              <div className="flex items-center gap-1">
                                <span className={`text-xs ${pred.trendingDate ? "text-gray-400" : pred.atRisk ? "text-red-700 font-medium" : "text-gray-700 font-medium"}`}>
                                  📊 {formatDate(pred.overallDate)}
                                </span>
                                {pred.unsoldCountOverall != null && pred.unsoldCountOverall > 0 && (
                                  <span className={`text-xs font-bold ${pred.trendingDate ? "text-gray-400" : "text-red-600"}`}>
                                    {pred.unsoldCountOverall} ks
                                  </span>
                                )}
                                {!pred.trendingDate && pred.atRisk && (
                                  <span title="Nestihne se vyprodat před expirací!">
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                  </span>
                                )}
                              </div>
                            )}
                            <span className="text-[10px] text-gray-400">
                              {pred.totalSold} ks prodáno ({pred.orderCount} obj.)
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {addingTo !== product.id && (
                        unassigned > 0 ? (
                          <button
                            onClick={() => { setAddingTo(product.id); setNewExpDate(""); setNewExpCount(""); }}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            Datum
                          </button>
                        ) : (
                          <span className="text-green-600" title="Všechna data zadána">✓</span>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Žádné produkty. Produkty budou synchronizovány z Shoptetu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
