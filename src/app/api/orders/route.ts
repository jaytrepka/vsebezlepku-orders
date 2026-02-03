import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            label: true,
          },
        },
      },
      orderBy: {
        emailDate: "desc",
      },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Orders fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { orderIds } = await request.json();

    if (!orderIds || !Array.isArray(orderIds)) {
      return NextResponse.json(
        { error: "Order IDs required" },
        { status: 400 }
      );
    }

    await prisma.order.deleteMany({
      where: {
        id: { in: orderIds },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Orders delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete orders" },
      { status: 500 }
    );
  }
}
