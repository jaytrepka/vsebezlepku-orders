import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.max(1, Math.min(100, parseInt(searchParams.get("perPage") || "10", 10)));
    const month = searchParams.get("month"); // format: "2026-03" (YYYY-MM)
    const search = searchParams.get("search")?.trim();

    const where: { emailDate?: { gte: Date; lt: Date }; orderNumber?: { contains: string; mode: "insensitive" } } = {};
    if (month) {
      const [year, mon] = month.split("-").map(Number);
      if (year && mon) {
        const start = new Date(year, mon - 1, 1);
        const end = new Date(year, mon, 1);
        where.emailDate = { gte: start, lt: end };
      }
    }
    if (search) {
      where.orderNumber = { contains: search, mode: "insensitive" };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              label: true,
            },
          },
        },
        orderBy: { orderNumber: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({ orders, total, page, perPage });
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
