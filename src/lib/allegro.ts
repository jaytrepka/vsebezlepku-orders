import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const ALLEGRO_API_URL = "https://api.allegro.pl";
const ALLEGRO_AUTH_URL = "https://allegro.pl/auth/oauth/token";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/**
 * Gets a fresh or cached Allegro Access Token using the OAuth Refresh Token
 */
export async function getAllegroAccessToken(): Promise<string | null> {
  const clientId = process.env.ALLEGRO_CLIENT_ID;
  const clientSecret = process.env.ALLEGRO_CLIENT_SECRET;
  const refreshToken = process.env.ALLEGRO_REFRESH_TOKEN;
  const userAgent = process.env.ALLEGRO_USER_AGENT || "VseBezLepku-Stock-Sync/1.0 (+https://vsebezlepku-orders.vercel.app)";

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn("[Allegro] Allegro credentials or ALLEGRO_REFRESH_TOKEN not configured. Skipping Allegro API sync.");
    return null;
  }

  // Use cached token if valid for at least 5 more minutes
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 5 * 60 * 1000) {
    return cachedAccessToken.token;
  }

  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch(`${ALLEGRO_AUTH_URL}?grant_type=refresh_token&refresh_token=${refreshToken}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "User-Agent": userAgent,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Allegro] Failed to refresh token:", errorText);
      return null;
    }

    const data = await response.json();
    const expiresInMs = (data.expires_in || 43200) * 1000;
    cachedAccessToken = {
      token: data.access_token,
      expiresAt: now + expiresInMs,
    };

    return data.access_token;
  } catch (err) {
    console.error("[Allegro] Token refresh exception:", err);
    return null;
  }
}

/**
 * Finds the Allegro Offer ID matching a Shoptet product code (SKU / external.id) or product name
 */
export async function getAllegroOfferIdByCode(token: string, productCode: string, productName?: string): Promise<string | null> {
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
        return data.offers[0].id;
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
        return data.offers[0].id;
      }
    }

    return null;
  } catch (err) {
    console.error(`[Allegro] Error looking up offer for code ${productCode}:`, err);
    return null;
  }
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
        offer: { id: offerId },
        modification: {
          changeType: "FIXED",
          value: quantity,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[Allegro] Failed to update stock for offer ${offerId}:`, err);
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
      console.error(`[Allegro] Failed to close offer ${offerId}:`, err);
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
 * Automatically syncs only the specified ordered products to Allegro with a safety buffer of -3 pieces
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

      const offerId = await getAllegroOfferIdByCode(token, code);
      if (!offerId) {
        console.log(`[Allegro] Nabídka pro kód ${code} nebyla na Allegru nalezena`);
        continue;
      }

      if (allegroStock > 0) {
        await updateAllegroOfferStock(token, offerId, allegroStock);
      } else {
        await closeAllegroOffer(token, offerId);
      }
    } catch (itemErr) {
      console.error(`[Allegro] Chyba při synchronizaci položky ${code}:`, itemErr);
    }
  }
}
