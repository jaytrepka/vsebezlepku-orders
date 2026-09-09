---
name: shoptet-xml-generator
description: >-
  Use this skill when creating, formatting, or updating Shoptet XML product feeds (<SHOPITEM>)
  for vsebezlepku.cz, including HTML descriptions, allergen highlighting, nutritional tables,
  pricing (VAT 12%), categories, units, and logistic parameters.
---

# Shoptet XML Product Generator

This skill guides the automated and manual creation of valid Shoptet XML feed items (`<SHOPITEM>`) for vsebezlepku.cz.

## Standard Food Import Requirements for vsebezlepku.cz

1. **VAT Rate (`<VAT>`):** For food in the Czech Republic, always use `12` (12% VAT).
2. **Currency (`<CURRENCY>`):** `CZK`.
3. **Unit (`<UNIT>`):** `ks` (kusy).
4. **Unit of Measure (`<UNIT_OF_MEASURE>`):**
   - `<PACKAGE_AMOUNT>`: Weight in grams or volume in ml (e.g. `250`).
   - `<PACKAGE_AMOUNT_UNIT>`: `g` or `ml`.
   - `<MEASURE_AMOUNT>`: Standard comparison unit (usually `100`).
   - `<MEASURE_AMOUNT_UNIT>`: `g` or `ml`.
5. **Logistics (`<LOGISTIC>`):**
   - `<WEIGHT>`: Product weight in kg (e.g. `0.25` for 250g).
6. **Allergen Highlighting:**
   - In `<DESCRIPTION>`, all allergens must be wrapped in `<strong>` tags (e.g., `<strong>vejce</strong>`, `<strong>mléko</strong>`, `<strong>smetana</strong>`, `<strong>sója</strong>`).
7. **Nutritional Table:**
   - Standard HTML `<table>` under `<DESCRIPTION>` containing Energy (kJ/kcal), Fats, Saturated fatty acids, Carbohydrates, Sugars, Fiber, Proteins, Salt per 100g.

---

## Python Helper Script

You can run the generator script directly to produce valid XML:

```bash
python3 .agents/skills/shoptet-xml-generator/scripts/generate_shoptet_xml.py --help
```

### Example Usage:
```bash
python3 .agents/skills/shoptet-xml-generator/scripts/generate_shoptet_xml.py \
  --code "710" \
  --name "Piaceri Mediterranei TORTELLONI RICOTTA A ŠPENÁT 250g" \
  --manufacturer "Piaceri Mediterranei" \
  --price 139 \
  --purchase-price 90.64 \
  --weight 0.25 \
  --category-id "940" \
  --category-name "Těstoviny > Tortelloni a Tortellini" \
  --short-desc "Lahodné bezlepkové tortelloni plněné ricottou a špenátem." \
  --ingredients "Kukuřičný škrob, rýžová mouka, **vejce** 15 %, ricotta 12 % (**mléko**), špenát 8 %..." \
  --energy "920 kJ / 219 kcal" \
  --fat "6.2 g" --sat-fat "3.5 g" --carbs "33.0 g" --sugars "5.8 g" --fiber "4.0 g" --protein "5.5 g" --salt "1.20 g" \
  --image-url "https://cdn.myshoptet.com/usr/www.vsebezlepku.cz/user/shop/orig/710.png"
```

---

## XML Item Template Reference

See complete example in [sample_product.xml](./examples/sample_product.xml).
