---
name: label-translator
description: >-
  Use this skill when translating and generating multilingual product labels (Czech, Polish, Slovak,
  Hungarian, Italian, English) for the vsebezlepku-orders label application, ensuring correct
  allergen bolding (**allergen**) and standardized nutrition formats.
---

# Label Translator for VšeBezLepku

This skill translates Czech food product labels into target languages (**HU**, **PL**, **SK**, **IT**, **EN**) matching the exact format used by the `vsebezlepku-orders` web app and PDF label generator (`src/lib/pdf.ts`).

## Database Model Format (Prisma `ProductLabel`)

Each label has the following fields:
```typescript
interface ProductLabelData {
  productName: string;      // Exact product name matching Shoptet / StockProduct
  language: "cs" | "pl" | "sk" | "hu" | "it" | "en";
  nazev: string;            // Short display title on label (e.g., "DÝŇOVÉ TORTELLONI (250g)")
  slozeni: string;          // Ingredients with allergens highlighted with **bold** markers
  nutricniHodnoty: string;  // Formatted nutrition string or key-value list
  skladovani?: string;      // Storage condition (e.g., "Skladujte v suchu a chladu.")
  vyrobce: string;          // Manufacturer name / importer info
}
```

---

## Language-Specific Standard Headers & Terms

### 1. Czech (`cs`)
- **Složení:** `Složení:`
- **Nutriční hodnoty:** `Nutriční hodnoty (100g): Energie: ... kJ / ... kcal, Tuky: ... g (z toho nasycené mastné kyseliny: ... g), Sacharidy: ... g (z toho cukry: ... g), Vláknina: ... g, Bílkoviny: ... g, Sůl: ... g`
- **Výrobce:** `Výrobce:`
- **Skladování:** `Uchovávejte na suchém a chladném místě.`

### 2. Polish (`pl`)
- **Složení:** `Składniki:`
- **Nutriční hodnoty:** `Wartości odżywcze (na 100 g): Wartość energetyczna: ... kJ / ... kcal, Tłuszcz: ... g (w tym kwasy tłuszczowe nasycone: ... g), Węglowodany: ... g (w tym cukry: ... g), Błonnik: ... g, Białko: ... g, Sól: ... g`
- **Výrobce:** `Producent:`
- **Skladování:** `Przechowywać w suchym i chłodnym miejscu.`

### 3. Slovak (`sk`)
- **Složení:** `Zloženie:`
- **Nutriční hodnoty:** `Nutričné hodnoty (na 100g): Energia: ... kJ / ... kcal, Tuky: ... g (z toho nasýtené mastné kyseliny: ... g), Sacharidy: ... g (z toho cukry: ... g), Vláknina: ... g, Bielkoviny: ... g, Soľ: ... g`
- **Výrobce:** `Výrobca:`
- **Skladování:** `Skladujte na suchom a chladnom mieste.`

### 4. Hungarian (`hu`)
- **Složení:** `Összetevők:`
- **Nutriční hodnoty:** `Tápérték (100g-ra vetítve): Energia: ... kJ / ... kcal, Zsír: ... g (amelyből telített zsírsavak: ... g), Szénhidrát: ... g (amelyből cukrok: ... g), Rost: ... g, Fehérje: ... g, Só: ... g`
- **Výrobce:** `Gyártó:`
- **Skladování:** `Száraz, hűvös helyen tárolandó.`

---

## Allergen Bolding Rules

All allergens (EU Regulation 1169/2011) **must** be enclosed in `**` in the `slozeni` text:
- **Cereals containing gluten (if trace):** `**pšenice**`, `**pszenica**`, `**búza**`
- **Eggs:** `**vejce**`, `**vaječný bílek**`, `**jaja**`, `**tojás**`, `**vajcia**`
- **Milk / Dairy:** `**mléko**`, `**smetana**`, `**syrovátka**`, `**mleko**`, `**śmietanka**`, `**tej**`, `**tejszín**`
- **Nuts:** `**mandle**`, `**lískové ořechy**`, `**migdały**`, `**orzechy**`, `**mandula**`, `**mogyoró**`
- **Soy:** `**sója**`, `**soja**`, `**szója**`
- **Lupin:** `**vlčí bob (lupina)**`, `**łubin**`, `**csillagfürt**`

---

## API Payload Example for Direct Import to App

To save into the LabelApp database via `POST /api/labels`:
```json
{
  "productName": "Piaceri Mediterranei TORTELLONI DÝŇOVÉ 250g (2 porce)",
  "language": "hu",
  "nazev": "SÜTŐTÖKÖS TORTELLONI (250g)",
  "slozeni": "Kukoricakeményítő, rizsliszt, **tojás** 15%, sütőtök 10%, ricotta (tejsavó, **tej**, **tejszín**, só, savanyúságot szabályozó anyag: citromsav), **tojásfehérje**, Grana Padano (**tej**, só, oltó, lizozim **tojásból**), dextróz, növényi rost (bambusz, psyllium, borsó), **tejszín**, burgonyapehely, só, tejsavó, extra szűz olívaolaj, aroma, sűrítőanyagok: xantángumi, guargumi.",
  "nutricniHodnoty": "Energia: 933 kJ / 222 kcal, Zsír: 6,7 g (amelyből telített zsírsavak: 3,7 g), Szénhidrát: 32,5 g (amelyből cukrok: 6,3 g), Rost: 4,2 g, Fehérje: 5,7 g, Só: 1,26 g",
  "skladovani": "Száraz, hűvös helyen tartandó.",
  "vyrobce": "Piaceri Mediterranei"
}
```
