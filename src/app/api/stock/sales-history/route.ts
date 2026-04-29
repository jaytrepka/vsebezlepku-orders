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

    // Get the stock product to find its code
    const stockProduct = await prisma.stockProduct.findFirst({
      where: { productName },
    });

    // Fetch all order items matching this product
    const normalized = normalizeProductName(productName);
    const orderItems = await prisma.orderItem.findMany({
      where: {
        OR: [
          { productName: productName },
          { productName: normalized },
          ...(stockProduct?.code ? [{ productCode: stockProduct.code }] : []),
        ],
      },
      select: {
        quantity: true,
        order: { select: { emailDate: true } },
      },
    });

    // Also find items with "Pomozte neplýtvat" suffix
    const neplytvatItems = await prisma.orderItem.findMany({
      where: {
        productName: { endsWith: "- Pomozte neplýtvat" },
        AND: {
          productName: { contains: normalized.substring(0, 30) },
        },
      },
      select: {
        productName: true,
        quantity: true,
        order: { select: { emailDate: true } },
      },
    });

    // Filter neplýtvat items to only those that actually match
    const matchingNeplyvat = neplytvatItems.filter(
      (item) => normalizeProductName(item.productName) === normalized
    );

    const allItems = [...orderItems, ...matchingNeplyvat];

    // Aggregate by day
    const dailySales = new Map<string, number>();
    for (const item of allItems) {
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
