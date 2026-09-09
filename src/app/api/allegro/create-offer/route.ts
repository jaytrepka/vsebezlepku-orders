import { NextRequest, NextResponse } from "next/server";
import { getAllegroAccessToken, createAllegroOffer } from "@/lib/allegro";
import { prisma } from "@/lib/prisma";

function extractFromHtml(html: string) {
  // 1. Extract Product Name
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const productName = h1Match ? h1Match[1].replace(/<[^>]+>/g, "").trim() : "";

  // 2. Extract Product Code / SKU
  const codeMatch = html.match(/(?:Kód produktu|Kód|Kód zboží|itemprop="sku")[^>]*>[\s\S]*?([A-Za-z0-9_-]+)/i)
    || html.match(/data-code="([^"]+)"/i)
    || html.match(/content="([^"]+)"\s+itemprop="sku"/i);
  const productCode = codeMatch ? codeMatch[1].trim() : "";

  // 3. Extract EAN
  const eanMatch = html.match(/itemprop="gtin13"[^>]*content="([^"]+)"/i)
    || html.match(/EAN:[^<]*<strong[^>]*>([^<]+)<\/strong>/i)
    || html.match(/EAN:[^<]*([0-9]{8,14})/i);
  const ean = eanMatch ? eanMatch[1].trim() : "";

  // 4. Extract Images
  const imageUrls: string[] = [];
  const imgRegex = /<a[^>]+href="([^"]+\.(?:jpg|jpeg|png|webp))"[^>]+data-gallery/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    if (!imageUrls.includes(match[1])) imageUrls.push(match[1]);
  }
  
  // Fallback images
  if (imageUrls.length === 0) {
    const ogImgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (ogImgMatch && !imageUrls.includes(ogImgMatch[1])) {
      imageUrls.push(ogImgMatch[1]);
    }
  }

  // 5. Extract Description
  const descMatch = html.match(/<div[^>]+id="description"[^>]*>([\s\S]*?)<\/div>/i)
    || html.match(/<div[^>]+class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const descriptionHtml = descMatch ? descMatch[1].trim() : "";

  return {
    productName,
    productCode,
    ean,
    imageUrls,
    descriptionHtml,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, pricePln, titlePl, descriptionHtml, categoryId, productCode: customCode, stock: customStock, imageUrls: customImages, ean: customEan, brand: customBrand, weightGrams: customWeight } = body;

    if (!pricePln || isNaN(parseFloat(pricePln))) {
      return NextResponse.json({ error: "Cena v PLN (pricePln) je povinná" }, { status: 400 });
    }

    const token = await getAllegroAccessToken();
    if (!token) {
      return NextResponse.json({ error: "Nepodařilo se získat Allegro token. Zkontrolujte autorizaci." }, { status: 400 });
    }

    let scrapedData: any = {};
    if (url) {
      try {
        const pageRes = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          scrapedData = extractFromHtml(html);
        }
      } catch (fetchErr) {
        console.warn("[CreateOffer] Could not scrape URL:", fetchErr);
      }
    }

    const finalProductCode = customCode || scrapedData.productCode || "";
    const finalTitle = titlePl || scrapedData.productName || "Bezglutenowy produkt";
    const finalImages = customImages && customImages.length > 0 ? customImages : (scrapedData.imageUrls || []);
    const finalDescription = descriptionHtml || scrapedData.descriptionHtml || `<p>${finalTitle}</p>`;
    const finalEan = customEan || scrapedData.ean || (finalProductCode === "S064" ? "8028169209531" : undefined);

    // Determine stock
    let stockCount = typeof customStock === "number" ? customStock : null;
    if (stockCount === null && finalProductCode) {
      const dbProduct = await prisma.stockProduct.findFirst({
        where: {
          OR: [
            { code: finalProductCode },
            ...(scrapedData.productName ? [{ productName: scrapedData.productName }] : []),
          ],
        },
        orderBy: { updatedAt: "desc" },
      });
      if (dbProduct) {
        stockCount = Math.max(0, dbProduct.totalCount - 2);
      }
    }
    if (stockCount === null) {
      stockCount = 5; // default fallback if stock not found in DB
    }

    const createResult = await createAllegroOffer(token, {
      titlePl: finalTitle,
      productCode: finalProductCode,
      pricePln: parseFloat(pricePln),
      stockCount,
      imageUrls: finalImages,
      descriptionHtml: finalDescription,
      categoryId: categoryId || "261420",
      ean: finalEan,
      brand: customBrand,
      weightGrams: customWeight,
    });

    if (!createResult.success) {
      return NextResponse.json({ error: createResult.error, debug: (createResult as any).debug }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      offerId: createResult.offerId,
      offerUrl: createResult.offerUrl,
      title: finalTitle,
      productCode: finalProductCode,
      pricePln: parseFloat(pricePln),
      stock: stockCount,
    });
  } catch (err) {
    console.error("[CreateOffer] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const pricePln = searchParams.get("pricePln");
  const titlePl = searchParams.get("titlePl") || undefined;
  const productCode = searchParams.get("productCode") || undefined;
  const stock = searchParams.get("stock") ? parseInt(searchParams.get("stock")!, 10) : undefined;

  if (!url || !pricePln) {
    return NextResponse.json({
      message: "Pro vytvoření nabídky zadejte ?url=...&pricePln=... (a volitelně &titlePl=...&productCode=...)",
    }, { status: 400 });
  }

  // Reuse POST logic
  const dummyRequest = new NextRequest(request.url, {
    method: "POST",
    body: JSON.stringify({ url, pricePln, titlePl, productCode, stock }),
  });
  return POST(dummyRequest);
}
