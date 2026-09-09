# VšeBezLepku.cz – Kompletní Průvodce a Architektura Ekosystému

Dokumentace pro vývojáře, AI agenty a správce e-shopu **vsebezlepku.cz** (specializovaný internetový obchod s bezlepkovými potravinami).

---

## 1. O Projektu a Obchodní Model

### 1.1 Základní informace
- **Doména:** [vsebezlepku.cz](https://www.vsebezlepku.cz)
- **Zaměření:** Prémiové, bezpečné a certifikované bezlepkové potraviny (zejména italský import).
- **Počet produktů:** cca 150–200 aktivních položek.
- **Hlavní mise:** Přinášet celiakům a lidem na bezlepkové dietě kvalitní potraviny (těstoviny, plněné těstoviny, pečivo, mouky, sladkosti, polotovary), které chutnají jako tradiční italské jídlo a splňují nejpřísnější certifikace bezlepkovosti (AIC – Spiga Barrata, evropský přeškrtnutý klas).

### 1.2 Prodejní kanály
1. **E-shop vsebezlepku.cz** – Běžící na české e-commerce platformě **Shoptet.cz** (hlavní prodejní kanál pro CZ).
2. **Marketplace Allegro.pl** – Expanze na trhy:
   - 🇵🇱 Polsko (Allegro.pl)
   - 🇨🇿 Česká republika (Allegro.cz)
   - 🇸🇰 Slovensko (Allegro.sk)
   - 🇭🇺 Maďarsko (Allegro.hu)
   - *Poznámka:* Překlady na specifické trhy probíhají částečně přes Allegro / Base.com nebo manuálně.
3. **Předváděcí akce, trhy a bezlepkové veletrhy** – Prodej na stáncích s vlastním pokladním systémem (`/fair` v interní aplikaci).

### 1.3 Finanční a marketingové ukazatele
- **Měsíční hrubý zisk z prodeje:** cca **20 000 Kč** (před odečtením nákladů).
- **Měsíční náklady na Shoptet/Google kampaně:** cca **6 000 Kč**.
- **Další fixní náklady:** Shoptet měsíční tarif, Leadhub (e-mailing), domény, poplatky za platební brány a provize Allegro.
- **Cíl růstu:** Zvýšit průměrnou hodnotu objednávky (AOV), minimalizovat ztráty z expirací potravin, rozšířit sortiment a zvýšit čistý měsíční zisk.

---

## 2. Přehled Značek a Sortimentu

### 2.1 Klíčové italské značky (jádro nabídky)
- **Massimo Zero (MZ):**
  - Prémiový italský výrobce sušených bezlepkových těstovin.
  - Vyrábí se v italských Dolomitech z kukuřičné a rýžové mouky s čistou horskou vodou, tažené přes bronzové matrice (*trafilata al bronzo*).
  - Výjimečná struktura, která drží tvar při vaření (*al dente*) a skvěle váže omáčky.
- **Piaceri Mediterranei (PM):**
  - Širokosortimentní italská značka bezlepkových potravin.
  - Sortiment: Plněné chlazené i trvanlivé těstoviny (Tortelloni plněné dýní, ricottou, šunkou atd.), pečivo, sladkosti (piškoty Savoiardi, brownies, muffiny, donuty), směsi na pečení, mouky a snacky.

### 2.2 Značky ve výprodeji (Phase-out)
- **Glutiniente** – Doprodávají se skladové zásoby, značka nebude dále naskladňována.
- **Bauer** – Bujóny a dochucovadla, doprodávají se skladové zásoby, po doprodeji ukončení spolupráce.

### 2.3 Doporučené italské značky pro rozšíření sortimentu
Pro zvýšení pestrosti nabídky a přilákání nových zákazníků:
1. **Nutrifree** *(Itálie)* – Lídr v bezlepkovém pečivu (chleby, bagety, focaccia, piadine, strouhanka, kynuté koláče a směsi). Velmi žádané v CZ.
2. **Rummo Senza Glutine** *(Itálie)* – Ikonické italské těstoviny vyráběné patentovanou metodou *Lenta Lavorazione*, jedna z nejlépe hodnocených bezlepkových těstovin na světě.
3. **Felicia / Molino Andriani** *(Itálie)* – Těstoviny z luštěnin a alternativních obilovin (červená čočka, cizrna, pohanka, oves). Vhodné pro zdravou výživu a fitness.
4. **Caputo Fioreglut / Molino Rossetto** *(Itálie)* – Profesionální bezlepková mouka na pravou neapolskou pizzu a chleba. Zlatý standard mezi domácími i profi pizzaři.
5. **Matilde Vicenzi Senza Glutine** *(Itálie)* – Tradiční cukrářské piškoty Vicenzovo Savoiardi na bezlepkové tiramisu.
6. **Riccione Piadina Senza Glutine** *(Itálie)* – Autentické italské placky piadina bez lepku.
7. **Probios** *(Itálie)* – Bio a bezlepkové pomazánky, sušenky, snídaňové cereálie a italská pesta.

---

## 3. Technologická Architektura a Systémy

```
+-----------------------------------------------------------------------------------+
|                                EKOSYSTÉM VŠEBEZLEPKU                              |
+-----------------------------------------------------------------------------------+

       [ Google / Shoptet Ads ]               [ Leadhub ] (E-maily & kampaně)
                 │                                        ▲
                 ▼                                        │
     +──────────────────────+                     +──────────────────────+
     |     SHOPTET.CZ       |                     | VERCEL NEXT.JS APP   |
     |  (vsebezlepku.cz)    |                     | (vsebezlepku-orders) |
     +──────────────────────+                     +──────────────────────+
          │            ▲                              ▲            ▲
          │            │ (XML Importy)                │            │
          │            │                              │            │
          │     +───────────────+                     │            │
          │     | Tampermonkey  |─────────────────────+            │
          │     | Userscript 1  | (Import objednávek &             │
          │     | (Objednávky)  |  FIFO odpočet expirací)          │
          │     +───────────────+                                  │
          │                                                        │
          │     +───────────────+                                  │
          │     | Tampermonkey  |──────────────────────────────────+
          │     | Userscript 2  | (Sync skladových stavů)
          │     | (Sklad Sync)  |
          │     +───────────────+
          │            │
          │            ▼
          │     +───────────────────────────────+
          │     | Google Apps Script Web App    |
          │     | (Google Sheet – centrální     |
          │     |  stav skladových zásob)       |
          │     +───────────────────────────────+
          │                    │
          │                    ▼
          │             +───────────────+
          │             | Tampermonkey  |
          │             | Userscript 3  |
          │             | (Allegro Sync)|
          │             +───────────────+
          │                    │
          ▼                    ▼
     +──────────────────────────────────+
     |      ALLEGRO.PL MARKETPLACE      |
     |   (PL / CZ / SK / HU trhy)       |
     |   (Middleware: Base.com)         |
     +──────────────────────────────────+
```

---

## 4. Interní Aplikace: `vsebezlepku-orders`

Interní aplikace je vyvinuta v **Next.js 14 (App Router)** s **TypeScriptem**, **Tailwind CSS** a databází **PostgreSQL** přes **Prisma ORM**. Hostována je na platformě **Vercel**.

### 4.1 Hlavní moduly a funkcionality

#### 1. Správa a synchronizace objednávek (`/`, `/api/orders/shoptet`)
- Objednávky se nahrávají z administrace Shoptetu pomocí Tampermonkey skriptu (`shoptet-userscript.js`).
- Skript parsuje: číslo objednávky, datum, celkovou cenu a seznam položek (název, počet, jednotková cena, kód produktu, URL).
- **Automatický FIFO odpočet:** Při uložení nové objednávky aplikace automaticky sníží skladové zásoby u nejbližších expirujících šarží v tabulce `ExpirationDate` a odečte kusy z regálových boxů skladu.

#### 2. Tisk a generování štítků (`/labels`, `/api/labels/generate`, `src/lib/pdf.ts`)
- Generuje PDF se štítky ve formátu **A4 na šířku** (24 štítků na stránku = 8 sloupců × 3 řádky, rozměr 37 × 70 mm).
- Umožňuje nastavit **počáteční pozici** (1–24), aby se daly znovu použít částečně potištěné archy.
- **Multijazyčnost:** Podpora jazyků:
  - `cs` – Čeština
  - `pl` – Polština
  - `sk` – Slovenština
  - `hu` – Maďarština
- **Obsah štítku:**
  - Název produktu (např. *TORTELLONI DÝŇOVÉ (250g)*)
  - Složení (s automatickým zvýrazněním alergenů pomocí `**tučného písma**`)
  - Tabulka nutričních hodnot na 100g (Energie, Tuky, Nasycené MK, Sacharidy, Cukry, Vláknina, Bílkoviny, Sůl)
  - Podmínky skladování (volitelné)
  - Výrobce / dovozce
- **Příznaky štítků:**
  - `verified`: Zda je štítek zkontrolovaný a schválený.
  - `hasFactoryLabel`: Pokud má produkt originální štítek od výrobce a není potřeba tisknout český přelep.

#### 3. Predikce vyprodání zásob a sledování expirací (`/stock`, `/api/stock/predictions`)
Klíčový modul pro eliminaci plýtvání a finančních ztrát z prošlých potravin:
- **FIFO simulace dávek:** Každá šarže má své datum spotřeby a počet kusů. Algoritmus simuluje spotřebu v čase.
- **Dvě rychlosti prodeje (Velocity):**
  - **Celková rychlost (`overallVelocity`):** `celkem_prodáno / počet_dní_od_prvního_prodeje`
  - **Trendová rychlost (`trendingVelocity`):** Rychlost prodeje vypočtená z **posledních 5 nákupních událostí**.
- **Indikace rizika (`atRisk`):**
  - Pokud trendové (nebo celkové) datum doprodeje přesáhne nejbližší datum expirace, produkt se označí jako **At Risk** a aplikace spočítá odhadovaný počet neprodaných kusů (`unsoldCountTrending`).
- **Kategorie "Pomozte neplýtvat":**
  - Umožňuje označit šarže v blížící se expiraci k zlevnění v e-shopu (kampaň "Pomozte neplýtvat").

#### 4. Skladové lokace a regály (`/warehouse`)
- Hierarchie: Regál (`Shelf`) → Box v regálu (`ShelfBox` s určením patra, řady a sloupce).
- Sledování přesného umístění zboží ve fyzickém skladu pro rychlou expedici.

#### 5. Bestsellery a statistiky (`/bestsellers`)
- Analýza nejprodávanějších položek podle obratu a počtu kusů za zvolené období.

#### 6. Veletržní pokladna (`/fair`)
- Modul pro prodej na stáncích a bezlepkových festivalech.
- Umožňuje evidenci hotovostních a kartových nákupů, automatický odpočet z veletržního inventáře a export výsledků.

#### 7. Blacklist zákazníků (`/blacklist`)
- Evidence problémových zákazníků (např. opakované nepřebírání dobírek).

---

## 5. Integrační a Synchronizační Skripty (Tampermonkey)

### 5.1 `shoptet-userscript.js` (Objednávky do LabelApp)
- Běží na: `https://*.shoptet.cz/admin/prehled-objednavek/*`
- Tlačítko *"Add into LabelApp"* projde seznam objednávek a pošle nové objednávky na endpoint `/api/orders/shoptet`.

### 5.2 `shoptet-stock-sync.js` (Sklad ze Shoptetu)
- Běží na: `*://*.shoptet.cz/admin/sklad/*`
- Projde všechny stránky skladu v Shoptetu, posbírá kódy produktů a počty kusů a odešle je do Vercel aplikace (`/api/stock`) a Google Sheetu.

### 5.3 `allegro-sync-userscript.js` (Sklad na Allegro)
- Běží na: `https://salescenter.allegro.com/my-assortment*`
- Čte JSON feed z Google Apps Scriptu (kde je aktuální stav ze Shoptetu).
- Hledá shodu podle referenčního kódu produktu.
- **Bezpečnostní buffer:** Nastavuje počet kusů na Allegru jako `pocet_ze_shoptetu - 3` (případně -2), aby se zamezilo přeprodání zboží, které se mezitím prodá na Shoptetu.
- Pokud je výsledný počet `<= 0`, automaticky klikne na **"Ukončit nabídku"** (*Zakończ*).
- Pokud je počet `> 0`, otevře editaci kusů, zapíše novou hodnotu a uloží.

---

## 6. Shoptet XML Formát pro Import Produktů

Shoptet podporuje standardní XML feed pro hromadný import a aktualizaci produktů. 

### 6.1 Vzorová struktura `<SHOPITEM>`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<SHOP>
  <SHOPITEM id="709">
    <NAME>Piaceri Mediterranei TORTELLONI DÝŇOVÉ 250g (2 porce)</NAME>
    <GUID>be5452d2-373f-11f0-b061-46a7eb346db2</GUID>
    <CODE>709</CODE>
    <MANUFACTURER>Piaceri Mediterranei</MANUFACTURER>
    <SUPPLIER>Piaceri Mediterranei</SUPPLIER>
    <ITEM_TYPE>product</ITEM_TYPE>
    <ADULT>0</ADULT>
    <CURRENCY>CZK</CURRENCY>
    <VAT>12</VAT>
    <STANDARD_PRICE>139</STANDARD_PRICE>
    <PRICE_VAT>139</PRICE_VAT>
    <PURCHASE_PRICE>90.64</PURCHASE_PRICE>
    <UNIT>ks</UNIT>
    <LOGISTIC>
      <WEIGHT>0.25</WEIGHT>
    </LOGISTIC>
    <UNIT_OF_MEASURE>
      <PACKAGE_AMOUNT>250</PACKAGE_AMOUNT>
      <PACKAGE_AMOUNT_UNIT>g</PACKAGE_AMOUNT_UNIT>
      <MEASURE_AMOUNT>100</MEASURE_AMOUNT>
      <MEASURE_AMOUNT_UNIT>g</MEASURE_AMOUNT_UNIT>
    </UNIT_OF_MEASURE>
    <SHORT_DESCRIPTION><![CDATA[
      <p>Lahodné bezlepkové tortelloni plněné jemnou dýňovou náplní s ricottou a Grana Padano. Připravené bez palmového oleje, bez konzervantů a s vejci od slepic z volného chovu.</p>
    ]]></SHORT_DESCRIPTION>
    <DESCRIPTION><![CDATA[
      <p><strong>Tortelloni alla Zucca</strong> od <em>Piaceri Mediterranei</em> jsou výjimečné bezlepkové těstoviny...</p>
      <p><strong>Složení:</strong></p>
      <p>Kukuřičný škrob, rýžová mouka, <strong>vejce</strong> 15 %, dýně 10 %, ricotta (syrovátka, <strong>mléko</strong>, <strong>smetana</strong>, sůl, regulátor kyselosti: kyselina citronová)...</p>
      <p><strong>Nutriční hodnoty (na 100g):</strong></p>
      <table>
        <thead>
          <tr><th>Energetická hodnota</th><th>933 kJ / 222 kcal</th></tr>
        </thead>
        <tbody>
          <tr><td>Tuky</td><td>6,7 g</td></tr>
          <tr><td>z toho nasycené mastné kyseliny</td><td>3,7 g</td></tr>
          <tr><td>Sacharidy</td><td>32,5 g</td></tr>
          <tr><td>z toho cukry</td><td>6,3 g</td></tr>
          <tr><td>Vláknina</td><td>4,2 g</td></tr>
          <tr><td>Bílkoviny</td><td>5,7 g</td></tr>
          <tr><td>Sůl</td><td>1,26 g</td></tr>
        </tbody>
      </table>
    ]]></DESCRIPTION>
    <CATEGORIES>
      <CATEGORY id="940">Těstoviny &gt; Tortelloni a Tortellini</CATEGORY>
      <DEFAULT_CATEGORY id="940" google-id="434">Těstoviny &gt; Tortelloni a Tortellini</DEFAULT_CATEGORY>
    </CATEGORIES>
    <IMAGES>
      <IMAGE description="Tortelloni zucca">https://cdn.myshoptet.com/usr/www.vsebezlepku.cz/user/shop/orig/709_tortelloni-zucca-sito.png</IMAGE>
    </IMAGES>
    <FLAGS>
      <FLAG><CODE>action</CODE><ACTIVE>0</ACTIVE></FLAG>
      <FLAG><CODE>new</CODE><VALID_FROM>2025-05-22</VALID_FROM><VALID_UNTIL>2025-06-30</VALID_UNTIL></FLAG>
      <FLAG><CODE>tip</CODE><ACTIVE>0</ACTIVE></FLAG>
    </FLAGS>
    <STOCK>
      <AMOUNT>0</AMOUNT>
    </STOCK>
    <AVAILABILITY_IN_STOCK>Skladem</AVAILABILITY_IN_STOCK>
    <AVAILABILITY_OUT_OF_STOCK>Na dotaz</AVAILABILITY_OUT_OF_STOCK>
    <VISIBLE>1</VISIBLE>
    <HEUREKA_CATEGORY_ID>4360</HEUREKA_CATEGORY_ID>
    <ZBOZI_CATEGORY_ID>1573</ZBOZI_CATEGORY_ID>
    <GOOGLE_CATEGORY_ID>434</GOOGLE_CATEGORY_ID>
  </SHOPITEM>
</SHOP>
```

---

## 7. Strategie Růstu a Zvýšení Ziskovosti

### 7.1 Zvýšení průměrné hodnoty objednávky (AOV)
- **Degustační a tematické balíčky:**
  - *"Italský těstovinový balíček"* (výběr 5 nejoblíbenějších těstovin Massimo Zero + omáčka/bujón).
  - *"Víkendová bezlepková snídaně"* (Piaceri Mediterranei donuty, muffiny, sušenky).
  - *"Balíček pro nově diagnostikované celiaky"* (startovací sada základních trvanlivých potravin).
- **Dynamický ukazatel dopravy zdarma:** Shoptet banner v košíku *"Do dopravy zdarma vám zbývá jen 230 Kč"* – motivuje přihodit k objednávce 1-2 balení těstovin.

### 7.2 Optimalizace e-mailingu (Leadhub)
- **Automatizované scénáře:**
  - *Uvítací série pro nového zákazníka* (představení rodinného příběhu, bezpečnosti výroby, sleva 5 % na první nákup).
  - *Opuštěný košík s dynamickým zobrazením vložených produktů*.
  - *Pravidelná reaktivace (připomenutí doplnění zásob po 30 dnech)* – celiaci nakupují základní potraviny v pravidelných cyklech.
  - *Newsletter "Pomozte neplýtvat"* – speciální e-mail 1x za 2 týdny s produkty s blížící se expirací se slevou 20–50 %.

### 7.3 Expanze a B2B příležitosti
- **B2B prodej pro gastro provozy:**
  - Pizzerie, kavárny, hotely a bezlepkové pekárny v ČR často hledají certifikované bezlepkové suroviny (zejména velká balení mouk a těstovin).
- **Allegro optimalizace (PL, SK, HU):**
  - Využití Allegro Smart dopravy a optimalizace Allegro SEO parametrů pro zahraniční zákazníky.

---

## 8. Vytvořené Antigravity AI Dovednosti (Skills)

Pro automatizaci běžných operací a podporu AI agentů v tomto repozitáři byly vytvořeny následující specializované dovednosti:

1. **`shoptet-xml-generator`** (`.agents/skills/shoptet-xml-generator/SKILL.md`)
   - Generuje validní Shoptet importní XML feed položky pro nové produkty.
   - Správně formátuje HTML popisy, složení s alergeny a nutriční tabulku, DPH (12 %), logistiku a kategorie.

2. **`label-translator`** (`.agents/skills/label-translator/SKILL.md`)
   - Automaticky překládá české produktové štítky do maďarštiny (HU), polštiny (PL), slovenštiny (SK) a dalších jazyků.
   - Zachovává tučné formátování alergenů (`**bold**`) a normalizovanou strukturu pro aplikaci `vsebezlepku-orders`.

3. **`allegro-listing-assistant`** (`.agents/skills/allegro-listing-assistant/SKILL.md`)
   - Pomáhá s přípravou dat a zalistováním produktů ze Shoptetu na Allegro (PL, SK, HU).
   - Správně mapuje parametry, EAN, kategorie, překlady a bezpečnostní zásobu skladu (-3 ks).

4. **`leadhub-campaign-creator`** (`.agents/skills/leadhub-campaign-creator/SKILL.md`)
   - Tvoří prodejní a obsahové e-maily pro Leadhub (včetně předmětů, preheaderů, CTA tlačítek, receptů a akcí "Pomozte neplýtvat").

5. **`inventory-expiry-advisor`** (`.agents/skills/inventory-expiry-advisor/SKILL.md`)
   - Analyzuje skladové zásoby a data expirací, identifikuje rizikové šarže a navrhuje akční slevy a výprodejové strategie před expirací.

6. **`ecommerce-growth-strategist`** (`.agents/skills/ecommerce-growth-strategist/SKILL.md`)
   - Strategický poradce pro růst tržeb, AOV, akvizici nových zákazníků, výběr italských dodavatelů a ziskovost e-shopu.
