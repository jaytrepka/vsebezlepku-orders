---
name: allegro-listing-assistant
description: >-
  Use this skill when preparing, translating, parameterizing, or syncing product listings from
  Shoptet/XML to the Allegro marketplace (PL, CZ, SK, HU), using Base.com or Allegro REST API.
---

# Allegro Listing & Marketplace Assistant for VšeBezLepku

This skill guides the workflow for taking products from Shoptet / XML feed and listing them on **Allegro** across all target markets (Poland `PL`, Czech Republic `CZ`, Slovakia `SK`, and Hungary `HU`).

---

## 1. Multi-Market Strategy on Allegro
Allegro translates listings to foreign domains (`allegro.cz`, `allegro.sk`, `allegro.hu`) automatically if the base offer on `allegro.pl` is structured properly with correct EANs and parameters.

### Critical Offer Attributes for Allegro Food & Gluten-Free:
1. **Title (Polish / Pl):** Max 50–75 characters.
   - Formula: `[Marka] + [Nazwa Produktu] + [Bezglutenowe / Bez Glutenu] + [Gramatura / Waga]`
   - Example: `Piaceri Mediterranei Tortelloni Dyniowe Bezglutenowe 250g`
2. **EAN / GTIN:** Required for catalog matching (*Produktyzacja*).
3. **Kategoria (Category):**
   - *Supermarket > Produkty spożywcze > Makarony > Bezglutenowe*
   - *Supermarket > Produkty spożywcze > Pieczywo i wyroby cukiernicze*
4. **Cechy dodatkowe (Attributes):**
   - `Cechy dodatkowe`: `bezglutenowy` (crucial for filter visibility)
   - `Stan`: `Nowy`
   - `Waga netto`: e.g. `250 g`
   - `Kraj pochodzenia`: `Włochy` (Italy)

---

## 2. Base.com (BaseLinker) Workflow & Automation

### Current Manual Steps:
1. Export product from Shoptet / import via Base.com.
2. Select Allegro account.
3. Map category and fill missing parameters (EAN, weight).
4. Translate title and description to Polish.
5. Publish offer on Allegro.pl.

### How to Automate:
- **Base.com Automatic Actions:**
  - Set default parameters for brands `Piaceri Mediterranei` and `Massimo Zero` (Country of Origin: Italy, Diet: Bezglutenowa).
  - Use template tags in Base.com to auto-generate Polish titles.
- **Allegro REST API Alternative:**
  - Endpoints: `POST /sale/offers`, `PUT /sale/product-offers/{offerId}`
  - Auth: OAuth 2.0 Bearer token.
  - Can be scripted directly to read from Shoptet XML and publish to Allegro without Base.com manual clicking.

---

## 3. Stock Synchronization & Safety Buffer (-3 pieces)

### Current Architecture:
- `shoptet-stock-sync.js` (Tampermonkey) scrapes Shoptet stock -> Google Sheet (via Google Apps Script Web App).
- `allegro-sync-userscript.js` (Tampermonkey) on `salescenter.allegro.com/my-assortment` reads Google Sheet:
  - Calculation: `novyPocet = shoptetStock - 3` (safety buffer).
  - If `novyPocet <= 0`: Closes the offer (`close-offer-btn`).
  - If `novyPocet > 0`: Edits stock quantity input on Allegro and saves.

---

## Reference Manual

See detailed parameter mapping in [allegro_guidelines.md](./references/allegro_guidelines.md).
