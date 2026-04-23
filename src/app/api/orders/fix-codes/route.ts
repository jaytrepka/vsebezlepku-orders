import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST - Bulk update product codes on existing order items
// Accepts: { orders: [{ orderNumber, items: [{ productName, productCode }] }] }
export async function POST(request: NextRequest) {
  try {
    const { orders } = await request.json();
    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json({ error: "orders array required" }, { status: 400 });
    }

    let updated = 0;
    let skipped = 0;

    for (const orderData of orders) {
      const { orderNumber, items } = orderData;
      if (!orderNumber || !items) {
        skipped++;
        continue;
      }

      const order = await prisma.order.findUnique({
        where: { orderNumber },
        include: { items: true },
      });

      if (!order) {
        skipped++;
        continue;
      }

      for (const item of items) {
        if (!item.productCode) continue;

        // Find matching order item by product name
        const orderItem = order.items.find(
          (oi: { productName: string }) => oi.productName === item.productName
        );

        if (orderItem && !orderItem.productCode) {
          await prisma.orderItem.update({
            where: { id: orderItem.id },
            data: { productCode: item.productCode },
          });
          updated++;
        }
      }
    }

    return NextResponse.json({ updated, skipped });
  } catch (error) {
    console.error("Fix codes error:", error);
    return NextResponse.json({ error: "Failed to fix codes" }, { status: 500 });
  }
}
