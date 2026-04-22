"use client";

import { useState, useEffect } from "react";
import { Package, FileText, Plus, Trash2, Printer, Edit2 } from "lucide-react";

interface ProductLabel {
  id: string;
  productName: string;
  nazev: string;
  slozeni: string;
  nutricniHodnoty: string;
  skladovani?: string;
  vyrobce: string;
  verified?: boolean;
  hasFactoryLabel?: boolean;
}

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice?: string;
  productUrl?: string;
  label?: ProductLabel | null;
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
  const [excludedItems, setExcludedItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [startPosition, setStartPosition] = useState(1);
  const [labelModal, setLabelModal] = useState<{
    open: boolean;
    productName: string;
    productUrl?: string;
    isEdit: boolean;
    language: "cs" | "pl" | "sk";
  } | null>(null);
  const [labelForm, setLabelForm] = useState({
    nazev: "",
    slozeni: "",
    nutricniHodnoty: "",
    skladovani: "",
    vyrobce: "",
  });
  const [fetchingProductInfo, setFetchingProductInfo] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [labelLanguage, setLabelLanguage] = useState<"cs" | "pl" | "sk">("cs");
  const [languageLabels, setLanguageLabels] = useState<Map<string, ProductLabel>>(new Map());

  const languageNames = {
    cs: "Čeština",
    pl: "Polski",
    sk: "Slovenčina",
  };

  // Get label for product in selected language
  function normalizeProductName(name: string): string {
    return name.replace(/\s*-\s*Pomozte nepl[ýy]tvat\s*$/i, "").replace(/\s*-\s*Pomoze nepl[ýy]tvat\s*$/i, "").trim();
  }

  function getLabelForProduct(item: OrderItem): ProductLabel | null {
    if (labelLanguage === "cs") {
      return item.label || null;
    }
    // For other languages, try multiple lookups:
    // 1. By Czech label's productName (exact)
    // 2. By Czech label's productName (normalized, without "Pomozte neplýtvat")
    // 3. By item's productName (exact)
    // 4. By item's productName (normalized)
    if (item.label) {
      const found = languageLabels.get(item.label.productName)
        || languageLabels.get(normalizeProductName(item.label.productName));
      if (found) return found;
    }
    return languageLabels.get(item.productName)
      || languageLabels.get(normalizeProductName(item.productName))
      || null;
  }

  // Calculate total items to print (from selected orders, excluding unchecked items and items without labels in selected language)
  const itemsToPrint = orders
    .filter((o) => selectedOrders.includes(o.id))
    .flatMap((o) => o.items)
    .filter((item) => !excludedItems.includes(item.id) && getLabelForProduct(item))
    .reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    fetchOrders();
  }, []);

  // Fetch labels for selected language (non-Czech)
  useEffect(() => {
    if (labelLanguage !== "cs") {
      fetchLanguageLabels();
    } else {
      setLanguageLabels(new Map());
    }
  }, [labelLanguage]);

  async function fetchLanguageLabels() {
    const res = await fetch(`/api/labels?language=${labelLanguage}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      const map = new Map<string, ProductLabel>();
      for (const label of data) {
        map.set(label.productName, label);
      }
      setLanguageLabels(map);
    }
  }

  async function toggleVerified(label: ProductLabel) {
    try {
      const res = await fetch("/api/labels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: label.id, verified: !label.verified }),
      });
      if (res.ok) {
        // Refresh data
        fetchOrders();
        if (labelLanguage !== "cs") {
          fetchLanguageLabels();
        }
      }
    } catch {
      setMessage({ type: "error", text: "Chyba při aktualizaci štítku" });
    }
  }

  async function fetchOrders() {
    const res = await fetch("/api/orders");
    const data = await res.json();
    if (Array.isArray(data)) {
      setOrders(data);
    }
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

    if (itemsToPrint === 0) {
      setMessage({ type: "error", text: "Žádné položky k tisku - všechny jsou odškrtnuté" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/labels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedOrders, startPosition, excludedItemIds: excludedItems, language: labelLanguage }),
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
        language: labelModal.language,
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
    if (labelLanguage !== "cs") {
      fetchLanguageLabels();
    }
  }

  function toggleOrder(orderId: string) {
    setSelectedOrders((prev) => {
      if (prev.includes(orderId)) {
        return prev.filter((id) => id !== orderId);
      } else {
        // When selecting order, ensure all its items are included (not excluded)
        const order = orders.find((o) => o.id === orderId);
        if (order) {
          const itemIds = order.items.map((i) => i.id);
          setExcludedItems((ex) => ex.filter((id) => !itemIds.includes(id)));
        }
        return [...prev, orderId];
      }
    });
  }

  function toggleItem(itemId: string) {
    setExcludedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  }

  function excludeAllItems(orderId: string) {
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      const itemIds = order.items.map((i) => i.id);
      setExcludedItems((prev) => [...new Set([...prev, ...itemIds])]);
    }
  }

  function includeAllItems(orderId: string) {
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      const itemIds = order.items.map((i) => i.id);
      setExcludedItems((prev) => prev.filter((id) => !itemIds.includes(id)));
    }
  }

  function selectAll() {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map((o) => o.id));
    }
  }

  function openLabelModal(productName: string, existingLabel?: ProductLabel | null, productUrl?: string, language: "cs" | "pl" | "sk" = "cs") {
    setLabelModal({ open: true, productName, productUrl, isEdit: !!existingLabel, language });
    if (existingLabel) {
      setLabelForm({
        nazev: existingLabel.nazev,
        slozeni: existingLabel.slozeni,
        nutricniHodnoty: existingLabel.nutricniHodnoty,
        skladovani: existingLabel.skladovani || "",
        vyrobce: existingLabel.vyrobce,
      });
    } else {
      setLabelForm({
        nazev: productName,
        slozeni: "",
        nutricniHodnoty: "",
        skladovani: "",
        vyrobce: "",
      });
    }
  }

  async function switchModalLanguage(newLang: "cs" | "pl" | "sk") {
    if (!labelModal) return;
    
    // Fetch label for the new language
    try {
      const res = await fetch(`/api/labels?language=${newLang}`);
      const labels = await res.json();
      const label = Array.isArray(labels) 
        ? labels.find((l: ProductLabel) => l.productName === labelModal.productName)
        : null;
      
      setLabelModal({ ...labelModal, language: newLang, isEdit: !!label });
      
      if (label) {
        setLabelForm({
          nazev: label.nazev,
          slozeni: label.slozeni,
          nutricniHodnoty: label.nutricniHodnoty,
          skladovani: label.skladovani || "",
          vyrobce: label.vyrobce,
        });
      } else {
        // No label for this language yet - start with empty form
        setLabelForm({
          nazev: labelModal.productName,
          slozeni: "",
          nutricniHodnoty: "",
          skladovani: "",
          vyrobce: "",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Chyba při načítání štítku" });
    }
  }

  async function fetchProductInfo() {
    if (!labelModal?.productUrl) return;
    
    setFetchingProductInfo(true);
    try {
      const res = await fetch("/api/labels/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productUrl: labelModal.productUrl }),
      });
      const data = await res.json();
      
      if (data.error) {
        setMessage({ type: "error", text: "Nepodařilo se načíst data z produktové stránky" });
      } else {
        setLabelForm((prev) => ({
          nazev: data.nazev || prev.nazev,
          slozeni: data.slozeni || prev.slozeni,
          nutricniHodnoty: data.nutricniHodnoty || prev.nutricniHodnoty,
          skladovani: data.skladovani || prev.skladovani,
          vyrobce: data.vyrobce || prev.vyrobce,
        }));
        setMessage({ type: "success", text: "Data načtena z produktové stránky" });
      }
    } catch {
      setMessage({ type: "error", text: "Chyba při načítání produktové stránky" });
    }
    setFetchingProductInfo(false);
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
            <label className="text-sm text-gray-600">Jazyk štítků:</label>
            <select
              value={labelLanguage}
              onChange={(e) => setLabelLanguage(e.target.value as "cs" | "pl" | "sk")}
              className="border rounded px-2 py-1"
            >
              <option value="cs">🇨🇿 Čeština</option>
              <option value="pl">🇵🇱 Polski</option>
              <option value="sk">🇸🇰 Slovenčina</option>
            </select>
          </div>

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
            disabled={selectedOrders.length === 0 || itemsToPrint === 0 || loading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Generovat štítky ({itemsToPrint} ks)
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
                    className="rounded w-5 h-5 cursor-pointer"                  />
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
                      className="rounded w-5 h-5 cursor-pointer"
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
                      {selectedOrders.includes(order.id) && order.items.length > 1 && (
                        <div className="flex gap-2 mb-1">
                          <button
                            onClick={() => includeAllItems(order.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            Vybrat vše
                          </button>
                          <span className="text-xs text-gray-300">|</span>
                          <button
                            onClick={() => excludeAllItems(order.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            Zrušit vše
                          </button>
                        </div>
                      )}
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-2 text-sm ${
                            excludedItems.includes(item.id) ? "opacity-50" : ""
                          }`}
                        >
                          {selectedOrders.includes(order.id) && (
                            <input
                              type="checkbox"
                              checked={!excludedItems.includes(item.id)}
                              onChange={() => toggleItem(item.id)}
                              className="rounded w-5 h-5 min-w-5 cursor-pointer"
                              title="Zahrnout do tisku"
                            />
                          )}
                          <span className="font-medium whitespace-nowrap">{item.quantity}×</span>
                          <span className="break-words" title={item.productName}>
                            {item.productName}
                          </span>
                          {(() => {
                            const langLabel = getLabelForProduct(item);
                            const hasCzechLabel = !!item.label;
                            const currentLabel = labelLanguage === "cs" ? item.label : langLabel;
                            
                            // Check if product has factory label
                            if (currentLabel?.hasFactoryLabel) {
                              return (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                  Produkt má štítek z výroby
                                </span>
                              );
                            }
                            
                            if (labelLanguage === "cs") {
                              // Czech: show edit if has label, add if not
                              return hasCzechLabel ? (
                                <>
                                  <button
                                    onClick={() => openLabelModal(item.productName, item.label, item.productUrl, "cs")}
                                    className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200 flex items-center gap-1 cursor-pointer"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    Štítek ✓
                                  </button>
                                  <button
                                    onClick={() => item.label && toggleVerified(item.label)}
                                    className={`text-xs px-2 py-1 rounded cursor-pointer ${
                                      item.label?.verified
                                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                    }`}
                                  >
                                    {item.label?.verified ? "ověřeno" : "neověřeno"}
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => openLabelModal(item.productName, null, item.productUrl, "cs")}
                                  className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded hover:bg-yellow-200 flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  Přidat štítek
                                </button>
                              );
                            } else {
                              // Other language: show translation status
                              return langLabel ? (
                                <>
                                  <button
                                    onClick={() => openLabelModal(langLabel.productName, langLabel, item.productUrl, labelLanguage)}
                                    className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200 flex items-center gap-1 cursor-pointer"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    {labelLanguage.toUpperCase()} ✓
                                  </button>
                                  <button
                                    onClick={() => toggleVerified(langLabel)}
                                    className={`text-xs px-2 py-1 rounded cursor-pointer ${
                                      langLabel.verified
                                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                    }`}
                                  >
                                    {langLabel.verified ? "ověřeno" : "neověřeno"}
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => openLabelModal(item.label?.productName || item.productName, null, item.productUrl, labelLanguage)}
                                  className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded hover:bg-red-200 flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  Přidat {labelLanguage.toUpperCase()}
                                </button>
                              );
                            }
                          })()}
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
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {labelModal.isEdit ? "Upravit štítek" : "Vytvořit štítek"}
            </h2>
            <p className="text-sm text-gray-600 mb-2">
              Produkt: <strong>{labelModal.productName}</strong>
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Jazyk štítku</label>
              <div className="flex gap-2">
                {(["cs", "pl", "sk"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => switchModalLanguage(lang)}
                    className={`px-3 py-1.5 rounded text-sm cursor-pointer ${
                      labelModal.language === lang
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {lang === "cs" ? "🇨🇿 CZ" : lang === "pl" ? "🇵🇱 PL" : "🇸🇰 SK"}
                  </button>
                ))}
              </div>
            </div>
            
            {labelModal.productUrl && !labelModal.isEdit && (
              <button
                onClick={fetchProductInfo}
                disabled={fetchingProductInfo}
                className="mb-4 bg-purple-600 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                {fetchingProductInfo ? "Načítám..." : "📥 Načíst data z webu"}
              </button>
            )}

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
                  placeholder="PISTÁCIOVÉ DONUTY (90g)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Složení (alergeny tučně pomocí **text**)
                </label>
                <textarea
                  value={labelForm.slozeni}
                  onChange={(e) =>
                    setLabelForm({ ...labelForm, slozeni: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  rows={4}
                  placeholder="bílá poleva 29 % (cukr, rostlinný tuk), sušené odstředěné **mléko**, emulgátor: **sójový** lecitin..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nutriční hodnoty (na 100g)
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
                  rows={3}
                  placeholder="Energetická hodnota: 2259 kJ / 540 kcal. Tuky: 32 g..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Info (volitelné)
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
                  placeholder="Piaceri Mediterranei – Italy."
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

