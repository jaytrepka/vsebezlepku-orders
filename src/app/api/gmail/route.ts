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

    // Get existing order numbers to skip
    const existingOrders = await prisma.order.findMany({
      select: { orderNumber: true },
    });
    const existingOrderNumbers = existingOrders.map((o) => o.orderNumber);

    const orders = await fetchOrderEmails(gmail, daysBack, existingOrderNumbers);
    const debugSubjects = (fetchOrderEmails as any).debugSubjects || [];

    // Save orders to database
    let savedCount = 0;

    for (const order of orders) {
      // Get existing labels for product names
      const productNames = order.items.map((item) => item.productName);
      const existingLabels = await prisma.productLabel.findMany({
        where: { productName: { in: productNames } },
      });
      const labelMap = new Map(existingLabels.map((l) => [l.productName, l.id]));

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
              productUrl: item.productUrl,
              labelId: labelMap.get(item.productName) || null,
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
      skipped: existingOrderNumbers.length,
      debug: {
        daysBack,
        recentEmails: debugSubjects,
      }
    });
  } catch (error) {
    console.error("Gmail fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails", details: String(error) },
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
