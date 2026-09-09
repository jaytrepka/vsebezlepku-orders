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

/**
 * Activates / resumes an offer on Allegro when stock is positive (> 0)
 */
export async function activateAllegroOffer(token: string, offerId: string): Promise<boolean> {
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
  shippingRatesId?: string;
  returnPolicyId?: string;
  impliedWarrantyId?: string;
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

    const shippingRatesId = params.shippingRatesId || "6a22fcad-c8c1-495e-9c98-0b4b16853589";
    const returnPolicyId = params.returnPolicyId || "2bba241d-b306-42bb-a91a-a1353fc9e2c2";
    const impliedWarrantyId = params.impliedWarrantyId || "618157f7-2d10-4c6c-a976-79e3c39abe37";
    const categoryId = params.categoryId || "261420"; // Wyroby cukiernicze / ciastka / pieczywo

    // Clean description HTML
    const descriptionContent = params.descriptionHtml || `<p>${params.titlePl}</p>`;

    // Check if product exists in Allegro Catalog
    const catalogProductId = await searchAllegroCatalog(token, params.titlePl, params.ean);

    const productSet = catalogProductId
      ? [{ product: { id: catalogProductId } }]
      : [
          {
            product: {
              name: params.titlePl.substring(0, 75),
              category: { id: categoryId },
              images: uploadedImages.map((url) => ({ url })),
              parameters: [
                { id: "11323", values: ["Nowy"] }, // Stan: Nowy
                ...(params.ean ? [{ id: "225693", values: [params.ean] }] : []),
              ],
            },
          },
        ];

    const payload: any = {
      name: params.titlePl.substring(0, 75),
      productSet,
      category: { id: categoryId },
      images: uploadedImages.map((url) => ({ url })),
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
        marketplaces: {
          base: { id: "allegro-pl" },
        },
      },
      delivery: {
        shippingRates: { id: shippingRatesId },
        handlingTime: "PT24H",
      },
      afterSalesServices: {
        returnPolicy: { id: returnPolicyId },
        impliedWarranty: { id: impliedWarrantyId },
      },
      payments: {
        invoice: "VAT",
      },
      location: {
        countryCode: "CZ",
        postCode: "73991",
        city: "Bocanovice",
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

    const response = await fetch(`${ALLEGRO_API_URL}/sale/product-offers`, {
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
      const errText = await response.text();
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

