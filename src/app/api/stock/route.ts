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

// POST - Upsert product(s) (used by Tampermonkey script)
// Supports single: { productName: string, totalCount: number }
// Supports batch: { items: [{ name: string, stock: string, code: string }, ...] }
// If count decreased, subtract from soonest-expiring batches first (FIFO)
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Batch mode (from Tampermonkey)
    if (data.items && Array.isArray(data.items)) {
      const results: Record<string, {
        found: boolean;
        totalCount: number;
        earliest: { date: string; count: number } | null;
        expirations: { date: string; count: number; neplytvatConfirmed: boolean }[];
      }> = {};

      for (const item of data.items) {
        const productName = item.name;
        const totalCount = parseInt(item.stock, 10);
        const code = item.code || null;
        if (!productName || isNaN(totalCount)) continue;

        const product = await upsertProduct(productName, totalCount, code);
        const expirations = product.expirations || [];

        results[item.code] = {
          found: expirations.length > 0,
          totalCount: product.totalCount,
          earliest: expirations.length > 0
            ? { date: expirations[0].expirationDate.toISOString(), count: expirations[0].count }
            : null,
          expirations: expirations.map((e) => ({
            date: e.expirationDate.toISOString(),
            count: e.count,
            neplytvatConfirmed: e.neplytvatConfirmed,
          })),
        };
      }

      return NextResponse.json(results);
    }

    // Single mode
    const { productName, totalCount } = data;
    if (!productName || totalCount === undefined) {
      return NextResponse.json({ error: "productName and totalCount required" }, { status: 400 });
    }

    const product = await upsertProduct(productName, totalCount, data.code || null);
    return NextResponse.json(product);
  } catch (error) {
    console.error("Stock upsert error:", error);
    return NextResponse.json({ error: "Failed to upsert stock" }, { status: 500 });
  }
}

async function upsertProduct(productName: string, totalCount: number, code: string | null = null) {
  const existing = await prisma.stockProduct.findUnique({
    where: { productName },
    include: { expirations: { orderBy: { expirationDate: "asc" } } },
  });

  if (!existing) {
    return await prisma.stockProduct.create({
      data: { productName, totalCount, code },
      include: { expirations: true },
    });
  }

  const diff = existing.totalCount - totalCount;

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

  const updateData: { totalCount: number; code?: string } = { totalCount };
  if (code) updateData.code = code;

  return await prisma.stockProduct.update({
    where: { productName },
    data: updateData,
    include: { expirations: { orderBy: { expirationDate: "asc" } } },
  });
}
