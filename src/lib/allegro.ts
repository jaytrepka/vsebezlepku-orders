import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getAllegroTokensFromDb, saveAllegroTokensToDb } from "@/lib/allegroTokenStorage";

const ALLEGRO_API_URL = "https://api.allegro.pl";
const ALLEGRO_AUTH_URL = "https://allegro.pl/auth/oauth/token";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/**
 * Gets a fresh or cached Allegro Access Token using PostgreSQL database or environment
 */
export async function getAllegroAccessToken(): Promise<string | null> {
  const res = await getAllegroAccessTokenWithDebug();
  return res.token;
}

export async function getAllegroAccessTokenWithDebug(): Promise<{ token: string | null; error?: string; debug?: any }> {
  const clientId = process.env.ALLEGRO_CLIENT_ID;
  const clientSecret = process.env.ALLEGRO_CLIENT_SECRET;
  const redirectUri = process.env.ALLEGRO_REDIRECT_URI || "https://vsebezlepku-orders.vercel.app/api/allegro/callback";
  const userAgent = process.env.ALLEGRO_USER_AGENT || "VseBezLepku-Stock-Sync/1.0 (+https://vsebezlepku-orders.vercel.app)";

  // 1. Check in-memory cache first
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 5 * 60 * 1000) {
    return { token: cachedAccessToken.token, debug: { source: "memory_cache" } };
  }

  // 2. Check PostgreSQL database for stored tokens
  const dbTokens = await getAllegroTokensFromDb();
  if (dbTokens && dbTokens.accessToken && dbTokens.expiresAt.getTime() > now + 5 * 60 * 1000) {
    cachedAccessToken = {
      token: dbTokens.accessToken,
      expiresAt: dbTokens.expiresAt.getTime(),
    };
    return { token: dbTokens.accessToken, debug: { source: "db_cache", expiresAt: dbTokens.expiresAt } };
  }

  // 3. Need to refresh token using DB refresh_token or env fallback
  const refreshTokenToUse = dbTokens?.refreshToken || process.env.ALLEGRO_REFRESH_TOKEN;

  const debug = {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasDbToken: !!dbTokens,
    hasRefreshToken: !!refreshTokenToUse,
    refreshTokenLength: refreshTokenToUse ? refreshTokenToUse.length : 0,
    redirectUri,
  };

  if (!clientId || !clientSecret || !refreshTokenToUse) {
    return {
      token: null,
      error: `Chybí autorizace Allegra. Otevřete prosím odkaz https://vsebezlepku-orders.vercel.app/api/allegro/auth pro jednorázovou autorizaci do databáze.`,
      debug,
    };
  }

  try {
    const basicAuth = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString("base64");

    const bodyParams = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshTokenToUse.trim(),
      redirect_uri: redirectUri,
    });

    const response = await fetch(ALLEGRO_AUTH_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "User-Agent": userAgent,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { token: null, error: `Allegro API vrátilo status ${response.status}: ${errorText}`, debug };
    }

    const data = await response.json();
    const expiresInMs = (data.expires_in || 43200) * 1000;

    // Save newly rotated tokens directly to PostgreSQL database!
    try {
      await saveAllegroTokensToDb(data.access_token, data.refresh_token, data.expires_in || 43200);
    } catch (dbSaveErr) {
      console.error("[Allegro] Error saving refreshed token to DB:", dbSaveErr);
    }

    cachedAccessToken = {
      token: data.access_token,
      expiresAt: now + expiresInMs,
    };

    return { token: data.access_token, debug: { source: "refreshed_and_saved_to_db" } };
  } catch (err) {
    return { token: null, error: `Výjimka při volání Allegro API: ${String(err)}`, debug };
  }
}



export interface AllegroOfferInfo {
  id: string;
  status?: string;
  stock?: number;
}

/**
 * Finds the Allegro Offer matching a Shoptet product code (SKU / external.id) or product name
 */
export async function getAllegroOfferDetails(token: string, productCode: string, productName?: string): Promise<AllegroOfferInfo | null> {
  const userAgent = process.env.ALLEGRO_USER_AGENT || "VseBezLepku-Stock-Sync/1.0 (+https://vsebezlepku-orders.vercel.app)";

  try {
    // 1. First attempt: search by external.id
    const response = await fetch(`${ALLEGRO_API_URL}/sale/offers?external.id=${encodeURIComponent(productCode)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "User-Agent": userAgent,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.offers && data.offers.length > 0) {
        return {
          id: data.offers[0].id,
          status: data.offers[0].publication?.status,
          stock: data.offers[0].stock?.available,
        };
      }
    }

    // 2. Second attempt: search by name matching the product code or name
    const nameToSearch = productName || productCode;
    const nameResponse = await fetch(`${ALLEGRO_API_URL}/sale/offers?name=${encodeURIComponent(nameToSearch)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "User-Agent": userAgent,
      },
    });

    if (nameResponse.ok) {
      const data = await nameResponse.json();
      if (data.offers && data.offers.length > 0) {
        return {
          id: data.offers[0].id,
          status: data.offers[0].publication?.status,
          stock: data.offers[0].stock?.available,
        };
      }
    }

    return null;
  } catch (err) {
    console.error(`[Allegro] Error looking up offer for code ${productCode}:`, err);
    return null;
  }
}

/**
 * Finds the Allegro Offer ID matching a Shoptet product code (SKU / external.id) or product name
 */
export async function getAllegroOfferIdByCode(token: string, productCode: string, productName?: string): Promise<string | null> {
  const details = await getAllegroOfferDetails(token, productCode, productName);
  return details ? details.id : null;
}

/**
 * Updates the stock quantity of an offer on Allegro
 */
export async function updateAllegroOfferStock(token: string, offerId: string, quantity: number): Promise<boolean> {
  const userAgent = process.env.ALLEGRO_USER_AGENT || "VseBezLepku-Stock-Sync/1.0 (+https://vsebezlepku-orders.vercel.app)";
  const commandId = crypto.randomUUID();

  try {
    const response = await fetch(`${ALLEGRO_API_URL}/sale/offer-quantity-change-commands/${commandId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "Content-Type": "application/vnd.allegro.public.v1+json",
        "User-Agent": userAgent,
      },
      body: JSON.stringify({
        modification: {
          changeType: "FIXED",
          value: quantity,
        },
        offerCriteria: [
          {
            type: "CONTAINS_OFFERS",
            offers: [{ id: offerId }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[Allegro] Failed to update stock for offer ${offerId}: ${response.status} - ${err}`);
      return false;
    }

    console.log(`[Allegro] ✅ Nastaven počet kusů pro nabídku ${offerId} na ${quantity} ks`);
    return true;
  } catch (err) {
    console.error(`[Allegro] Error updating stock for offer ${offerId}:`, err);
    return false;
  }
}

export async function updateAllegroProductOffer(
  token: string,
  offerId: string,
  updates: { stock?: number; status?: "ACTIVE" | "INACTIVE"; shippingRatesId?: string }
): Promise<boolean> {
  const userAgent = process.env.ALLEGRO_USER_AGENT || "VseBezLepku-Stock-Sync/1.0 (+https://vsebezlepku-orders.vercel.app)";

  try {
    const body: any = {};
    if (typeof updates.stock === "number") {
      body.stock = { available: updates.stock, unit: "UNIT" };
    }
    if (updates.status) {
      body.publication = { status: updates.status };
    }
    if (updates.shippingRatesId) {
      body.delivery = { shippingRates: { id: updates.shippingRatesId } };
    }

    const response = await fetch(`${ALLEGRO_API_URL}/sale/product-offers/${offerId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "Content-Type": "application/vnd.allegro.public.v1+json",
        "User-Agent": userAgent,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok && response.status !== 202) {
      const err = await response.text();
      console.error(`[Allegro] Failed to patch product-offer ${offerId}: ${response.status} - ${err}`);
      return false;
    }

    console.log(`[Allegro] ✅ Product-offer ${offerId} úspěšně aktualizován přes PATCH:`, updates);
    return true;
  } catch (err) {
    console.error(`[Allegro] Error patching product-offer ${offerId}:`, err);
    return false;
  }
}

/**
 * Activates / resumes an offer on Allegro when stock is positive (> 0)
 */
export async function activateAllegroOffer(token: string, offerId: string): Promise<boolean> {
  const patched = await updateAllegroProductOffer(token, offerId, { status: "ACTIVE" });
  if (patched) return true;

  const userAgent = process.env.ALLEGRO_USER_AGENT || "VseBezLepku-Stock-Sync/1.0 (+https://vsebezlepku-orders.vercel.app)";
  const commandId = crypto.randomUUID();

  try {
    const response = await fetch(`${ALLEGRO_API_URL}/sale/offer-publication-commands/${commandId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "Content-Type": "application/vnd.allegro.public.v1+json",
        "User-Agent": userAgent,
      },
      body: JSON.stringify({
        publication: { action: "ACTIVATE" },
        offerCriteria: [{ offers: [{ id: offerId }], type: "CONTAINS_OFFERS" }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[Allegro] Failed to activate offer ${offerId}: ${response.status} - ${err}`);
      return false;
    }

    console.log(`[Allegro] 🟢 Nabídka ${offerId} byla úspěšně aktivována / obnovena`);
    return true;
  } catch (err) {
    console.error(`[Allegro] Error activating offer ${offerId}:`, err);
    return false;
  }
}

/**
 * Ends / closes an offer on Allegro when stock reaches 0
 */
export async function closeAllegroOffer(token: string, offerId: string): Promise<boolean> {
  const userAgent = process.env.ALLEGRO_USER_AGENT || "VseBezLepku-Stock-Sync/1.0 (+https://vsebezlepku-orders.vercel.app)";
  const commandId = crypto.randomUUID();

  try {
    const response = await fetch(`${ALLEGRO_API_URL}/sale/offer-publication-commands/${commandId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "Content-Type": "application/vnd.allegro.public.v1+json",
        "User-Agent": userAgent,
      },
      body: JSON.stringify({
        publication: { action: "END" },
        offerCriteria: [{ offers: [{ id: offerId }], type: "CONTAINS_OFFERS" }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[Allegro] Failed to close offer ${offerId}: ${response.status} - ${err}`);
      return false;
    }

    console.log(`[Allegro] 🛑 Nabídka ${offerId} byla úspěšně ukončena (sklad <= 0)`);
    return true;
  } catch (err) {
    console.error(`[Allegro] Error closing offer ${offerId}:`, err);
    return false;
  }
}

/**
 * Automatically syncs only the specified ordered products to Allegro with a safety buffer of -2 pieces
 */
export async function syncOrderItemsToAllegro(items: { productCode?: string | null; productName?: string }[]): Promise<void> {
  const token = await getAllegroAccessToken();
  if (!token) return;

  const processedCodes = new Set<string>();

  for (const item of items) {
    const code = item.productCode?.trim();
    if (!code || processedCodes.has(code)) continue;
    processedCodes.add(code);

    try {
      // Find stock product in DB
      const stockProduct = await prisma.stockProduct.findFirst({
        where: {
          OR: [
            { code },
            { productName: item.productName },
          ],
        },
      });

      if (!stockProduct) {
        console.log(`[Allegro] Produkt s kódem ${code} nebyl nalezen v databázi skladu`);
        continue;
      }

      // Safety buffer (-2 pieces)
      const allegroStock = Math.max(0, stockProduct.totalCount - 2);

      const offerDetails = await getAllegroOfferDetails(token, code, item.productName);
      if (!offerDetails || !offerDetails.id) {
        console.log(`[Allegro] Nabídka pro kód ${code} nebyla na Allegru nalezena`);
        continue;
      }

      const offerId = offerDetails.id;

      if (allegroStock > 0) {
        await updateAllegroOfferStock(token, offerId, allegroStock);
        // Automatically activate / resume offer if it was inactive/ended or to ensure it is live
        await activateAllegroOffer(token, offerId);
      } else {
        await closeAllegroOffer(token, offerId);
      }
    } catch (itemErr) {
      console.error(`[Allegro] Chyba při synchronizaci položky ${code}:`, itemErr);
    }
  }
}

/**
 * Uploads an image by URL to Allegro's image hosting (https://upload.allegro.pl/sale/images)
 */
export async function uploadAllegroImage(token: string, imageUrl: string): Promise<string | null> {
  const userAgent = process.env.ALLEGRO_USER_AGENT || "VseBezLepku-Stock-Sync/1.0 (+https://vsebezlepku-orders.vercel.app)";

  try {
    const response = await fetch("https://upload.allegro.pl/sale/images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "Content-Type": "application/vnd.allegro.public.v1+json",
        "User-Agent": userAgent,
      },
      body: JSON.stringify({ url: imageUrl }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[Allegro] Failed to upload image ${imageUrl}: ${response.status} - ${err}`);
      return null;
    }

    const data = await response.json();
    return data.location || null;
  } catch (err) {
    console.error(`[Allegro] Error uploading image ${imageUrl}:`, err);
    return null;
  }
}

/**
 * Searches the Allegro Product Catalog by EAN or phrase
 */
export async function searchAllegroCatalog(token: string, phrase: string, ean?: string): Promise<string | null> {
  const userAgent = process.env.ALLEGRO_USER_AGENT || "VseBezLepku-Stock-Sync/1.0 (+https://vsebezlepku-orders.vercel.app)";

  try {
    if (ean && ean.trim().length >= 8) {
      const eanRes = await fetch(`${ALLEGRO_API_URL}/sale/products?ean=${encodeURIComponent(ean.trim())}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.allegro.public.v1+json",
          "User-Agent": userAgent,
        },
      });
      if (eanRes.ok) {
        const eanData = await eanRes.json();
        if (eanData.products && eanData.products.length > 0) {
          return eanData.products[0].id;
        }
      }
    }

    // Search by phrase
    const phraseRes = await fetch(`${ALLEGRO_API_URL}/sale/products?phrase=${encodeURIComponent(phrase)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "User-Agent": userAgent,
      },
    });
    if (phraseRes.ok) {
      const phraseData = await phraseRes.json();
      if (phraseData.products && phraseData.products.length > 0) {
        return phraseData.products[0].id;
      }
    }

    return null;
  } catch (err) {
    console.error("[Allegro] Error searching product catalog:", err);
    return null;
  }
}

export interface CreateAllegroOfferParams {
  titlePl: string;
  productCode: string;
  pricePln: number;
  stockCount: number;
  imageUrls: string[];
  descriptionHtml?: string;
  categoryId?: string;
  ean?: string;
  brand?: string;
  weightGrams?: string | number;
  shippingRatesId?: string;
  returnPolicyId?: string;
  impliedWarrantyId?: string;
}

export function sanitizeAllegroDescriptionHtml(rawHtml: string): string {
  if (!rawHtml) return "<p>Produkt bezglutenowy</p>";

  // 1. Pre-process common inline formatting
  let clean = rawHtml
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "<b>$1</b>")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "<b>$1</b>")
    .replace(/<b\s+[^>]*>/gi, "<b>")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, "<b>$1: </b>")
    .replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, " $1 ")
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n__H1__$1__H1__\n")
    .replace(/<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>/gi, "\n__H2__$1__H2__\n");

  // 2. Strip all other HTML tags except <b> and </b>
  clean = clean.replace(/<(?!\/?b\b)[^>]+>/gi, "");

  // 3. Decode common HTML entities
  clean = clean
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  // 4. Split by newlines, trim and rebuild clean HTML blocks
  const lines = clean
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const sections: string[] = [];
  for (const line of lines) {
    if (line.startsWith("__H1__") && line.endsWith("__H1__")) {
      const content = line.replace(/__H1__/g, "").replace(/<\/?b>/gi, "").trim();
      if (content) sections.push(`<h1>${content}</h1>`);
    } else if (line.startsWith("__H2__") && line.endsWith("__H2__")) {
      const content = line.replace(/__H2__/g, "").replace(/<\/?b>/gi, "").trim();
      if (content) sections.push(`<h2>${content}</h2>`);
    } else {
      let safeLine = line;
      // Remove multiple consecutive <b> or </b>
      safeLine = safeLine.replace(/(?:<b>\s*)+<b>/gi, "<b>");
      safeLine = safeLine.replace(/(?:<\/b>\s*)+<\/b>/gi, "</b>");
      // Remove empty <b></b>
      safeLine = safeLine.replace(/<b>\s*<\/b>/gi, "");

      // Fix any remaining nested or unbalanced <b> tags
      let inBold = false;
      let cleaned = "";
      const tokens = safeLine.split(/(<b>|<\/b>)/gi);
      for (const token of tokens) {
        if (token.toLowerCase() === "<b>") {
          if (!inBold) {
            cleaned += "<b>";
            inBold = true;
          }
        } else if (token.toLowerCase() === "</b>") {
          if (inBold) {
            cleaned += "</b>";
            inBold = false;
          }
        } else {
          cleaned += token;
        }
      }
      if (inBold) {
        cleaned += "</b>";
      }

      // Final check: don't output empty or punctuation-only lines
      const textOnly = cleaned.replace(/<\/?b>/gi, "").trim();
      if (textOnly.length > 0 && !/^[:\s\-\.]+$/.test(textOnly)) {
        sections.push(`<p>${cleaned}</p>`);
      }
    }
  }

  return sections.join("\n") || "<p>Produkt bezglutenowy</p>";
}

/**
 * Creates and lists a new offer on Allegro using POST /sale/product-offers
 */
export async function createAllegroOffer(token: string, params: CreateAllegroOfferParams): Promise<{ success: boolean; offerId?: string; offerUrl?: string; error?: string; debug?: any }> {
  const userAgent = process.env.ALLEGRO_USER_AGENT || "VseBezLepku-Stock-Sync/1.0 (+https://vsebezlepku-orders.vercel.app)";

  try {
    // 1. Upload images to Allegro image servers
    const uploadedImages: string[] = [];
    for (const imgUrl of params.imageUrls) {
      if (imgUrl.includes("allegroimg.com")) {
        uploadedImages.push(imgUrl);
      } else {
        const uploaded = await uploadAllegroImage(token, imgUrl);
        if (uploaded) uploadedImages.push(uploaded);
      }
    }

    const shippingRatesId = params.shippingRatesId || "6415265d-9c5a-4c2b-9fd5-59f64f402155"; // Cennik CZ-CZ
    const returnPolicyId = params.returnPolicyId || "2bba241d-b306-42bb-a91a-a1353fc9e2c2";
    const impliedWarrantyId = params.impliedWarrantyId || "618157f7-2d10-4c6c-a976-79e3c39abe37";
    const categoryId = params.categoryId || "261420"; // Wyroby cukiernicze / ciastka / pieczywo

    // Clean and sanitize description HTML to comply strictly with Allegro standards
    const descriptionContent = sanitizeAllegroDescriptionHtml(params.descriptionHtml || `<p>${params.titlePl}</p>`);

    // Check if product exists in Allegro Catalog
    const catalogProductId = await searchAllegroCatalog(token, params.titlePl, params.ean);

    // Extract weight in grams from title if not specified
    let weight = params.weightGrams ? String(params.weightGrams) : undefined;
    if (!weight) {
      const weightMatch = params.titlePl.match(/(\d+)\s*g\b/i);
      if (weightMatch) {
        weight = weightMatch[1];
      }
    }

    // Determine brand
    let brand = params.brand;
    let brandValueId: string | undefined = undefined;
    if (!brand) {
      if (/piaceri mediterranei/i.test(params.titlePl)) {
        brand = "Piaceri Mediterranei";
        brandValueId = "248811_1963110";
      } else if (/nutrifree/i.test(params.titlePl)) {
        brand = "Nutrifree";
      } else if (/schar|schär/i.test(params.titlePl)) {
        brand = "Schär";
      } else {
        brand = "Piaceri Mediterranei";
        brandValueId = "248811_1963110";
      }
    }

    const productParameters: any[] = [];
    if (params.ean) {
      productParameters.push({ id: "225693", values: [params.ean] });
    }
    if (brand) {
      productParameters.push({
        id: "248811",
        values: [brand],
        ...(brandValueId ? { valuesIds: [brandValueId] } : {}),
      });
    }
    if (weight) {
      productParameters.push({ id: "221929", values: [weight] });
    }
    productParameters.push({ id: "244509", values: [params.titlePl.substring(0, 75)] });

    // Category-specific required parameters
    if (categoryId === "261421") {
      // Pieczywo bezglutenowe -> Rodzaj (248580)
      let rodzajId = "248580_931707"; // inny
      let rodzajValue = "inny";
      if (/chleb|toast|toust/i.test(params.titlePl)) {
        rodzajId = "248580_931703"; // chleb
        rodzajValue = "chleb";
      } else if (/bułk|bulk|housk|baget|burger|hamburg|panini|ciabatt/i.test(params.titlePl)) {
        rodzajId = "248580_931704"; // bułka
        rodzajValue = "bułka";
      } else if (/tortill|wrap|piadin/i.test(params.titlePl)) {
        rodzajId = "248580_931705"; // tortilla
        rodzajValue = "tortilla";
      } else if (/rogalik|croissant/i.test(params.titlePl)) {
        rodzajId = "248580_931706"; // rogalik
        rodzajValue = "rogalik";
      }
      productParameters.push({
        id: "248580",
        valuesIds: [rodzajId],
        values: [rodzajValue],
      });
    } else if (categoryId === "261418") {
      // Mąki i mieszanki bezglutenowe -> Rodzaj (248572) & Pojemność (221905)
      productParameters.push({
        id: "248572",
        valuesIds: ["248572_930593"],
        values: ["inny"],
      });
      if (weight) {
        productParameters.push({ id: "221905", values: [weight] });
      }
    }

    const productSet = catalogProductId
      ? [{ product: { id: catalogProductId } }]
      : [
          {
            product: {
              name: params.titlePl.substring(0, 75),
              category: { id: categoryId },
              images: uploadedImages, // array of string URLs
              parameters: productParameters,
            },
          },
        ];

    const payload: any = {
      name: params.titlePl.substring(0, 75),
      productSet,
      category: { id: categoryId },
      parameters: [
        { id: "11323", valuesIds: ["11323_1"] }, // Stan: Nowy
      ],
      images: uploadedImages, // array of strings
      sellingMode: {
        format: "BUY_NOW",
        price: {
          amount: params.pricePln.toFixed(2),
          currency: "PLN",
        },
      },
      stock: {
        available: Math.max(0, params.stockCount),
        unit: "UNIT",
      },
      publication: {
        status: params.stockCount > 0 ? "ACTIVE" : "INACTIVE",
      },
      delivery: {
        shippingRates: { id: shippingRatesId },
        handlingTime: "PT0S",
      },
      afterSalesServices: {
        returnPolicy: { id: returnPolicyId },
        impliedWarranty: { id: impliedWarrantyId },
      },
      payments: {
        invoice: "NO_INVOICE",
      },
      location: {
        countryCode: "CZ",
        postCode: "25065",
        city: "Líbeznice",
      },
      description: {
        sections: [
          {
            items: [
              {
                type: "TEXT",
                content: descriptionContent,
              },
            ],
          },
        ],
      },
      external: {
        id: params.productCode,
      },
    };

    let response = await fetch(`${ALLEGRO_API_URL}/sale/product-offers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "Content-Type": "application/vnd.allegro.public.v1+json",
        "User-Agent": userAgent,
      },
      body: JSON.stringify(payload),
    });

    let errText = "";
    if (!response.ok && response.status !== 202 && response.status !== 201) {
      errText = await response.text();
      console.warn(`[Allegro] Initial offer creation returned status ${response.status}: ${errText}`);

      // Auto-healing for 422 errors (CATEGORY_MISMATCH, existing catalog product match, missing parameters, etc.)
      if (response.status === 422) {
        let shouldRetry = false;
        try {
          const errJson = JSON.parse(errText);
          const errors = errJson.errors || [];
          for (const errItem of errors) {
            const existingCatId = errItem.metadata?.existingCategoryId;
            const existingProdId = errItem.metadata?.existingProductId;
            const missingParamIds = errItem.metadata?.missingParameterIds ? String(errItem.metadata.missingParameterIds).split(",") : [];

            if (existingCatId || existingProdId) {
              if (existingCatId) {
                payload.category = { id: existingCatId };
                if (payload.productSet?.[0]?.product?.category) {
                  payload.productSet[0].product.category = { id: existingCatId };
                }
              }
              if (existingProdId) {
                payload.productSet = [{ product: { id: existingProdId } }];
              }
              shouldRetry = true;
            }

            if (missingParamIds.length > 0 && payload.productSet?.[0]?.product?.parameters) {
              for (const pId of missingParamIds) {
                const trimmedPId = pId.trim();
                const existingIndex = payload.productSet[0].product.parameters.findIndex((p: any) => p.id === trimmedPId);
                if (existingIndex === -1) {
                  if (trimmedPId === "248580") {
                    let rodzajId = "248580_931707";
                    let rodzajVal = "inny";
                    if (/chleb|toast|toust/i.test(params.titlePl)) {
                      rodzajId = "248580_931703";
                      rodzajVal = "chleb";
                    } else if (/bułk|bulk|housk|baget|burger|hamburg|panini|ciabatt/i.test(params.titlePl)) {
                      rodzajId = "248580_931704";
                      rodzajVal = "bułka";
                    }
                    payload.productSet[0].product.parameters.push({
                      id: "248580",
                      valuesIds: [rodzajId],
                      values: [rodzajVal],
                    });
                    shouldRetry = true;
                  } else if (trimmedPId === "248572") {
                    payload.productSet[0].product.parameters.push({
                      id: "248572",
                      valuesIds: ["248572_930593"],
                      values: ["inny"],
                    });
                    shouldRetry = true;
                  } else if (trimmedPId === "221929" && weight) {
                    payload.productSet[0].product.parameters.push({
                      id: "221929",
                      values: [weight],
                    });
                    shouldRetry = true;
                  } else if (trimmedPId === "221905" && weight) {
                    payload.productSet[0].product.parameters.push({
                      id: "221905",
                      values: [weight],
                    });
                    shouldRetry = true;
                  }
                }
              }
            }
          }
        } catch (parseErr) {
          console.error("[Allegro] Error parsing 422 JSON:", parseErr);
        }

        if (shouldRetry) {
          console.log(`[Allegro] 🔄 Auto-healing 422 error. Retrying offer creation with updated payload:`, {
            category: payload.category,
            productSet: payload.productSet,
          });

          response = await fetch(`${ALLEGRO_API_URL}/sale/product-offers`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.allegro.public.v1+json",
              "Content-Type": "application/vnd.allegro.public.v1+json",
              "User-Agent": userAgent,
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok && response.status !== 202 && response.status !== 201) {
            errText = await response.text();
          }
        }
      }
    }

    if (!response.ok && response.status !== 202 && response.status !== 201) {
      console.error(`[Allegro] Failed to create product-offer: ${response.status} - ${errText}`);
      return { 
        success: false, 
        error: `Allegro API vrátilo status ${response.status}: ${errText}`,
        debug: {
          endpoint: `${ALLEGRO_API_URL}/sale/product-offers`,
          status: response.status,
          catalogProductId,
          payloadSummary: {
            name: payload.name,
            productSet: payload.productSet,
            category: payload.category,
            imagesCount: payload.images?.length,
          }
        }
      };
    }

    const result = await response.json();
    const offerId = result.id;
    const offerUrl = `https://allegro.pl/oferta/${offerId}`;

    console.log(`[Allegro] ✅ Vytvořena nová nabídka ${offerId}: ${offerUrl}`);
    return { success: true, offerId, offerUrl };
  } catch (err) {
    console.error("[Allegro] Error creating offer:", err);
    return { success: false, error: String(err) };
  }
}

