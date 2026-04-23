import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST - Bulk update order dates
// Body: { orders: [{ orderNumber: string, orderDate: string (ISO) }] }
export async function POST(request: NextRequest) {
  try {
    const { orders } = await request.json();

    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json({ error: "orders array required" }, { status: 400 });
    }

    let updated = 0;
    let notFound = 0;

    for (const { orderNumber, orderDate } of orders) {
      if (!orderNumber || !orderDate) continue;

      const result = await prisma.order.updateMany({
        where: { orderNumber },
        data: { emailDate: new Date(orderDate) },
      });

      if (result.count > 0) updated++;
      else notFound++;
    }

    return NextResponse.json({ updated, notFound });
  } catch (error) {
    console.error("Fix dates error:", error);
    return NextResponse.json({ error: "Failed to fix dates" }, { status: 500 });
  }
}
