"use client";

import { useEffect, useState } from "react";
import { Tag, FileText, Search, AlertTriangle } from "lucide-react";

interface ProductLabel {
  id: string;
  productName: string;
  language: string;
  nazev: string;
  slozeni: string;
  nutricniHodnoty: string;
  skladovani: string | null;
  vyrobce: string;
  verified: boolean;
  hasFactoryLabel: boolean;
}

interface StockProduct {
  id: string;
  productName: string;
  code: string | null;
  totalCount: number;
}

interface SelectedProduct {
  productName: string;
  quantity: number;
}

const BRANDS = [
  { key: "pm", label: "PM", pattern: /Piaceri Mediterranei/i, color: "bg-blue-100 text-blue-700 border-blue-300" },
  { key: "mz", label: "MZ", pattern: /Massimo Zero/i, color: "bg-purple-100 text-purple-700 border-purple-300" },
  { key: "bauer", label: "Bauer", pattern: /Bauer/i, color: "bg-teal-100 text-teal-700 border-teal-300" },
  { key: "glutiniente", label: "Glutiniente", pattern: /Glutiniente/i, color: "bg-amber-100 text-amber-700 border-amber-300" },
];

function getProductBrand(name: string): string | null {
  for (const brand of BRANDS) {
    if (brand.pattern.test(name)) return brand.key;
  }
  return null;
}

function normalizeProductName(name: string): string {
  return name.replace(/\s*-\s*Pomozte nepl[ýy]tvat\s*$/i, "").trim();
}

function stripBrandPrefix(name: string): string {
  return name
    .replace(/\s*-\s*Pomozte nepl[ýy]tvat\s*$/i, "")
    .replace(/^(Piaceri Mediterranei|Massimo Zero|Bauer|Glutiniente)\s*/i, "")
    .replace(/bezlepkov[áéý]\s*/i, "")
    .replace(/bezlepkové\s*/i, "")
    .trim();
}

export default function LabelsPage() {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [labels, setLabels] = useState<Map<string, ProductLabel>>(new Map());
  const [selected, setSelected] = useState<Map<string, number>>(new Map());
  const [labelLanguage, setLabelLanguage] = useState<"cs" | "pl" | "sk">("cs");
  const [filterBrands, setFilterBrands] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [startPosition, setStartPosition] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Label modal state
  const [labelModal, setLabelModal] = useState<{
    open: boolean;
    productName: string;
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

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchLabels();
  }, [labelLanguage]);

  async function fetchProducts() {
    try {
      const res = await fetch("/api/stock");
      const data = await res.json();
      setProducts(data);
    } catch {
      setMessage({ type: "error", text: "Chyba při načítání produktů" });
    }
  }

  async function fetchLabels() {
    try {
      const res = await fetch(`/api/labels?language=${labelLanguage}`);
      const data = await res.json();
      const map = new Map<string, ProductLabel>();
      for (const label of data) {
        map.set(label.productName, label);
        map.set(stripBrandPrefix(label.productName), label);
        map.set(normalizeProductName(label.productName), label);
      }
      setLabels(map);
    } catch {
      setMessage({ type: "error", text: "Chyba při načítání štítků" });
    }
  }

  function getLabelForProduct(productName: string): ProductLabel | null {
    return labels.get(productName)
      || labels.get(normalizeProductName(productName))
      || labels.get(stripBrandPrefix(productName))
      || null;
  }

  function toggleProduct(productName: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(productName)) {
        next.delete(productName);
      } else {
        next.set(productName, 1);
      }
      return next;
    });
  }

  function setQuantity(productName: string, qty: number) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (qty <= 0) {
        next.delete(productName);
      } else {
        next.set(productName, qty);
      }
      return next;
    });
  }

  function toggleBrand(key: string) {
    setFilterBrands((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const filteredProducts = products.filter((p) => {
    if (filterBrands.size > 0) {
      const brand = getProductBrand(p.productName);
      if (!brand || !filterBrands.has(brand)) return false;
    }
    if (searchQuery) {
      return p.productName.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const totalLabels = Array.from(selected.values()).reduce((sum, qty) => sum + qty, 0);
  const printableLabels = Array.from(selected.entries()).reduce((sum, [name, qty]) => {
    const label = getLabelForProduct(name);
    if (label && !label.hasFactoryLabel) return sum + qty;
    return sum;
  }, 0);

  async function generateLabels() {
    if (selected.size === 0 || printableLabels === 0) return;

    setGenerating(true);
    try {
      const items = Array.from(selected.entries()).map(([productName, quantity]) => ({
        productName,
        quantity,
      }));

      const res = await fetch("/api/labels/generate-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, startPosition, language: labelLanguage }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `product-labels-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: "success", text: `PDF vygenerováno (${printableLabels} štítků)` });
    } catch (e) {
      setMessage({ type: "error", text: `Chyba: ${e instanceof Error ? e.message : "Neznámá chyba"}` });
    }
    setGenerating(false);
  }

  function openLabelModal(productName: string, existingLabel?: ProductLabel | null) {
    setLabelModal({ open: true, productName, isEdit: !!existingLabel, language: labelLanguage });
    if (existingLabel) {
      setLabelForm({
        nazev: existingLabel.nazev,
        slozeni: existingLabel.slozeni,
        nutricniHodnoty: existingLabel.nutricniHodnoty,
        skladovani: existingLabel.skladovani || "",
        vyrobce: existingLabel.vyrobce,
      });
    } else {
      setLabelForm({ nazev: productName, slozeni: "", nutricniHodnoty: "", skladovani: "", vyrobce: "" });
    }
  }

  async function switchModalLanguage(newLang: "cs" | "pl" | "sk") {
    if (!labelModal) return;
    try {
      const res = await fetch(`/api/labels?language=${newLang}`);
      const labelsData = await res.json();
      const label = Array.isArray(labelsData)
        ? labelsData.find((l: ProductLabel) => l.productName === labelModal.productName)
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
        setLabelForm({ nazev: labelModal.productName, slozeni: "", nutricniHodnoty: "", skladovani: "", vyrobce: "" });
      }
    } catch {
      setMessage({ type: "error", text: "Chyba při načítání štítku" });
    }
  }

  async function saveLabel() {
    if (!labelModal) return;
    try {
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: labelModal.productName,
          language: labelModal.language,
          ...labelForm,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setMessage({ type: "success", text: "Štítek uložen" });
      setLabelModal(null);
      fetchLabels();
    } catch {
      setMessage({ type: "error", text: "Chyba při ukládání štítku" });
    }
  }

  async function toggleVerified(label: ProductLabel) {
    try {
      await fetch("/api/labels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: label.id, verified: !label.verified }),
      });
      fetchLabels();
    } catch {
      setMessage({ type: "error", text: "Chyba při aktualizaci" });
    }
  }

  async function toggleFactoryLabel(label: ProductLabel) {
    try {
      await fetch("/api/labels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: label.id, hasFactoryLabel: !label.hasFactoryLabel }),
      });
      fetchLabels();
    } catch {
      setMessage({ type: "error", text: "Chyba při aktualizaci" });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Tag className="w-7 h-7 text-green-600" />
              Produktové štítky
            </h1>
            <div className="flex items-center gap-1">
              {([["cs", "🇨🇿"], ["sk", "🇸🇰"], ["pl", "🇵🇱"]] as const).map(([lang, flag]) => (
                <button
                  key={lang}
                  onClick={() => setLabelLanguage(lang)}
                  className={`text-2xl px-2 py-1 rounded cursor-pointer transition-all ${
                    labelLanguage === lang
                      ? "bg-blue-100 ring-2 ring-blue-500 scale-110"
                      : "opacity-50 hover:opacity-80 hover:bg-gray-100"
                  }`}
                  title={lang.toUpperCase()}
                >
                  {flag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

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

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-6">
        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-4">
          {/* Search + Generate */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Hledat produkt..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Počáteční pozice:</label>
              <input
                type="number"
                value={startPosition}
                onChange={(e) => setStartPosition(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 border rounded px-2 py-1 text-sm"
                min={1}
              />
            </div>
            <button
              onClick={generateLabels}
              disabled={printableLabels === 0 || generating}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {generating ? "Generuji..." : `🏷️ Generovat štítky (${printableLabels})`}
            </button>
          </div>

          {/* Brand filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-500">Značka:</span>
            {BRANDS.map((brand) => (
              <button
                key={brand.key}
                onClick={() => toggleBrand(brand.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all ${
                  filterBrands.has(brand.key)
                    ? `${brand.color} ring-2 ring-offset-1`
                    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                }`}
              >
                {brand.label}
              </button>
            ))}
            {filterBrands.size > 0 && (
              <button
                onClick={() => setFilterBrands(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕ Reset
              </button>
            )}
            <span className="ml-auto text-sm text-gray-400">
              {filteredProducts.length} produktů | Vybráno: {selected.size} ({totalLabels} štítků)
            </span>
          </div>
        </div>

        {/* Product list */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 w-10">✓</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">Produkt</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 w-20">Sklad</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 w-24">Počet</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 w-40">Štítek</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProducts.map((product) => {
                  const isSelected = selected.has(product.productName);
                  const label = getLabelForProduct(product.productName);
                  const quantity = selected.get(product.productName) || 1;

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-gray-50 ${isSelected ? "bg-green-50" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleProduct(product.productName)}
                          className="w-4 h-4 accent-green-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-sm font-medium text-gray-900">{product.productName}</span>
                        {product.code && (
                          <span className="ml-2 text-xs text-gray-400">{product.code}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-sm ${product.totalCount === 0 ? "text-red-500" : "text-gray-600"}`}>
                          {product.totalCount} ks
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isSelected && (
                          <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(product.productName, parseInt(e.target.value) || 0)}
                            className="w-16 border rounded px-2 py-1 text-sm text-center"
                            min={1}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {label ? (
                            <>
                              <button
                                onClick={() => openLabelModal(product.productName, label)}
                                className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded cursor-pointer hover:bg-green-200"
                              >
                                Štítek ✓
                              </button>
                              {label.hasFactoryLabel && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                  🏭
                                </span>
                              )}
                              {label.verified && (
                                <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                                  ✓
                                </span>
                              )}
                              <button
                                onClick={() => toggleVerified(label)}
                                className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                                title={label.verified ? "Odebrat ověření" : "Ověřit"}
                              >
                                {label.verified ? "🔓" : "🔒"}
                              </button>
                              <button
                                onClick={() => toggleFactoryLabel(label)}
                                className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                                title={label.hasFactoryLabel ? "Nemá výrobní štítek" : "Má výrobní štítek"}
                              >
                                {label.hasFactoryLabel ? "🏭" : "🏷️"}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => openLabelModal(product.productName, null)}
                              className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded cursor-pointer hover:bg-yellow-200 flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              Přidat štítek
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Žádné produkty
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Label Modal */}
      {labelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Název</label>
                <input
                  type="text"
                  value={labelForm.nazev}
                  onChange={(e) => setLabelForm({ ...labelForm, nazev: e.target.value })}
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
                  onChange={(e) => setLabelForm({ ...labelForm, slozeni: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={4}
                  placeholder="cukr, rostlinný tuk, sušené **mléko**, emulgátor: **sójový** lecitin..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nutriční hodnoty (na 100g)
                </label>
                <textarea
                  value={labelForm.nutricniHodnoty}
                  onChange={(e) => setLabelForm({ ...labelForm, nutricniHodnoty: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Energetická hodnota: 2259 kJ / 540 kcal. Tuky: 32 g..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Info (volitelné)</label>
                <input
                  type="text"
                  value={labelForm.skladovani}
                  onChange={(e) => setLabelForm({ ...labelForm, skladovani: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Skladujte v suchu a chladu"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Výrobce</label>
                <input
                  type="text"
                  value={labelForm.vyrobce}
                  onChange={(e) => setLabelForm({ ...labelForm, vyrobce: e.target.value })}
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
