import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - list fairs or get specific fair with products & transactions
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fairId = searchParams.get("id");

  try {
    if (fairId) {
      const fair = await prisma.fair.findUnique({
        where: { id: fairId },
        include: {
          products: { orderBy: { sortOrder: "asc" } },
          transactions: {
            include: { items: true },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      return NextResponse.json(fair);
    }

    const fairs = await prisma.fair.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, active: true, createdAt: true },
    });
    return NextResponse.json(fairs);
  } catch (error) {
    console.error("Fair GET error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// POST - create fair, add product, or record transaction
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Create new fair
    if (data.action === "create-fair") {
      const fair = await prisma.fair.create({
        data: { name: data.name },
      });
      return NextResponse.json(fair);
    }

    // Add product to fair
    if (data.action === "add-product") {
      // Set sortOrder to be after existing products
      const maxOrder = await prisma.fairProduct.aggregate({
        where: { fairId: data.fairId },
        _max: { sortOrder: true },
      });
      const product = await prisma.fairProduct.create({
        data: {
          fairId: data.fairId,
          productName: data.productName,
          price: data.price,
          totalCount: data.totalCount,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });
      return NextResponse.json(product);
    }

    // Record transaction (zaplaceno)
    if (data.action === "transaction") {
      const { fairId, items } = data;
      // items: [{fairProductId, quantity, unitPrice}]

      const totalPrice = items.reduce(
        (sum: number, item: { quantity: number; unitPrice: number }) =>
          sum + item.quantity * item.unitPrice,
        0
      );

      const transaction = await prisma.fairTransaction.create({
        data: {
          fairId,
          totalPrice,
          items: {
            create: items.map((item: { fairProductId: string; quantity: number; unitPrice: number }) => ({
              fairProductId: item.fairProductId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
      });

      // Decrease remaining counts
      for (const item of items) {
        await prisma.fairProduct.update({
          where: { id: item.fairProductId },
          data: { soldCount: { increment: item.quantity } },
        });
      }

      return NextResponse.json(transaction);
    }

    // Reorder products
    if (data.action === "reorder") {
      const { orders } = data; // [{id, sortOrder}]
      for (const item of orders) {
        await prisma.fairProduct.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Fair POST error:", error);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}

// PUT - update product
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const product = await prisma.fairProduct.update({
      where: { id: data.id },
      data: {
        productName: data.productName,
        price: data.price,
        totalCount: data.totalCount,
      },
    });
    return NextResponse.json(product);
  } catch (error) {
    console.error("Fair PUT error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// DELETE - delete product
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "productId required" }, { status: 400 });
    }
    await prisma.fairProduct.delete({ where: { id: productId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fair DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
