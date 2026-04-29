import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeProductName(name: string): string {
  return name.replace(/\s*-\s*Pomozte nepl[ýy]tvat\s*$/i, "").trim();
}

// GET - Return daily sales history for a specific product
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productName = searchParams.get("productName");

    if (!productName) {
      return NextResponse.json({ error: "productName required" }, { status: 400 });
    }

    const normalized = normalizeProductName(productName);

    // Get the stock product to find its code
    const stockProduct = await prisma.stockProduct.findFirst({
      where: { productName },
    });

    // Fetch all order items and filter in JS (same approach as predictions)
    const orderItems = await prisma.orderItem.findMany({
      select: {
        productName: true,
        productCode: true,
        quantity: true,
        order: { select: { emailDate: true } },
      },
    });

    // Match items by normalized name or product code
    const matchingItems = orderItems.filter((item) => {
      const itemNormalized = normalizeProductName(item.productName);
      if (itemNormalized === normalized || itemNormalized === productName) return true;
      if (stockProduct?.code && item.productCode === stockProduct.code) return true;
      return false;
    });

    // Aggregate by day
    const dailySales = new Map<string, number>();
    for (const item of matchingItems) {
      const day = item.order.emailDate.toISOString().split("T")[0];
      dailySales.set(day, (dailySales.get(day) || 0) + item.quantity);
    }

    // Sort by date and return
    const history = [...dailySales.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, quantity]) => ({ date, quantity }));

    return NextResponse.json({ productName, history });
  } catch (error) {
    console.error("Sales history error:", error);
    return NextResponse.json({ error: "Failed to fetch sales history" }, { status: 500 });
  }
}
