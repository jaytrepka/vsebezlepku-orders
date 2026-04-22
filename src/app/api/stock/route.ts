import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - List all stock products with expirations, sorted by earliest expiration
export async function GET() {
  try {
    const products = await prisma.stockProduct.findMany({
      include: {
        expirations: {
          orderBy: { expirationDate: "asc" },
        },
      },
    });

    // Sort products by their earliest expiration date (products without expirations go last)
    products.sort((a, b) => {
      const aEarliest = a.expirations[0]?.expirationDate;
      const bEarliest = b.expirations[0]?.expirationDate;
      if (!aEarliest && !bEarliest) return a.productName.localeCompare(b.productName);
      if (!aEarliest) return 1;
      if (!bEarliest) return -1;
      return aEarliest.getTime() - bEarliest.getTime();
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("Stock fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch stock" }, { status: 500 });
  }
}

// POST - Upsert product (used by Tampermonkey script)
// Body: { productName: string, totalCount: number }
// If count decreased, subtract from soonest-expiring batches first (FIFO)
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { productName, totalCount } = data;

    if (!productName || totalCount === undefined) {
      return NextResponse.json({ error: "productName and totalCount required" }, { status: 400 });
    }

    const existing = await prisma.stockProduct.findUnique({
      where: { productName },
      include: { expirations: { orderBy: { expirationDate: "asc" } } },
    });

    if (!existing) {
      // Create new product
      const product = await prisma.stockProduct.create({
        data: { productName, totalCount },
        include: { expirations: true },
      });
      return NextResponse.json(product);
    }

    // Update existing product
    const oldCount = existing.totalCount;
    const diff = oldCount - totalCount;

    if (diff > 0) {
      // Count decreased — subtract from soonest-expiring batches (FIFO)
      let remaining = diff;
      for (const exp of existing.expirations) {
        if (remaining <= 0) break;
        if (exp.count <= remaining) {
          remaining -= exp.count;
          await prisma.expirationDate.delete({ where: { id: exp.id } });
        } else {
          await prisma.expirationDate.update({
            where: { id: exp.id },
            data: { count: exp.count - remaining },
          });
          remaining = 0;
        }
      }
    }

    const product = await prisma.stockProduct.update({
      where: { productName },
      data: { totalCount },
      include: { expirations: { orderBy: { expirationDate: "asc" } } },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Stock upsert error:", error);
    return NextResponse.json({ error: "Failed to upsert stock" }, { status: 500 });
  }
}

// POST with batch: [{productName, totalCount}, ...]
// Also supports single object for backward compat
