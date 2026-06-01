"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Pencil, Trash2, Package, ArrowUp, ArrowLeft, ArrowRight, Search, Layers, Copy } from "lucide-react";

interface ShelfBox {
  id: string;
  shelfId: string;
  floor: number;
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
    floor: number;
    row: number;
    column: number;
    action?: "insertColumn" | "insertRow";
    productName: string;
    pieces: string;
    expirationDate: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Find/search feature
  const [findQuery, setFindQuery] = useState("");
  const [findShowSuggestions, setFindShowSuggestions] = useState(false);
  const [activeFind, setActiveFind] = useState("");
  const findRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchShelves();
    fetchStockProducts();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (findRef.current && !findRef.current.contains(e.target as Node)) {
        setFindShowSuggestions(false);
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
    const { editId, shelfId, floor, row, column, action, productName, pieces, expirationDate } = boxModal;
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
          }),
        });
      } else {
        await fetch("/api/warehouse/boxes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: action || undefined,
            shelfId,
            floor,
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

  async function cloneBox(box: ShelfBox, direction: "above" | "right") {
    try {
      const body: Record<string, unknown> = {
        shelfId: box.shelfId,
        floor: box.floor,
        productName: box.productName,
        pieces: box.pieces,
        expirationDate: box.expirationDate || null,
      };

      if (direction === "above") {
        body.action = "insertRow";
        body.row = box.row + 1;
        body.column = box.column;
      } else {
        body.action = "insertColumn";
        body.row = 0;
        body.column = box.column + 1;
      }

      await fetch("/api/warehouse/boxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      fetchShelves();
      setMessage({ type: "success", text: "Krabice naklonována" });
    } catch {
      setMessage({ type: "error", text: "Chyba při klonování krabice" });
    }
  }

  function openBoxModal(params: {
    shelfId: string;
    floor: number;
    row: number;
    column: number;
    action?: "insertColumn" | "insertRow";
  }) {
    setBoxModal({
      open: true,
      shelfId: params.shelfId,
      floor: params.floor,
      row: params.row,
      column: params.column,
      action: params.action,
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

  // Get floors for a shelf (all floors from 0 to max, even empty ones)
  function getFloors(shelf: Shelf): number[] {
    if (shelf.boxes.length === 0) return [0];
    const maxFloor = Math.max(...shelf.boxes.map((b) => b.floor));
    return Array.from({ length: maxFloor + 1 }, (_, i) => i);
  }

  // Get columns on a floor (sorted)
  function getColumns(boxes: ShelfBox[], floor: number): number[] {
    const cols = [...new Set(boxes.filter((b) => b.floor === floor).map((b) => b.column))].sort((a, b) => a - b);
    return cols;
  }

  // Get boxes in a column stack (sorted by row, bottom=0 first)
  function getColumnStack(boxes: ShelfBox[], floor: number, column: number): ShelfBox[] {
    return boxes.filter((b) => b.floor === floor && b.column === column).sort((a, b) => a.row - b.row);
  }

  const filteredProducts = stockProducts.filter((p) =>
    p.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Find feature
  const findResults = activeFind
    ? shelves
        .flatMap((shelf) =>
          shelf.boxes
            .filter((box) => box.productName === activeFind)
            .map((box) => ({
              shelfName: shelf.name,
              priority: shelf.priority,
              floor: box.floor + 1,
              column: box.column + 1,
              row: box.row + 1,
              pieces: box.pieces,
              boxId: box.id,
            }))
        )
        .sort((a, b) => b.priority - a.priority)
    : [];

  const highlightedBoxIds = new Set(findResults.map((r) => r.boxId));

  const findFilteredProducts = stockProducts.filter((p) =>
    p.productName.toLowerCase().includes(findQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-stone-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
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

        {/* Find product search */}
        <div className="mb-5" ref={findRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={findQuery}
              onChange={(e) => {
                setFindQuery(e.target.value);
                setFindShowSuggestions(true);
                if (!e.target.value) setActiveFind("");
              }}
              onFocus={() => setFindShowSuggestions(true)}
              placeholder="Najít produkt ve skladu..."
              className="w-full pl-10 pr-4 py-2.5 border border-stone-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
            />
            {findShowSuggestions && findQuery && findFilteredProducts.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {findFilteredProducts.slice(0, 15).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setFindQuery(p.productName);
                      setActiveFind(p.productName);
                      setFindShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 truncate cursor-pointer"
                  >
                    {p.productName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeFind && (
            <div className="mt-3 bg-white border border-amber-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-stone-700">
                  📍 Nalezeno: {findResults.length} {findResults.length === 1 ? "krabice" : findResults.length < 5 ? "krabice" : "krabic"}
                </h3>
                <button
                  onClick={() => { setActiveFind(""); setFindQuery(""); }}
                  className="text-xs text-stone-500 hover:text-red-600 cursor-pointer"
                >
                  Zrušit hledání
                </button>
              </div>
              {findResults.length === 0 ? (
                <p className="text-sm text-stone-500">Produkt nebyl nalezen v žádném regálu.</p>
              ) : (
                <div className="space-y-1">
                  {findResults.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-amber-800">{r.shelfName}</span>
                      <span className="text-stone-400">—</span>
                      <span className="text-stone-600">patro {r.floor}, sloupec {r.column}, řada {r.row}</span>
                      <span className="text-stone-400">·</span>
                      <span className="font-semibold text-stone-800">{r.pieces} ks</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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

        {/* Shelves (Bookcases) */}
        {shelves.length === 0 ? (
          <div className="text-center py-16 text-stone-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Žádné regály. Přidejte první regál.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {shelves.map((shelf) => {
              const floors = getFloors(shelf);
              return (
                <div key={shelf.id} className="bg-white rounded-xl shadow-md border border-stone-200 overflow-hidden">
                  {/* Bookcase header */}
                  <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-amber-100 to-amber-50 border-b border-stone-200">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-stone-800">{shelf.name}</span>
                      <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                        Priorita: {shelf.priority}
                      </span>
                      <span className="text-xs text-stone-500 flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {floors.length} {floors.length === 1 ? "patro" : floors.length < 5 ? "patra" : "pater"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Add floor */}
                      <button
                        onClick={() => {
                          const nextFloor = floors.length > 0 ? Math.max(...floors) + 1 : 0;
                          openBoxModal({ shelfId: shelf.id, floor: nextFloor, row: 0, column: 0 });
                        }}
                        className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        Patro
                      </button>
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

                  {/* Floors - rendered from top (highest) to bottom (floor 0) */}
                  <div className="p-4">
                    <div className="flex flex-col gap-1">
                      {[...floors].reverse().map((floorIdx) => {
                        const columns = getColumns(shelf.boxes, floorIdx);
                        return (
                          <div key={floorIdx} className="relative">
                            {/* Floor label */}
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-medium text-stone-400 uppercase w-14">
                                Patro {floorIdx + 1}
                              </span>
                              <div className="flex-1 h-px bg-stone-200" />
                            </div>

                            {/* Floor content: columns with boxes */}
                            <div className="ml-14 flex items-end gap-1 pb-3 overflow-x-auto">
                              {columns.length === 0 ? (
                                /* Empty floor - add first box */
                                <button
                                  onClick={() => openBoxModal({ shelfId: shelf.id, floor: floorIdx, row: 0, column: 0 })}
                                  className="min-w-[130px] h-[60px] border-2 border-dashed border-amber-300 rounded-lg flex items-center justify-center text-amber-600 hover:bg-amber-50 cursor-pointer transition-colors"
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  <span className="text-xs">Přidat krabici</span>
                                </button>
                              ) : (
                                <>
                                  {columns.map((colIdx, colPosition) => {
                                    const stack = getColumnStack(shelf.boxes, floorIdx, colIdx);
                                    return (
                                      <div key={colIdx} className="flex items-end gap-1">
                                        {/* Insert column left (only for first column) */}
                                        {colPosition === 0 && (
                                          <button
                                            onClick={() =>
                                              openBoxModal({
                                                shelfId: shelf.id,
                                                floor: floorIdx,
                                                row: 0,
                                                column: colIdx,
                                                action: "insertColumn",
                                              })
                                            }
                                            className="self-center p-0.5 text-stone-300 hover:text-amber-600 cursor-pointer"
                                            title="Přidat sloupec vlevo"
                                          >
                                            <ArrowLeft className="w-3.5 h-3.5" />
                                          </button>
                                        )}

                                        {/* Column stack (top to bottom visually) */}
                                        <div className="flex flex-col gap-0.5 items-center">
                                          {/* Add above top box */}
                                          <button
                                            onClick={() =>
                                              openBoxModal({
                                                shelfId: shelf.id,
                                                floor: floorIdx,
                                                row: (stack[stack.length - 1]?.row ?? 0) + 1,
                                                column: colIdx,
                                                action: "insertRow",
                                              })
                                            }
                                            className="p-0.5 text-stone-300 hover:text-amber-600 cursor-pointer"
                                            title="Přidat krabici nahoru"
                                          >
                                            <ArrowUp className="w-3 h-3" />
                                          </button>

                                          {/* Boxes from top (highest row) to bottom (row 0) */}
                                          {[...stack].reverse().map((box, visualIdx) => (
                                            <div key={box.id} className="flex flex-col items-center gap-0.5">
                                              {/* The box */}
                                              <div
                                                className={`relative group min-w-[130px] border-2 rounded-lg p-2.5 transition-all ${
                                                  highlightedBoxIds.has(box.id)
                                                    ? "bg-gradient-to-b from-green-100 to-green-200 border-green-500 ring-2 ring-green-300 scale-105"
                                                    : "bg-gradient-to-b from-amber-50 to-amber-100 border-amber-300 hover:shadow-md"
                                                }`}
                                              >
                                                <div className="text-xs font-semibold text-stone-800 truncate max-w-[120px]" title={box.productName}>
                                                  {shortenName(box.productName)}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                  <span className="text-sm font-bold text-amber-800">{box.pieces} ks</span>
                                                  {box.expirationDate && (
                                                    <span className="text-[10px] text-stone-500 bg-white px-1 rounded">
                                                      {formatExpDate(box.expirationDate)}
                                                    </span>
                                                  )}
                                                </div>
                                                {/* Edit/Delete/Clone */}
                                                <div className="absolute top-0.5 right-0.5 hidden group-hover:flex gap-0.5">
                                                  <button
                                                    onClick={() => cloneBox(box, "above")}
                                                    className="p-1 bg-white/80 rounded hover:bg-blue-200 cursor-pointer"
                                                    title="Klonovat nahoru"
                                                  >
                                                    <Copy className="w-3 h-3 text-blue-600" />
                                                  </button>
                                                  <button
                                                    onClick={() => cloneBox(box, "right")}
                                                    className="p-1 bg-white/80 rounded hover:bg-blue-200 cursor-pointer"
                                                    title="Klonovat vpravo"
                                                  >
                                                    <ArrowRight className="w-3 h-3 text-blue-600" />
                                                  </button>
                                                  <button
                                                    onClick={() =>
                                                      setBoxModal({
                                                        open: true,
                                                        shelfId: box.shelfId,
                                                        editId: box.id,
                                                        floor: box.floor,
                                                        row: box.row,
                                                        column: box.column,
                                                        productName: box.productName,
                                                        pieces: String(box.pieces),
                                                        expirationDate: box.expirationDate ? box.expirationDate.split("T")[0] : "",
                                                      })
                                                    }
                                                    className="p-1 bg-white/80 rounded hover:bg-amber-200 cursor-pointer"
                                                    title="Upravit"
                                                  >
                                                    <Pencil className="w-3 h-3 text-stone-600" />
                                                  </button>
                                                  <button
                                                    onClick={() => deleteBox(box.id)}
                                                    className="p-1 bg-white/80 rounded hover:bg-red-200 cursor-pointer"
                                                    title="Smazat"
                                                  >
                                                    <Trash2 className="w-3 h-3 text-red-600" />
                                                  </button>
                                                </div>
                                              </div>

                                              {/* Insert between this box and the one below */}
                                              {visualIdx < stack.length - 1 && (
                                                <button
                                                  onClick={() =>
                                                    openBoxModal({
                                                      shelfId: shelf.id,
                                                      floor: floorIdx,
                                                      row: box.row,
                                                      column: colIdx,
                                                      action: "insertRow",
                                                    })
                                                  }
                                                  className="p-0.5 text-stone-300 hover:text-amber-600 cursor-pointer"
                                                  title="Přidat krabici mezi"
                                                >
                                                  <Plus className="w-3 h-3" />
                                                </button>
                                              )}
                                            </div>
                                          ))}

                                          {/* Add below bottom box */}
                                          <button
                                            onClick={() =>
                                              openBoxModal({
                                                shelfId: shelf.id,
                                                floor: floorIdx,
                                                row: stack[0]?.row ?? 0,
                                                column: colIdx,
                                                action: "insertRow",
                                              })
                                            }
                                            className="p-0.5 text-stone-300 hover:text-amber-600 cursor-pointer"
                                            title="Přidat krabici pod"
                                          >
                                            <Plus className="w-3 h-3" />
                                          </button>
                                        </div>

                                        {/* Insert column right */}
                                        <button
                                          onClick={() =>
                                            openBoxModal({
                                              shelfId: shelf.id,
                                              floor: floorIdx,
                                              row: 0,
                                              column: colIdx + 1,
                                              action: "insertColumn",
                                            })
                                          }
                                          className="self-center p-0.5 text-stone-300 hover:text-amber-600 cursor-pointer"
                                          title="Přidat sloupec vpravo"
                                        >
                                          <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </>
                              )}
                            </div>

                            {/* Floor "shelf board" visual */}
                            <div className="ml-14 h-2 bg-gradient-to-b from-amber-800 to-amber-900 rounded-sm shadow-sm" />
                          </div>
                        );
                      })}
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
              <div ref={searchRef} className="relative">
                <label className="text-sm text-stone-600">Produkt</label>
                <input
                  type="text"
                  value={boxModal.editId ? boxModal.productName : searchQuery || boxModal.productName}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                    setBoxModal({ ...boxModal, productName: e.target.value });
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Hledat produkt..."
                />
                {showSuggestions && searchQuery && filteredProducts.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
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
