import { NextRequest, NextResponse } from "next/server";
import { getAllegroAccessToken, getAllegroOfferIdByCode, updateAllegroOfferStock, activateAllegroOffer, closeAllegroOffer } from "@/lib/allegro";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") || "733";
  const dryRun = searchParams.get("dryRun") !== "false"; // default true unless ?dryRun=false

  const diagnostics: Record<string, any> = {
    code,
    dryRun,
    hasClientId: !!process.env.ALLEGRO_CLIENT_ID,
    hasClientSecret: !!process.env.ALLEGRO_CLIENT_SECRET,
    hasRefreshToken: !!process.env.ALLEGRO_REFRESH_TOKEN,
    userAgent: process.env.ALLEGRO_USER_AGENT,
  };

  try {
    // 1. Check token
    const token = await getAllegroAccessToken();
    diagnostics.tokenObtained = !!token;

    if (!token) {
      diagnostics.error = "Nepodařilo se získat přístupový token. Zkontrolujte, zda je nastaven ALLEGRO_REFRESH_TOKEN ve Vercel Environment Variables.";
      return NextResponse.json(diagnostics, { status: 400 });
    }

    // 2. Query Allegro offers directly
    const userAgent = process.env.ALLEGRO_USER_AGENT || "VseBezLepku-Stock-Sync/1.0 (+https://vsebezlepku-orders.vercel.app)";
    
    // Test A: By external.id
    const resA = await fetch(`https://api.allegro.pl/sale/offers?external.id=${encodeURIComponent(code)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "User-Agent": userAgent,
      },
    });
    diagnostics.externalIdSearchStatus = resA.status;
    const dataA = await resA.json();
    diagnostics.externalIdSearchResults = dataA;

    // Test C: In Product Catalog
    const phrase = searchParams.get("phrase") || code;
    const resC = await fetch(`https://api.allegro.pl/sale/products?phrase=${encodeURIComponent(phrase)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "User-Agent": userAgent,
      },
    });
    diagnostics.catalogSearchStatus = resC.status;
    const dataC = await resC.json();
    diagnostics.catalogSearchResults = dataC;

    // 3. Find stock in DB
    const stockProduct = await prisma.stockProduct.findFirst({
      where: { OR: [{ code }, { productName: { contains: code } }] },
    });
    diagnostics.dbStockProduct = stockProduct;

    if (stockProduct) {
      diagnostics.calculatedAllegroStock = Math.max(0, stockProduct.totalCount - 2);
    }

    const offerId = dataA.offers?.[0]?.id || dataB.offers?.[0]?.id;
    diagnostics.detectedOfferId = offerId;

    if (offerId && !dryRun && stockProduct) {
      const allegroStock = Math.max(0, stockProduct.totalCount - 2);
      if (allegroStock > 0) {
        diagnostics.updateSuccess = await updateAllegroOfferStock(token, offerId, allegroStock);
        diagnostics.activateSuccess = await activateAllegroOffer(token, offerId);
      } else {
        diagnostics.closeSuccess = await closeAllegroOffer(token, offerId);
      }
    }

    return NextResponse.json(diagnostics);
  } catch (err) {
    diagnostics.exception = String(err);
    return NextResponse.json(diagnostics, { status: 500 });
  }
}
