import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Returns distinct months (YYYY-MM) that have orders, sorted descending
export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      select: { emailDate: true },
      orderBy: { emailDate: "desc" },
    });

    const monthSet = new Set<string>();
    for (const o of orders) {
      const d = new Date(o.emailDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthSet.add(key);
    }

    return NextResponse.json([...monthSet].sort().reverse());
  } catch (error) {
    console.error("Months fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch months" }, { status: 500 });
  }
}
