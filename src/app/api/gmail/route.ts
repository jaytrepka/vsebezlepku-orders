import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGmailClient, fetchOrderEmails } from "@/lib/gmail";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("gmail_access_token")?.value;
    const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

    if (!accessToken && !refreshToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { daysBack = 30 } = await request.json();

    const gmail = await getGmailClient({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const orders = await fetchOrderEmails(gmail, daysBack);

    // Save orders to database
    let savedCount = 0;
    let skippedCount = 0;

    for (const order of orders) {
      // Check if order already exists
      const existing = await prisma.order.findUnique({
        where: { orderNumber: order.orderNumber },
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      await prisma.order.create({
        data: {
          orderNumber: order.orderNumber,
          emailDate: order.emailDate,
          rawEmail: order.rawEmail,
          totalPrice: order.totalPrice,
          items: {
            create: order.items.map((item) => ({
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
      });
      savedCount++;
    }

    return NextResponse.json({
      success: true,
      found: orders.length,
      saved: savedCount,
      skipped: skippedCount,
    });
  } catch (error) {
    console.error("Gmail fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("gmail_access_token")?.value;
    const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

    return NextResponse.json({
      authenticated: !!(accessToken || refreshToken),
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
