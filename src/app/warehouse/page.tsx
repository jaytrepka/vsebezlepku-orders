"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Pencil, Trash2, Package, ArrowUp, ArrowRight } from "lucide-react";

interface ShelfBox {
  id: string;
  shelfId: string;
  row: number;
  column: number;
  productName: string;
  pieces: number;
  expirationDate: string | null;
}

interface Shelf {
  id: string;
  name: string;
  priority: number;
  boxes: ShelfBox[];
}

interface StockProduct {
  id: string;
  productName: string;
}

export default function WarehousePage() {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [stockProducts, setStockProducts] = useState<StockProduct[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Shelf modal
  const [shelfModal, setShelfModal] = useState<{
    open: boolean;
    editId?: string;
    name: string;
    priority: string;
  } | null>(null);

  // Box modal
  const [boxModal, setBoxModal] = useState<{
    open: boolean;
    shelfId: string;
    editId?: string;
    row: number;
    column: number;
    productName: string;
    pieces: string;
    expirationDate: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchShelves();
    fetchStockProducts();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function fetchShelves() {
    try {
      const res = await fetch("/api/warehouse");
      const data = await res.json();
      setShelves(data);
    } catch {
      setMessage({ type: "error", text: "Chyba při načítání regálů" });
    }
  }

  async function fetchStockProducts() {
    try {
      const res = await fetch("/api/stock");
      const data = await res.json();
      setStockProducts(data);
    } catch {
      // ignore
    }
  }

  async function saveShelf() {
    if (!shelfModal) return;
    const { editId, name, priority } = shelfModal;
    if (!name.trim()) return;

    try {
      if (editId) {
        await fetch("/api/warehouse", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, name, priority: parseInt(priority) || 0 }),
        });
      } else {
        await fetch("/api/warehouse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, priority: parseInt(priority) || 0 }),
        });
      }
      setShelfModal(null);
      fetchShelves();
      setMessage({ type: "success", text: editId ? "Regál upraven" : "Regál přidán" });
    } catch {
      setMessage({ type: "error", text: "Chyba při ukládání regálu" });
    }
  }

  async function deleteShelf(id: string) {
    if (!confirm("Opravdu smazat regál a všechny krabice?")) return;
    try {
      await fetch(`/api/warehouse?id=${id}`, { method: "DELETE" });
      fetchShelves();
      setMessage({ type: "success", text: "Regál smazán" });
    } catch {
      setMessage({ type: "error", text: "Chyba při mazání regálu" });
    }
  }

  async function saveBox() {
    if (!boxModal) return;
    const { editId, shelfId, row, column, productName, pieces, expirationDate } = boxModal;
    if (!productName.trim() || !pieces) return;

    try {
      if (editId) {
        await fetch("/api/warehouse/boxes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editId,
            productName,
            pieces: parseInt(pieces),
            expirationDate: expirationDate || null,
            row,
            column,
          }),
        });
      } else {
        await fetch("/api/warehouse/boxes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shelfId,
            row,
            column,
            productName,
            pieces: parseInt(pieces),
            expirationDate: expirationDate || null,
          }),
        });
      }
      setBoxModal(null);
      setSearchQuery("");
      fetchShelves();
      setMessage({ type: "success", text: editId ? "Krabice upravena" : "Krabice přidána" });
    } catch {
      setMessage({ type: "error", text: "Chyba při ukládání krabice" });
    }
  }

  async function deleteBox(id: string) {
    if (!confirm("Opravdu smazat krabici?")) return;
    try {
      await fetch(`/api/warehouse/boxes?id=${id}`, { method: "DELETE" });
      fetchShelves();
      setMessage({ type: "success", text: "Krabice smazána" });
    } catch {
      setMessage({ type: "error", text: "Chyba při mazání krabice" });
    }
  }

  // Get next available position for a new box on a shelf
  function getNextPosition(shelf: Shelf): { row: number; column: number; direction: "up" | "right" } {
    if (shelf.boxes.length === 0) return { row: 0, column: 0, direction: "right" };
    const maxRow = Math.max(...shelf.boxes.map((b) => b.row));
    const maxCol = Math.max(...shelf.boxes.map((b) => b.column));
    return { row: maxRow, column: maxCol, direction: "right" };
  }

  function addBoxToShelf(shelfId: string, row: number, column: number) {
    setBoxModal({
      open: true,
      shelfId,
      row,
      column,
      productName: "",
      pieces: "",
      expirationDate: "",
    });
  }

  function shortenName(name: string): string {
    return name
      .replace(/Piaceri Mediterranei\s*/i, "PM ")
      .replace(/Massimo Zero\s*/i, "MZ ")
      .replace(/Glutiniente\s*/i, "GT ")
      .replace(/Bauer\s*/i, "B ")
      .replace(/bezlepkov[áéý]\s*/gi, "");
  }

  function formatExpDate(date: string | null): string {
    if (!date) return "";
    return new Date(date).toLocaleDateString("cs-CZ", { month: "short", year: "numeric" });
  }

  // Build grid representation of boxes on a shelf
  function buildGrid(boxes: ShelfBox[]): { rows: number; cols: number; grid: (ShelfBox | null)[][] } {
    if (boxes.length === 0) return { rows: 1, cols: 1, grid: [[null]] };
    const maxRow = Math.max(...boxes.map((b) => b.row));
    const maxCol = Math.max(...boxes.map((b) => b.column));
    const rows = maxRow + 1;
    const cols = maxCol + 1;
    const grid: (ShelfBox | null)[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => null)
    );
    for (const box of boxes) {
      grid[box.row][box.column] = box;
    }
    return { rows, cols, grid };
  }

  const filteredProducts = stockProducts.filter((p) =>
    p.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-stone-100 p-4 sm:p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-7 h-7 text-amber-700" />
            <h1 className="text-2xl font-bold text-stone-800">Sklad</h1>
          </div>
          <button
            onClick={() => setShelfModal({ open: true, name: "", priority: "0" })}
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Přidat regál
          </button>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
            onClick={() => setMessage(null)}
          >
            {message.text}
          </div>
        )}

        {/* Shelves */}
        {shelves.length === 0 ? (
          <div className="text-center py-16 text-stone-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Žádné regály. Přidejte první regál.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {shelves.map((shelf) => {
              const { rows, cols, grid } = buildGrid(shelf.boxes);
              return (
                <div key={shelf.id} className="bg-white rounded-xl shadow-md border border-stone-200 overflow-hidden">
                  {/* Shelf header */}
                  <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-amber-100 to-amber-50 border-b border-stone-200">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-stone-800">{shelf.name}</span>
                      <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                        Priorita: {shelf.priority}
                      </span>
                      <span className="text-xs text-stone-500">
                        {shelf.boxes.length} {shelf.boxes.length === 1 ? "krabice" : shelf.boxes.length < 5 ? "krabice" : "krabic"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setShelfModal({
                            open: true,
                            editId: shelf.id,
                            name: shelf.name,
                            priority: String(shelf.priority),
                          })
                        }
                        className="p-1.5 text-stone-500 hover:text-amber-700 hover:bg-amber-100 rounded cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteShelf(shelf.id)}
                        className="p-1.5 text-stone-500 hover:text-red-700 hover:bg-red-100 rounded cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Shelf visual - boxes grid */}
                  <div className="p-5">
                    <div className="relative">
                      {/* Shelf structure */}
                      <div className="bg-gradient-to-t from-amber-900/10 to-transparent rounded-lg p-4 border-2 border-dashed border-amber-200">
                        {/* Render rows from top (highest) to bottom (row 0) */}
                        <div className="flex flex-col-reverse gap-2">
                          {Array.from({ length: rows }, (_, rowIdx) => (
                            <div key={rowIdx} className="flex gap-2 items-end">
                              {Array.from({ length: cols }, (_, colIdx) => {
                                const box = grid[rowIdx][colIdx];
                                if (box) {
                                  return (
                                    <div
                                      key={`${rowIdx}-${colIdx}`}
                                      className="relative group min-w-[140px] sm:min-w-[160px] bg-gradient-to-b from-amber-50 to-amber-100 border-2 border-amber-300 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow"
                                    >
                                      {/* Box content */}
                                      <div className="text-xs font-semibold text-stone-800 truncate" title={box.productName}>
                                        {shortenName(box.productName)}
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-sm font-bold text-amber-800">{box.pieces} ks</span>
                                        {box.expirationDate && (
                                          <span className="text-[10px] text-stone-500 bg-white px-1 rounded">
                                            {formatExpDate(box.expirationDate)}
                                          </span>
                                        )}
                                      </div>
                                      {/* Edit/Delete overlay */}
                                      <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                                        <button
                                          onClick={() =>
                                            setBoxModal({
                                              open: true,
                                              shelfId: box.shelfId,
                                              editId: box.id,
                                              row: box.row,
                                              column: box.column,
                                              productName: box.productName,
                                              pieces: String(box.pieces),
                                              expirationDate: box.expirationDate
                                                ? box.expirationDate.split("T")[0]
                                                : "",
                                            })
                                          }
                                          className="p-1 bg-white/80 rounded hover:bg-amber-200 cursor-pointer"
                                        >
                                          <Pencil className="w-3 h-3 text-stone-600" />
                                        </button>
                                        <button
                                          onClick={() => deleteBox(box.id)}
                                          className="p-1 bg-white/80 rounded hover:bg-red-200 cursor-pointer"
                                        >
                                          <Trash2 className="w-3 h-3 text-red-600" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <div
                                    key={`${rowIdx}-${colIdx}`}
                                    className="min-w-[140px] sm:min-w-[160px] h-[70px] border-2 border-dashed border-stone-200 rounded-lg"
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>

                        {/* Add box buttons */}
                        <div className="flex gap-2 mt-4 pt-3 border-t border-amber-200">
                          <button
                            onClick={() => {
                              // Add to the right of bottom row
                              const bottomRowBoxes = shelf.boxes.filter((b) => b.row === 0);
                              const nextCol = bottomRowBoxes.length > 0 ? Math.max(...bottomRowBoxes.map((b) => b.column)) + 1 : 0;
                              addBoxToShelf(shelf.id, 0, nextCol);
                            }}
                            className="flex items-center gap-1.5 text-xs bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors cursor-pointer"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            Přidat vpravo
                          </button>
                          <button
                            onClick={() => {
                              // Add above (new row)
                              const nextRow = shelf.boxes.length > 0 ? Math.max(...shelf.boxes.map((b) => b.row)) + 1 : 0;
                              addBoxToShelf(shelf.id, nextRow, 0);
                            }}
                            className="flex items-center gap-1.5 text-xs bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                            Přidat nahoru
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Shelf Modal */}
      {shelfModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">
              {shelfModal.editId ? "Upravit regál" : "Nový regál"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-stone-600">Název</label>
                <input
                  type="text"
                  value={shelfModal.name}
                  onChange={(e) => setShelfModal({ ...shelfModal, name: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="např. Regál A"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-stone-600">Priorita (vyšší = odebírá se první)</label>
                <input
                  type="number"
                  value={shelfModal.priority}
                  onChange={(e) => setShelfModal({ ...shelfModal, priority: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={saveShelf}
                className="flex-1 bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 cursor-pointer"
              >
                {shelfModal.editId ? "Uložit" : "Vytvořit"}
              </button>
              <button
                onClick={() => setShelfModal(null)}
                className="flex-1 border border-stone-300 py-2 rounded-lg hover:bg-stone-50 cursor-pointer"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Box Modal */}
      {boxModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">
              {boxModal.editId ? "Upravit krabici" : "Nová krabice"}
            </h2>
            <div className="space-y-3">
              {/* Product search/select */}
              <div ref={searchRef}>
                <label className="text-sm text-stone-600">Produkt</label>
                <input
                  type="text"
                  value={boxModal.editId ? boxModal.productName : searchQuery || boxModal.productName}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                    if (!boxModal.editId) {
                      setBoxModal({ ...boxModal, productName: e.target.value });
                    } else {
                      setBoxModal({ ...boxModal, productName: e.target.value });
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Hledat produkt..."
                />
                {showSuggestions && searchQuery && filteredProducts.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-w-[calc(100%-3rem)] bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredProducts.slice(0, 15).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setBoxModal({ ...boxModal, productName: p.productName });
                          setSearchQuery(p.productName);
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 truncate cursor-pointer"
                      >
                        {p.productName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm text-stone-600">Počet kusů</label>
                <input
                  type="number"
                  value={boxModal.pieces}
                  onChange={(e) => setBoxModal({ ...boxModal, pieces: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm text-stone-600">Expirace (volitelné)</label>
                <input
                  type="date"
                  value={boxModal.expirationDate}
                  onChange={(e) => setBoxModal({ ...boxModal, expirationDate: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="text-xs text-stone-400">
                Pozice: řada {boxModal.row + 1}, sloupec {boxModal.column + 1}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={saveBox}
                className="flex-1 bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 cursor-pointer"
              >
                {boxModal.editId ? "Uložit" : "Přidat"}
              </button>
              <button
                onClick={() => { setBoxModal(null); setSearchQuery(""); }}
                className="flex-1 border border-stone-300 py-2 rounded-lg hover:bg-stone-50 cursor-pointer"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
