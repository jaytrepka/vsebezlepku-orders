import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST - add box to shelf
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shelfId, row, column, productName, pieces, expirationDate } = body;

    const box = await prisma.shelfBox.create({
      data: {
        shelfId,
        row,
        column,
        productName,
        pieces,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
      },
    });
    return NextResponse.json(box);
  } catch (error) {
    console.error("Error creating box:", error);
    return NextResponse.json({ error: "Failed to create box" }, { status: 500 });
  }
}

// PUT - update box
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, productName, pieces, expirationDate, row, column } = body;

    const data: Record<string, unknown> = {};
    if (productName !== undefined) data.productName = productName;
    if (pieces !== undefined) data.pieces = pieces;
    if (expirationDate !== undefined) data.expirationDate = expirationDate ? new Date(expirationDate) : null;
    if (row !== undefined) data.row = row;
    if (column !== undefined) data.column = column;

    const box = await prisma.shelfBox.update({
      where: { id },
      data,
    });
    return NextResponse.json(box);
  } catch (error) {
    console.error("Error updating box:", error);
    return NextResponse.json({ error: "Failed to update box" }, { status: 500 });
  }
}

// DELETE - delete box
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.shelfBox.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting box:", error);
    return NextResponse.json({ error: "Failed to delete box" }, { status: 500 });
  }
}
