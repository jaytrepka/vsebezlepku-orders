import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST - Zero out stock products not seen during sync
export async function POST(request: NextRequest) {
  try {
    const { syncedProductNames } = await request.json();

    if (!syncedProductNames || !Array.isArray(syncedProductNames)) {
      return NextResponse.json({ error: "syncedProductNames array required" }, { status: 400 });
    }

    // Find all stock products NOT in the synced list
    const staleProducts = await prisma.stockProduct.findMany({
      where: {
        productName: { notIn: syncedProductNames },
        totalCount: { gt: 0 },
      },
      include: { expirations: true },
    });

    let zeroed = 0;

    for (const product of staleProducts) {
      // Delete all expirations
      if (product.expirations.length > 0) {
        await prisma.expirationDate.deleteMany({
          where: { stockProductId: product.id },
        });
      }

      // Set totalCount to 0
      await prisma.stockProduct.update({
        where: { id: product.id },
        data: { totalCount: 0 },
      });

      zeroed++;
    }

    return NextResponse.json({ zeroed, staleProducts: staleProducts.map(p => p.productName) });
  } catch (error) {
    console.error("Stock cleanup-stale error:", error);
    return NextResponse.json({ error: "Failed to cleanup" }, { status: 500 });
  }
}
