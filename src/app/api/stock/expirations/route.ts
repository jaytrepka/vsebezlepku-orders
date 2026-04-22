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

    const expiration = await prisma.expirationDate.create({
      data: {
        stockProductId,
        expirationDate: new Date(expirationDate),
        count,
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
    if (count !== undefined) updateData.count = count;
    if (expirationDate !== undefined) updateData.expirationDate = new Date(expirationDate);
    if (neplytvatConfirmed !== undefined) updateData.neplytvatConfirmed = neplytvatConfirmed;

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
