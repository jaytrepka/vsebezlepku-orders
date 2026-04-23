import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST - Add expiration date to a product
// Body: { stockProductId: string, expirationDate: string (ISO), count: number }
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { stockProductId, expirationDate, count } = data;

    if (!stockProductId || !expirationDate || !count) {
      return NextResponse.json({ error: "stockProductId, expirationDate, and count required" }, { status: 400 });
    }

    // Validate count doesn't exceed available (totalCount - already assigned)
    const product = await prisma.stockProduct.findUnique({
      where: { id: stockProductId },
      include: { expirations: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const assignedCount = product.expirations.reduce((sum, e) => sum + e.count, 0);
    const available = product.totalCount - assignedCount;
    const clampedCount = Math.min(count, Math.max(available, 0));

    if (clampedCount <= 0) {
      return NextResponse.json({ error: "No unassigned stock available" }, { status: 400 });
    }

    const expiration = await prisma.expirationDate.create({
      data: {
        stockProductId,
        expirationDate: new Date(expirationDate),
        count: clampedCount,
      },
    });

    return NextResponse.json(expiration);
  } catch (error) {
    console.error("Expiration create error:", error);
    return NextResponse.json({ error: "Failed to create expiration" }, { status: 500 });
  }
}

// PATCH - Update expiration entry (count, date, or neplýtvat confirmation)
// Body: { id: string, count?: number, expirationDate?: string, neplytvatConfirmed?: boolean }
export async function PATCH(request: NextRequest) {
  try {
    const data = await request.json();
    const { id, count, expirationDate, neplytvatConfirmed } = data;

    if (!id) {
      return NextResponse.json({ error: "Expiration ID required" }, { status: 400 });
    }

    const updateData: { count?: number; expirationDate?: Date; neplytvatConfirmed?: boolean } = {};
    if (expirationDate !== undefined) updateData.expirationDate = new Date(expirationDate);
    if (neplytvatConfirmed !== undefined) updateData.neplytvatConfirmed = neplytvatConfirmed;

    // Validate count doesn't exceed totalCount
    if (count !== undefined) {
      const existing = await prisma.expirationDate.findUnique({
        where: { id },
        include: { stockProduct: { include: { expirations: true } } },
      });
      if (existing) {
        const otherAssigned = existing.stockProduct.expirations
          .filter((e) => e.id !== id)
          .reduce((sum, e) => sum + e.count, 0);
        const maxAllowed = existing.stockProduct.totalCount - otherAssigned;
        updateData.count = Math.min(count, Math.max(maxAllowed, 0));
      } else {
        updateData.count = count;
      }
    }

    const expiration = await prisma.expirationDate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(expiration);
  } catch (error) {
    console.error("Expiration update error:", error);
    return NextResponse.json({ error: "Failed to update expiration" }, { status: 500 });
  }
}

// DELETE - Remove an expiration entry
// Body: { id: string }
export async function DELETE(request: NextRequest) {
  try {
    const data = await request.json();
    const { id } = data;

    if (!id) {
      return NextResponse.json({ error: "Expiration ID required" }, { status: 400 });
    }

    await prisma.expirationDate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Expiration delete error:", error);
    return NextResponse.json({ error: "Failed to delete expiration" }, { status: 500 });
  }
}
