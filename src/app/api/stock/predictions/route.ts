import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface SalesRecord {
  date: Date;
  quantity: number;
}

interface Prediction {
  productName: string;
  overallDate: string | null; // ISO date
  trendingDate: string | null; // ISO date (based on last 5 sales)
  overallVelocity: number | null; // items per day
  trendingVelocity: number | null;
  totalSold: number;
  orderCount: number;
  atRisk: boolean; // trending date (or overall if no trending) > earliest expiration
  atRiskOverall: boolean; // overall date > earliest expiration
  unsoldCountTrending: number | null;
  unsoldCountOverall: number | null;
}

function normalizeProductName(name: string): string {
  return name.replace(/\s*-\s*Pomozte nepl[ýy]tvat\s*$/i, "").trim();
}

// FIFO batch simulation: process expiration batches in order,
// sell at given velocity between each expiration date, count waste
function calculateBatchWaste(
  expirations: Array<{ count: number; expirationDate: Date }>,
  velocity: number,
  today: Date
): number {
  if (expirations.length === 0) return 0;

  const batches = expirations
    .map((e) => ({ count: e.count, expDate: new Date(e.expirationDate) }))
    .sort((a, b) => a.expDate.getTime() - b.expDate.getTime());

  if (velocity <= 0) {
    return batches.reduce((sum, b) => sum + b.count, 0);
  }

  let totalWaste = 0;
  let lastDate = today;

  for (let i = 0; i < batches.length; i++) {
    if (batches[i].expDate.getTime() <= today.getTime()) {
      // Already expired
      totalWaste += batches[i].count;
      batches[i].count = 0;
      continue;
    }

    const days = (batches[i].expDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    let piecesSold = velocity * days;

    // Sell from current batch first (expiring soonest), then later ones
    for (let j = i; j < batches.length && piecesSold > 0; j++) {
      const taken = Math.min(batches[j].count, piecesSold);
      batches[j].count -= taken;
      piecesSold -= taken;
    }

    // Whatever remains in this batch is wasted (just expired)
    totalWaste += batches[i].count;
    batches[i].count = 0;
    lastDate = batches[i].expDate;
  }

  return Math.ceil(totalWaste);
}

// GET - Compute predicted sold-out dates for all stock products
export async function GET() {
  try {
    // Fetch all stock products with expirations
    const stockProducts = await prisma.stockProduct.findMany({
      include: { expirations: { orderBy: { expirationDate: "asc" } } },
    });

    // Fetch all order items with their order dates
    const orderItems = await prisma.orderItem.findMany({
      select: {
        productName: true,
        productCode: true,
        quantity: true,
        order: { select: { emailDate: true } },
      },
    });

    // Build sales history per normalized product name AND per product code
    const salesByProduct = new Map<string, SalesRecord[]>();
    const salesByCode = new Map<string, SalesRecord[]>();
    for (const item of orderItems) {
      const normalized = normalizeProductName(item.productName);
      if (!salesByProduct.has(normalized)) {
        salesByProduct.set(normalized, []);
      }
      salesByProduct.get(normalized)!.push({
        date: item.order.emailDate,
        quantity: item.quantity,
      });

      if (item.productCode) {
        if (!salesByCode.has(item.productCode)) {
          salesByCode.set(item.productCode, []);
        }
        salesByCode.get(item.productCode)!.push({
          date: item.order.emailDate,
          quantity: item.quantity,
        });
      }
    }

    const today = new Date();
    const predictions: Record<string, Prediction> = {};

    for (const product of stockProducts) {
      const normalized = normalizeProductName(product.productName);
      const sales = salesByProduct.get(normalized)
        || salesByProduct.get(product.productName)
        || (product.code ? salesByCode.get(product.code) : null)
        || [];

      if (sales.length === 0 || product.totalCount <= 0) {
        predictions[product.productName] = {
          productName: product.productName,
          overallDate: null,
          trendingDate: null,
          overallVelocity: null,
          trendingVelocity: null,
          totalSold: 0,
          orderCount: 0,
          atRisk: false,
          atRiskOverall: false,
          unsoldCountTrending: null,
          unsoldCountOverall: null,
        };
        continue;
      }

      // Sort sales by date
      sales.sort((a, b) => a.date.getTime() - b.date.getTime());

      const totalSold = sales.reduce((sum, s) => sum + s.quantity, 0);
      const firstDate = sales[0].date;
      const lastDate = sales[sales.length - 1].date;
      const totalDays = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

      // Overall velocity
      const overallVelocity = totalSold / totalDays;
      const daysToSellOut = product.totalCount / overallVelocity;
      const overallDate = new Date(today.getTime() + daysToSellOut * 24 * 60 * 60 * 1000);

      // Trending velocity (last 5 distinct order dates with this product)
      // Group by order date to get distinct sales events
      const salesByDate = new Map<string, number>();
      for (const s of sales) {
        const key = s.date.toISOString().split("T")[0];
        salesByDate.set(key, (salesByDate.get(key) || 0) + s.quantity);
      }
      const sortedDates = [...salesByDate.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([dateStr, qty]) => ({ date: new Date(dateStr), quantity: qty }));

      let trendingDate: Date | null = null;
      let trendingVelocity: number | null = null;

      if (sortedDates.length >= 5) {
        const lastFive = sortedDates.slice(-5);
        const trendingTotal = lastFive.reduce((sum, s) => sum + s.quantity, 0);
        const trendingDays = Math.max(
          1,
          (lastFive[lastFive.length - 1].date.getTime() - lastFive[0].date.getTime()) / (1000 * 60 * 60 * 24)
        );
        trendingVelocity = trendingTotal / trendingDays;
        const trendingDaysToSellOut = product.totalCount / trendingVelocity;
        trendingDate = new Date(today.getTime() + trendingDaysToSellOut * 24 * 60 * 60 * 1000);
      }

      // Calculate waste using batch-by-batch FIFO simulation
      const expirationBatches = product.expirations.map((e) => ({
        count: e.count,
        expirationDate: new Date(e.expirationDate),
      }));

      let unsoldCountTrending: number | null = null;
      let unsoldCountOverall: number | null = null;

      unsoldCountOverall = calculateBatchWaste(expirationBatches, overallVelocity, today);
      if (trendingVelocity) {
        unsoldCountTrending = calculateBatchWaste(expirationBatches, trendingVelocity, today);
      }

      const atRisk = trendingVelocity
        ? (unsoldCountTrending ?? 0) > 0
        : unsoldCountOverall > 0;
      const atRiskOverall = unsoldCountOverall > 0;

      predictions[product.productName] = {
        productName: product.productName,
        overallDate: overallDate.toISOString(),
        trendingDate: trendingDate?.toISOString() || null,
        overallVelocity,
        trendingVelocity,
        totalSold,
        orderCount: sortedDates.length,
        atRisk,
        atRiskOverall,
        unsoldCountTrending,
        unsoldCountOverall,
      };
    }

    return NextResponse.json(predictions);
  } catch (error) {
    console.error("Predictions error:", error);
    return NextResponse.json({ error: "Failed to compute predictions" }, { status: 500 });
  }
}
