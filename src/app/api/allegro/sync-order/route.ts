import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncOrderItemsToAllegro, getAllegroAccessToken, getAllegroAccessTokenWithDebug, getAllegroOfferIdByCode, updateAllegroOfferStock, activateAllegroOffer, closeAllegroOffer } from "@/lib/allegro";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get("orderNumber");

    let order;
    if (orderNumber) {
      order = await prisma.order.findUnique({
        where: { orderNumber },
        include: { items: true },
      });
    } else {
      // Find latest order
      order = await prisma.order.findFirst({
        orderBy: { createdAt: "desc" },
        include: { items: true },
      });
    }

    if (!order) {
      return NextResponse.json({ error: "Žádná objednávka nebyla nalezena" }, { status: 404 });
    }

    const authResult = await getAllegroAccessTokenWithDebug();
    if (!authResult.token) {
      return NextResponse.json({ 
        error: "Nepodařilo se získat Allegro token.",
        details: authResult.error,
        debug: authResult.debug,
      }, { status: 400 });
    }
    const token = authResult.token;

    const syncResults: Array<{
      productCode: string | null;
      productName: string;
      stockInDb: number;
      allegroStock: number;
      allegroOfferId: string | null;
      status: string;
    }> = [];

    for (const item of order.items) {
      const code = item.productCode?.trim() || null;
      
      const stockProduct = await prisma.stockProduct.findFirst({
        where: {
          OR: [
            ...(code ? [{ code }] : []),
            { productName: item.productName },
          ],
        },
      });

      const totalCount = stockProduct?.totalCount ?? 0;
      const allegroStock = Math.max(0, totalCount - 2);
      
      let offerId: string | null = null;
      let status = "skipped";

      if (code) {
        offerId = await getAllegroOfferIdByCode(token, code, item.productName);
      }

      if (offerId) {
        if (allegroStock > 0) {
          const okStock = await updateAllegroOfferStock(token, offerId, allegroStock);
          const okAct = await activateAllegroOffer(token, offerId);
          status = okStock ? `updated to ${allegroStock} pcs (active)` : "update_failed";
        } else {
          const ok = await closeAllegroOffer(token, offerId);
          status = ok ? "closed (0 pcs)" : "close_failed";
        }
      } else {
        status = "offer_not_found_on_allegro";
      }

      syncResults.push({
        productCode: code,
        productName: item.productName,
        stockInDb: totalCount,
        allegroStock,
        allegroOfferId: offerId,
        status,
      });
    }

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      emailDate: order.emailDate,
      totalItems: order.items.length,
      syncResults,
    });
  } catch (error) {
    console.error("[SyncOrder] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
