import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Return top sold products for different time periods
export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "10", 10);
    const now = new Date();

    const periods = [
      { key: "1m", label: "Poslední měsíc", since: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()) },
      { key: "3m", label: "Poslední 3 měsíce", since: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()) },
      { key: "6m", label: "Poslední 6 měsíců", since: new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()) },
      { key: "1y", label: "Poslední rok", since: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) },
    ];

    const result: Record<string, { label: string; products: { productName: string; productCode: string | null; totalQuantity: number; orderCount: number }[] }> = {};

    for (const period of periods) {
      const items = await prisma.orderItem.findMany({
        where: {
          order: { emailDate: { gte: period.since } },
        },
        select: {
          productName: true,
          productCode: true,
          quantity: true,
        },
      });

      // Aggregate by product name
      const agg = new Map<string, { productCode: string | null; totalQuantity: number; orderCount: number }>();
      for (const item of items) {
        const name = item.productName;
        const existing = agg.get(name);
        if (existing) {
          existing.totalQuantity += item.quantity;
          existing.orderCount += 1;
          if (!existing.productCode && item.productCode) existing.productCode = item.productCode;
        } else {
          agg.set(name, {
            productCode: item.productCode,
            totalQuantity: item.quantity,
            orderCount: 1,
          });
        }
      }

      // Sort by total quantity and take top N
      const sorted = [...agg.entries()]
        .map(([productName, data]) => ({ productName, ...data }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, limit);

      result[period.key] = { label: period.label, products: sorted };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Bestsellers error:", error);
    return NextResponse.json({ error: "Failed to compute bestsellers" }, { status: 500 });
  }
}
