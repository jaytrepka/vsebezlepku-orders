---
name: allegro-listing-assistant
description: >-
  Use this skill when preparing, translating, parameterizing, listing, or syncing product listings from
  vsebezlepku.cz URLs or Shoptet XML to the Allegro marketplace (PL, CZ, SK, HU) using Allegro REST API.
---

# Allegro Listing & Marketplace Assistant for VšeBezLepku

This skill provides an automated workflow to list new gluten-free products directly onto **Allegro.pl** (with multi-market sync to `allegro.cz`, `allegro.sk`, and `allegro.hu`) given only a **product URL from `vsebezlepku.cz`** and a **price in PLN**.

---

## 1. 1-Step Automated Listing Workflow

When the user asks to list a product by providing a **`vsebezlepku.cz` URL** and a **price in PLN**:

### Step 1: Fetch & Inspect Product Page
Use `read_url_content` on the provided `vsebezlepku.cz` URL to extract:
1. **Product Name** (Czech, e.g. *Piaceri Mediterranei bezlepkové CROSTATINE MERUŇKOVÉ 200g*)
2. **Product Code / SKU** (e.g. `BM06`, `733`, `D186`)
3. **EAN / Barcode** (from schema.org / meta / description)
4. **Product Images** (full-res image URLs)
5. **Net Weight / Gramáž** (e.g. `200g`, `400g`)
6. **Ingredients & Allergens** (Czech text)
7. **Nutrition Facts** (Energetická hodnota, tuky, sacharidy, bílkoviny, sůl na 100g)
8. **Brand** (e.g. `Piaceri Mediterranei`, `Massimo Zero`, `Nutrifree`, `Rummo`, `Caputo`)

---

### Step 2: Generate Optimized Polish Listing Content

#### A. Polish Title (Max 75 characters, SEO-optimized):
Formula: `[Marka] + [Nazwa Produktu po polsku] + [Bezglutenowe / Bez Glutenu] + [Waga]`
*Examples:*
- `Piaceri Mediterranei KOSZYCZKI Z MORELAMI Bezglutenowe 200g`
- `Massimo Zero MAKARON FARFALLE Bezglutenowy Włoski 400g`
- `Piaceri Mediterranei DONUTY PISTACJOWE Bezglutenowe 90g`

#### B. Allegro Category Selection:
- **`261420`**: Wyroby cukiernicze, ciastka, muffinki, donuty, babeczki, słodkie wypieki
- **`260950`**: Makarony bezglutenowe, tortellini, gnocchi
- **`260947`**: Mąki i mieszanki bezglutenowe do chleba/pizzy
- **`261418`**: Przekąski, krakersy, paluszki chlebowe

#### C. Polish Description HTML (`description.sections`):
Structure:
1. **Nagłówek marketingowy** (włoska jakość, 100% bez glutenu, certyfikowane).
2. **Składniki (Ingredients)**: Czech ingredients translated into natural Polish with **bolded allergens** (np. `mąka kukurydziana, cukier, **jaja**, masło (**mleko**)...`).
3. **Wartości odżywcze w 100g**: Clean tabular or bulleted nutritional data.
4. **Warunki przechowywania**: Przechowywać w suchym i chłodnym miejscu.

---

### Step 3: Publish Offer via API

Post the prepared payload to the listing endpoint:
**`POST https://vsebezlepku-orders.vercel.app/api/allegro/create-offer`**

```json
{
  "url": "https://www.vsebezlepku.cz/...",
  "pricePln": 24.99,
  "titlePl": "Piaceri Mediterranei KOSZYCZKI Z MORELAMI Bezglutenowe 200g",
  "productCode": "BM06",
  "categoryId": "261420",
  "descriptionHtml": "<p>...</p>"
}
```

The endpoint automatically:
1. Uploads high-res product photos to Allegro CDN (`https://upload.allegro.pl/sale/images`).
2. Automatically assigns default templates & parameters:
   - **Cennik dostawy**: `6415265d-9c5a-4c2b-9fd5-59f64f402155` (CZ-CZ)
   - **Warunki zwrotów**: `2bba241d-b306-42bb-a91a-a1353fc9e2c2`
   - **Reklamacje**: `618157f7-2d10-4c6c-a976-79e3c39abe37`
   - **Lokalizacja**: Líbeznice, 25065, CZ
   - **Płatności**: `NO_INVOICE`
   - **Wymagane parametry produktu**: Marka (`248811`), Waga (`221929`), Nazwa handlowa (`244509`), EAN (`225693`), Stan: Nowy (`11323`)
3. Calculates stock buffer (`sklad - 2` from PostgreSQL DB).
4. Creates and activates the offer via Allegro REST API (`POST /sale/product-offers`), returning the live offer link:
   `https://allegro.pl/oferta/{offerId}`.

---

## 2. Multi-Market Sync (CZ, SK, HU)
Once published on `allegro.pl`, Allegro automatically handles catalog matching (*Produktyzacja*) and translates to `allegro.cz`, `allegro.sk`, and `allegro.hu` using the linked EAN and Polish base offer.

---

## 3. Stock Buffer Rule
- Initial stock on Allegro is strictly **`sklad - 2`**.
- If DB stock is $\le 2$, the offer is created with `stock: 0` and kept in `INACTIVE` state until new stock arrives.
