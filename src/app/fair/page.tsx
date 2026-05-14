"use client";

import { useEffect, useState, useRef } from "react";
import { ShoppingBag, Plus, Pencil, Trash2, ShoppingCart, X, BarChart3 } from "lucide-react";

interface FairProduct {
  id: string;
  fairId: string;
  productName: string;
  price: number;
  totalCount: number;
  soldCount: number;
}

interface FairTransaction {
  id: string;
  fairId: string;
  totalPrice: number;
  items: FairTransactionItem[];
  createdAt: string;
}

interface FairTransactionItem {
  id: string;
  fairProductId: string;
  quantity: number;
  unitPrice: number;
}

interface Fair {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  products?: FairProduct[];
  transactions?: FairTransaction[];
}

interface CartItem {
  fairProductId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface StockProduct {
  id: string;
  productName: string;
}

export default function FairPage() {
  const [fairs, setFairs] = useState<Fair[]>([]);
  const [activeFairId, setActiveFairId] = useState<string | null>(null);
  const [fairData, setFairData] = useState<Fair | null>(null);
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [stockProducts, setStockProducts] = useState<StockProduct[]>([]);

  // Modal states
  const [showNewFair, setShowNewFair] = useState(false);
  const [newFairName, setNewFairName] = useState("");
  const [productModal, setProductModal] = useState<{
    open: boolean;
    editId?: string;
    productName: string;
    price: string;
    totalCount: string;
  } | null>(null);
  const [showSales, setShowSales] = useState(false);
  const [salesTab, setSalesTab] = useState<"summary" | "orders">("summary");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFairs();
    fetchStockProducts();
  }, []);

  useEffect(() => {
    if (activeFairId) fetchFairData(activeFairId);
  }, [activeFairId]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function fetchFairs() {
    try {
      const res = await fetch("/api/fair");
      const data = await res.json();
      setFairs(data);
      if (data.length > 0 && !activeFairId) {
        setActiveFairId(data[0].id);
      }
    } catch {
      setMessage({ type: "error", text: "Chyba při načítání veletrhů" });
    }
  }

  async function fetchFairData(fairId: string) {
    try {
      const res = await fetch(`/api/fair?id=${fairId}`);
      const data = await res.json();
      setFairData(data);
    } catch {
      setMessage({ type: "error", text: "Chyba při načítání dat veletrhu" });
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

  async function createFair() {
    if (!newFairName.trim()) return;
    try {
      const res = await fetch("/api/fair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-fair", name: newFairName.trim() }),
      });
      const fair = await res.json();
      setFairs((prev) => [fair, ...prev]);
      setActiveFairId(fair.id);
      setNewFairName("");
      setShowNewFair(false);
    } catch {
      setMessage({ type: "error", text: "Chyba při vytváření veletrhu" });
    }
  }

  async function addProduct() {
    if (!productModal || !activeFairId) return;
    const { productName, price, totalCount, editId } = productModal;
    if (!productName.trim() || !price || !totalCount) return;

    try {
      if (editId) {
        await fetch("/api/fair", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editId,
            productName: productName.trim(),
            price: parseFloat(price),
            totalCount: parseInt(totalCount),
          }),
        });
      } else {
        await fetch("/api/fair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add-product",
            fairId: activeFairId,
            productName: productName.trim(),
            price: parseFloat(price),
            totalCount: parseInt(totalCount),
          }),
        });
      }
      setProductModal(null);
      setSearchQuery("");
      fetchFairData(activeFairId);
    } catch {
      setMessage({ type: "error", text: "Chyba při ukládání produktu" });
    }
  }

  async function deleteProduct(productId: string) {
    if (!activeFairId) return;
    if (!confirm("Opravdu smazat tento produkt?")) return;
    try {
      await fetch(`/api/fair?productId=${productId}`, { method: "DELETE" });
      fetchFairData(activeFairId);
    } catch {
      setMessage({ type: "error", text: "Chyba při mazání produktu" });
    }
  }

  function addToCart(product: FairProduct) {
    const remaining = product.totalCount - product.soldCount;
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      const currentQty = existing?.quantity || 0;
      if (currentQty >= remaining) return prev; // can't add more than remaining
      next.set(product.id, {
        fairProductId: product.id,
        productName: product.productName,
        quantity: currentQty + 1,
        unitPrice: product.price,
      });
      return next;
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        next.delete(productId);
      } else {
        next.set(productId, { ...existing, quantity: existing.quantity - 1 });
      }
      return next;
    });
  }

  function clearCart() {
    setCart(new Map());
  }

  async function checkout() {
    if (!activeFairId || cart.size === 0) return;
    try {
      const items = Array.from(cart.values()).map((item) => ({
        fairProductId: item.fairProductId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));

      await fetch("/api/fair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transaction", fairId: activeFairId, items }),
      });

      setCart(new Map());
      fetchFairData(activeFairId);
      setMessage({ type: "success", text: "Zaplaceno! ✓" });
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage({ type: "error", text: "Chyba při zpracování platby" });
    }
  }

  const cartTotal = Array.from(cart.values()).reduce(
    (sum, item) => sum + item.quantity * item.unitPrice, 0
  );
  const cartCount = Array.from(cart.values()).reduce((sum, item) => sum + item.quantity, 0);

  const products = fairData?.products || [];
  const transactions = fairData?.transactions || [];

  // Sales summary
  const salesSummary = products
    .filter((p) => p.soldCount > 0)
    .map((p) => ({
      productName: p.productName,
      soldCount: p.soldCount,
      totalRevenue: p.soldCount * p.price,
      unitPrice: p.price,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const totalRevenue = salesSummary.reduce((sum, s) => sum + s.totalRevenue, 0);
  const totalSoldItems = salesSummary.reduce((sum, s) => sum + s.soldCount, 0);

  // Suggestions for product search
  const suggestions = searchQuery.length >= 2
    ? stockProducts
        .filter((p) => p.productName.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 10)
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingBag className="w-7 h-7 text-orange-600" />
              Veletrh
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={activeFairId || ""}
                onChange={(e) => setActiveFairId(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm"
              >
                {fairs.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowNewFair(true)}
                className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-orange-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Nový veletrh
              </button>
            </div>
          </div>
        </div>
      </header>

      {message && (
        <div className={`max-w-7xl mx-auto px-4 mt-4 p-3 rounded-lg ${
          message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* Cart Panel */}
      {cartCount > 0 && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 mt-4">
          <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6 text-orange-600" />
              <div>
                <span className="font-bold text-orange-800">{cartCount} ks</span>
                <span className="text-orange-700 mx-2">|</span>
                <span className="font-bold text-orange-800 text-lg">{cartTotal} Kč</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={checkout}
                className="bg-green-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-green-700"
              >
                💰 Zaplaceno
              </button>
              <button
                onClick={clearCart}
                className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-medium hover:bg-red-200"
              >
                ✕ Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-6">
        {/* Add Product Button */}
        <div className="mb-4">
          <button
            onClick={() => {
              setProductModal({ open: true, productName: "", price: "", totalCount: "" });
              setSearchQuery("");
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Přidat produkt
          </button>
        </div>

        {/* Product List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Produkt</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 w-20">Cena</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 w-24">Zbývá</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 w-20">V košíku</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 w-48">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((product) => {
                  const remaining = product.totalCount - product.soldCount;
                  const inCart = cart.get(product.id)?.quantity || 0;

                  return (
                    <tr key={product.id} className={`hover:bg-gray-50 ${remaining === 0 ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900 text-sm">{product.productName}</span>
                      </td>
                      <td className="px-3 py-3 text-center text-sm font-medium">{product.price} Kč</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-sm font-medium ${remaining === 0 ? "text-red-600" : remaining <= 3 ? "text-orange-600" : "text-gray-700"}`}>
                          {remaining} / {product.totalCount}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {inCart > 0 && (
                          <span className="bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded text-sm">
                            {inCart}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => addToCart(product)}
                            disabled={remaining <= inCart}
                            className="bg-green-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Koupit
                          </button>
                          <button
                            onClick={() => removeFromCart(product.id)}
                            disabled={inCart === 0}
                            className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs font-medium hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Odebrat
                          </button>
                          <button
                            onClick={() => setProductModal({
                              open: true,
                              editId: product.id,
                              productName: product.productName,
                              price: String(product.price),
                              totalCount: String(product.totalCount),
                            })}
                            className="text-gray-400 hover:text-blue-600 p-1"
                            title="Upravit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteProduct(product.id)}
                            className="text-gray-400 hover:text-red-600 p-1"
                            title="Smazat"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Žádné produkty. Přidejte produkt pomocí tlačítka výše.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Show Sales Button */}
        {transactions.length > 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={() => { setShowSales(true); setSalesTab("summary"); }}
              className="bg-purple-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-purple-700 inline-flex items-center gap-2"
            >
              <BarChart3 className="w-5 h-5" /> Ukaž prodeje
            </button>
          </div>
        )}
      </main>

      {/* New Fair Modal */}
      {showNewFair && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h2 className="text-lg font-bold mb-4">Nový veletrh</h2>
            <input
              type="text"
              value={newFairName}
              onChange={(e) => setNewFairName(e.target.value)}
              placeholder="Název (např. Veletrh 17.5.2026)"
              className="w-full border rounded-lg px-3 py-2 mb-4"
              onKeyDown={(e) => e.key === "Enter" && createFair()}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowNewFair(false)} className="px-4 py-2 text-gray-600">Zrušit</button>
              <button onClick={createFair} className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700">
                Vytvořit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Product Modal */}
      {productModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold mb-4">
              {productModal.editId ? "Upravit produkt" : "Přidat produkt"}
            </h2>
            <div className="space-y-4">
              <div ref={searchRef} className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Název produktu</label>
                <input
                  type="text"
                  value={productModal.editId ? productModal.productName : searchQuery}
                  onChange={(e) => {
                    if (productModal.editId) {
                      setProductModal({ ...productModal, productName: e.target.value });
                    } else {
                      setSearchQuery(e.target.value);
                      setProductModal({ ...productModal, productName: e.target.value });
                      setShowSuggestions(true);
                    }
                  }}
                  placeholder="Začněte psát název..."
                  className="w-full border rounded-lg px-3 py-2"
                  autoFocus
                />
                {showSuggestions && suggestions.length > 0 && !productModal.editId && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setProductModal({ ...productModal, productName: p.productName });
                          setSearchQuery(p.productName);
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0"
                      >
                        {p.productName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cena za kus (Kč)</label>
                <input
                  type="number"
                  value={productModal.price}
                  onChange={(e) => setProductModal({ ...productModal, price: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="59"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Počet kusů</label>
                <input
                  type="number"
                  value={productModal.totalCount}
                  onChange={(e) => setProductModal({ ...productModal, totalCount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="20"
                  min={1}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setProductModal(null); setSearchQuery(""); }}
                className="px-4 py-2 text-gray-600"
              >
                Zrušit
              </button>
              <button
                onClick={addProduct}
                disabled={!productModal.productName.trim() || !productModal.price || !productModal.totalCount}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40"
              >
                {productModal.editId ? "Uložit" : "Přidat"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Modal */}
      {showSales && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BarChart3 className="w-5 h-5" /> Prodeje
              </h2>
              <button onClick={() => setShowSales(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b">
              <button
                onClick={() => setSalesTab("summary")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                  salesTab === "summary" ? "border-purple-600 text-purple-600" : "border-transparent text-gray-500"
                }`}
              >
                Souhrn
              </button>
              <button
                onClick={() => setSalesTab("orders")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                  salesTab === "orders" ? "border-purple-600 text-purple-600" : "border-transparent text-gray-500"
                }`}
              >
                Objednávky ({transactions.length})
              </button>
            </div>

            {salesTab === "summary" && (
              <div>
                <div className="bg-purple-50 rounded-lg p-4 mb-4 flex flex-wrap gap-6">
                  <div>
                    <span className="text-sm text-purple-600">Celkem prodáno</span>
                    <p className="text-2xl font-bold text-purple-800">{totalSoldItems} ks</p>
                  </div>
                  <div>
                    <span className="text-sm text-purple-600">Celkový příjem</span>
                    <p className="text-2xl font-bold text-purple-800">{totalRevenue} Kč</p>
                  </div>
                  <div>
                    <span className="text-sm text-purple-600">Počet transakcí</span>
                    <p className="text-2xl font-bold text-purple-800">{transactions.length}</p>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Produkt</th>
                      <th className="px-3 py-2 text-center">Prodáno</th>
                      <th className="px-3 py-2 text-center">Cena/ks</th>
                      <th className="px-3 py-2 text-right">Celkem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {salesSummary.map((s) => (
                      <tr key={s.productName}>
                        <td className="px-3 py-2 font-medium">{s.productName}</td>
                        <td className="px-3 py-2 text-center">{s.soldCount} ks</td>
                        <td className="px-3 py-2 text-center">{s.unitPrice} Kč</td>
                        <td className="px-3 py-2 text-right font-medium">{s.totalRevenue} Kč</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2">
                    <tr className="font-bold">
                      <td className="px-3 py-2">Celkem</td>
                      <td className="px-3 py-2 text-center">{totalSoldItems} ks</td>
                      <td></td>
                      <td className="px-3 py-2 text-right">{totalRevenue} Kč</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {salesTab === "orders" && (
              <div className="space-y-3">
                {transactions.map((tx, idx) => {
                  const txProducts = tx.items.map((item) => {
                    const product = products.find((p) => p.id === item.fairProductId);
                    return { ...item, productName: product?.productName || "?" };
                  });
                  return (
                    <div key={tx.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-500">
                          #{transactions.length - idx} • {new Date(tx.createdAt).toLocaleTimeString("cs")}
                        </span>
                        <span className="font-bold text-green-700">{tx.totalPrice} Kč</span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        {txProducts.map((item, i) => (
                          <div key={i}>
                            {item.productName} × {item.quantity} = {item.quantity * item.unitPrice} Kč
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
