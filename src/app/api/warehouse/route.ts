import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - list all shelves with boxes
export async function GET() {
  try {
    const shelves = await prisma.shelf.findMany({
      include: { boxes: true },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });
    return NextResponse.json(shelves);
  } catch (error) {
    console.error("Error fetching shelves:", error);
    return NextResponse.json({ error: "Failed to fetch shelves" }, { status: 500 });
  }
}

// POST - create shelf or deduct stock
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === "deduct") {
      // Deduct products from boxes (highest priority shelf first, earliest expiration first)
      const { items } = body; // [{productName, quantity}]
      const results: { productName: string; deducted: number; remaining: number }[] = [];

      for (const item of items) {
        let remaining = item.quantity;

        // Get all boxes with this product, ordered by shelf priority (desc) then expiration (asc, nulls last)
        const boxes = await prisma.shelfBox.findMany({
          where: { productName: item.productName, pieces: { gt: 0 } },
          include: { shelf: true },
          orderBy: [
            { shelf: { priority: "desc" } },
            { expirationDate: "asc" },
          ],
        });

        for (const box of boxes) {
          if (remaining <= 0) break;
          const deduct = Math.min(remaining, box.pieces);
          await prisma.shelfBox.update({
            where: { id: box.id },
            data: { pieces: box.pieces - deduct },
          });
          remaining -= deduct;
        }

        results.push({
          productName: item.productName,
          deducted: item.quantity - remaining,
          remaining,
        });
      }

      return NextResponse.json({ results });
    }

    // Create new shelf
    const { name, priority } = body;
    const shelf = await prisma.shelf.create({
      data: { name, priority: priority || 0 },
      include: { boxes: true },
    });
    return NextResponse.json(shelf);
  } catch (error) {
    console.error("Error creating shelf:", error);
    return NextResponse.json({ error: "Failed to create shelf" }, { status: 500 });
  }
}

// PUT - update shelf
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, priority } = body;

    const shelf = await prisma.shelf.update({
      where: { id },
      data: { name, priority },
      include: { boxes: true },
    });
    return NextResponse.json(shelf);
  } catch (error) {
    console.error("Error updating shelf:", error);
    return NextResponse.json({ error: "Failed to update shelf" }, { status: 500 });
  }
}

// DELETE - delete shelf
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.shelf.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shelf:", error);
    return NextResponse.json({ error: "Failed to delete shelf" }, { status: 500 });
  }
}
