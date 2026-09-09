import { NextRequest, NextResponse } from "next/server";
import { getAllegroAccessToken } from "@/lib/allegro";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const offerId = searchParams.get("offerId") || "18624313638";

  const token = await getAllegroAccessToken();
  if (!token) {
    return NextResponse.json({ error: "No Allegro token" }, { status: 400 });
  }

  const userAgent = process.env.ALLEGRO_USER_AGENT || "VseBezLepku-Stock-Sync/1.0 (+https://vsebezlepku-orders.vercel.app)";

  const [productOfferRes, standardOfferRes] = await Promise.all([
    fetch(`https://api.allegro.pl/sale/product-offers/${offerId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "User-Agent": userAgent,
      },
    }),
    fetch(`https://api.allegro.pl/sale/offers/${offerId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "User-Agent": userAgent,
      },
    }),
  ]);

  const productOfferData = productOfferRes.ok ? await productOfferRes.json() : { status: productOfferRes.status, text: await productOfferRes.text() };
  const standardOfferData = standardOfferRes.ok ? await standardOfferRes.json() : { status: standardOfferRes.status, text: await standardOfferRes.text() };

  return NextResponse.json({
    offerId,
    productOfferData,
    standardOfferData,
  });
}
