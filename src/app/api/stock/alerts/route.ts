import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Count of unconfirmed expiration entries that are ≤1 month away
export async function GET() {
  try {
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

    const count = await prisma.expirationDate.count({
      where: {
        expirationDate: { lte: oneMonthFromNow },
        neplytvatConfirmed: false,
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Alerts fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}
