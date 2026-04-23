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
        quantity: true,
        order: { select: { emailDate: true } },
      },
    });

    // Build sales history per normalized product name
    const salesByProduct = new Map<string, SalesRecord[]>();
    for (const item of orderItems) {
      const normalized = normalizeProductName(item.productName);
      if (!salesByProduct.has(normalized)) {
        salesByProduct.set(normalized, []);
      }
      salesByProduct.get(normalized)!.push({
        date: item.order.emailDate,
        quantity: item.quantity,
      });
    }

    const today = new Date();
    const predictions: Record<string, Prediction> = {};

    for (const product of stockProducts) {
      const normalized = normalizeProductName(product.productName);
      const sales = salesByProduct.get(normalized) || salesByProduct.get(product.productName) || [];

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

      // Check if at risk: predicted sold-out > earliest expiration
      const earliestExpiration = product.expirations[0]?.expirationDate;
      const relevantDate = trendingDate || overallDate;
      const atRisk = earliestExpiration
        ? relevantDate.getTime() > new Date(earliestExpiration).getTime()
        : false;
      const atRiskOverall = earliestExpiration
        ? overallDate.getTime() > new Date(earliestExpiration).getTime()
        : false;

      // Compute unsold counts at earliest expiration for both velocities
      let unsoldCountTrending: number | null = null;
      let unsoldCountOverall: number | null = null;
      if (earliestExpiration) {
        const daysUntilExpiration = Math.max(0, (new Date(earliestExpiration).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const soldByOverall = Math.floor(overallVelocity * daysUntilExpiration);
        unsoldCountOverall = Math.max(0, product.totalCount - soldByOverall);
        if (trendingVelocity) {
          const soldByTrending = Math.floor(trendingVelocity * daysUntilExpiration);
          unsoldCountTrending = Math.max(0, product.totalCount - soldByTrending);
        }
      }

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
