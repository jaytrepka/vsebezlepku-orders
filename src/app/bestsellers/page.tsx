"use client";

import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";

interface ProductSales {
  productName: string;
  productCode: string | null;
  totalQuantity: number;
  orderCount: number;
}

interface PeriodData {
  label: string;
  products: ProductSales[];
}

type Periods = Record<string, PeriodData>;

const PERIOD_KEYS = ["1m", "3m", "6m", "1y"] as const;

export default function BestsellersPage() {
  const [data, setData] = useState<Periods | null>(null);
  const [activePeriod, setActivePeriod] = useState<string>("1m");
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [limit]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/bestsellers?limit=${limit}`);
      const json = await res.json();
      if (!json.error) setData(json);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  const period = data?.[activePeriod];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-green-600" />
            Nejprodávanější
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Přehled nejprodávanějších produktů podle období
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="bg-white rounded-lg shadow p-3 flex flex-wrap items-center gap-4">
          {/* Period tabs */}
          <div className="flex gap-1">
            {PERIOD_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => setActivePeriod(key)}
                className={`px-3 py-1.5 text-sm font-medium rounded cursor-pointer transition-colors ${
                  activePeriod === key
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {data?.[key]?.label || key}
              </button>
            ))}
          </div>

          {/* Limit selector */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-500">Zobrazit:</span>
            {[10, 20, 50].map((n) => (
              <button
                key={n}
                onClick={() => setLimit(n)}
                className={`px-2 py-1 text-sm rounded cursor-pointer ${
                  limit === n
                    ? "bg-green-100 text-green-700 font-medium"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Načítání...</div>
          ) : !period || period.products.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Žádná data pro toto období</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 w-12">#</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Produkt</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 w-20">Kód</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 w-28">Prodáno ks</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 w-28">Objednávek</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {period.products.map((product, idx) => {
                  const maxQty = period.products[0]?.totalQuantity || 1;
                  const barWidth = Math.round((product.totalQuantity / maxQty) * 100);

                  return (
                    <tr key={product.productName} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-400 font-mono">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <div
                            className="absolute inset-y-0 left-0 bg-green-50 rounded"
                            style={{ width: `${barWidth}%` }}
                          />
                          <span className="relative font-medium text-sm">{product.productName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                        {product.productCode || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-sm text-green-700">{product.totalQuantity}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">
                        {product.orderCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
