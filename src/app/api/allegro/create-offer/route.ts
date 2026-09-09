import { NextRequest, NextResponse } from "next/server";
import { getAllegroAccessToken, createAllegroOffer } from "@/lib/allegro";
import { prisma } from "@/lib/prisma";

export function detectAllegroCategory(url?: string, title?: string): string {
  const combined = `${url || ""} ${title || ""}`.toLowerCase();

  // 1. Bread, buns, baguettes, rolls, toast, panini, wraps -> Pieczywo bezglutenowe (261421)
  if (/chleb|baget|housk|pečiv|peciv|panini|ciabatt|burger|hamburg|toast|toust|bułk|bulk|wrap|tortill|piadin|focacc|korpus|hot dog|bulka|chleba/i.test(combined)) {
    return "261421"; // Pieczywo bezglutenowe
  }

  // 2. Pasta, noodles, spaghetti, gnocchi -> Makarony bezglutenowe (261419)
  if (/testovin|těstovin|makaron|spaghetti|penne|fusilli|tagliatelle|nudl|lasagn|farfalle|gnocchi|tortellin/i.test(combined)) {
    return "261419"; // Makarony bezglutenowe
  }

  // 3. Flours, mixes, breadcrumbs, premixes -> Mąki i mieszanki bezglutenowe (261418)
  if (/mouk|mąk|mak[ai]|směs|smes|mieszank|premix|strouhank|panierk|bułka tarta|krupic/i.test(combined)) {
    return "261418"; // Mąki i mieszanki bezglutenowe
  }

  // 4. Sweets, snacks, biscuits, cakes, cookies, wafers -> Słodycze i przekąski bezglutenowe (261420)
  if (/sladkost|sušenk|susenk|ciastk|herbatnik|wafl|baton|czekolad|čokolád|snack|chips|croissant|muffin|sfogli|pierniczk|perníčk|koláč|kolac|pernik|biscott/i.test(combined)) {
    return "261420"; // Słodycze i przekąski bezglutenowe
  }

  // 5. Flakes, cereals, muesli, porridge -> 261422 (Płatki, musli i kasze bezglutenowe)
  if (/vločk|vlock|płatk|platk|musli|muesli|granola|kaše|kase|kasz/i.test(combined)) {
    return "261422"; // Płatki, musli i kasze bezglutenowe
  }

  // Default fallback category (Słodycze i przekąski)
  return "261420";
}

function extractFromHtml(html: string) {
  // 1. Extract Product Name
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
  const dataLayerNameMatch = html.match(/"product":\s*\{[\s\S]*?"name":\s*"([^"]+)"/i);
  let productName = h1Match ? h1Match[1].replace(/<[^>]+>/g, "").trim() : "";
  if (!productName || productName === "-" || productName.length < 3) {
    productName = dataLayerNameMatch ? dataLayerNameMatch[1].trim() : (ogTitleMatch ? ogTitleMatch[1].trim() : "");
  }

  // 2. Extract Product Code / SKU
  const codeMatch = html.match(/"code":\s*"?([A-Za-z0-9_-]+)"?/i)
    || html.match(/data-code="([^"]+)"/i)
    || html.match(/itemprop="sku"[^>]*content="([^"]+)"/i)
    || html.match(/itemprop="sku"[^>]*>([^<]+)<\//i)
    || html.match(/<span[^>]*class="[^"]*(?:val-sku|p-code)[^"]*"[^>]*>([^<]+)<\//i)
    || html.match(/(?:Kód produktu|Kód zboží|Kód)[\s\S]*?<strong[^>]*>([^<]+)<\/strong>/i);
  const productCode = codeMatch && codeMatch[1].toLowerCase() !== "span" ? codeMatch[1].trim() : "";

  // 3. Extract EAN
  const eanMatch = html.match(/itemprop="gtin13"[^>]*content="([^"]+)"/i)
    || html.match(/itemprop="gtin13"[^>]*>([^<]+)<\//i)
    || html.match(/itemprop="gtin"[^>]*content="([^"]+)"/i)
    || html.match(/itemprop="gtin"[^>]*>([^<]+)<\//i)
    || html.match(/"gtin13":\s*"([0-9]{8,14})"/i)
    || html.match(/"gtin":\s*"([0-9]{8,14})"/i)
    || html.match(/"ean":\s*"([0-9]{8,14})"/i)
    || html.match(/data-ean="([0-9]{8,14})"/i)
    || html.match(/class="[^"]*(?:val-ean|p-ean)[^"]*"[^>]*>([0-9]{8,14})<\//i)
    || html.match(/(?:EAN|Kód EAN)[\s\S]*?<strong[^>]*>([0-9]{8,14})<\/strong>/i)
    || html.match(/(?:EAN|Kód EAN)[\s\S]*?<td[^>]*>([0-9]{8,14})<\/td>/i)
    || html.match(/EAN:[^0-9]*([0-9]{8,14})/i);
  const ean = eanMatch ? eanMatch[1].trim() : "";

  // 4. Extract Weight
  let weight = "";
  const weightMatch = html.match(/"weight":\s*([0-9.]+)/i);
  if (weightMatch) {
    const w = parseFloat(weightMatch[1]);
    if (w > 0) {
      weight = w < 5 ? String(Math.round(w * 1000)) : String(Math.round(w));
    }
  }
  if (!weight) {
    const textWeight = (productName + " " + html).match(/(\d+)\s*g\b/i);
    if (textWeight) {
      weight = textWeight[1];
    }
  }

  // 5. Extract Images
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

  // 6. Extract Description
  const descMatch = html.match(/<div[^>]+id="description"[^>]*>([\s\S]*?)<\/div>/i)
    || html.match(/<div[^>]+class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const descriptionHtml = descMatch ? descMatch[1].trim() : "";

  return {
    productName,
    productCode,
    ean,
    weight,
    imageUrls,
    descriptionHtml,
  };
}

function generateValidEan13(seedStr?: string): string {
  let prefix = "590";
  if (seedStr) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    const hashStr = String(hash).padStart(9, "0").slice(-9);
    prefix += hashStr;
  } else {
    prefix += String(Math.floor(100000000 + Math.random() * 900000000));
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(prefix[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return prefix + checkDigit;
}

const czToPlDictionary: Array<[RegExp, string]> = [
  // Core gluten-free terms
  [/\bbezlepkov[ýáé]\b/gi, "bezglutenowy"],
  [/\bbezlepkov[éí]\b/gi, "bezglutenowe"],
  [/\bbezlepkov[ého|ych|ymi]\b/gi, "bezglutenowych"],
  [/\bbez lepku\b/gi, "bez glutenu"],
  
  // Bakery & Bread
  [/\bhousky\b/gi, "bułki"],
  [/\bhouska\b/gi, "bułka"],
  [/\bchléb\b/gi, "chleb"],
  [/\bchleba\b/gi, "chleb"],
  [/\bbagel\b/gi, "bajgiel"],
  [/\bbagely\b/gi, "bajgle"],
  [/\bhamburgerové housky\b/gi, "bułki do hamburgerów"],
  [/\bhamburgerové\b/gi, "do hamburgerów"],
  [/\bhamburgerová\b/gi, "do hamburgera"],
  [/\blívance\b/gi, "racuchy"],
  [/\blívanec\b/gi, "racuch"],
  [/\bhotové lívance\b/gi, "gotowe racuchy"],
  [/\btěstoviny\b/gi, "makaron"],
  [/\btěstovina\b/gi, "makaron"],
  [/\bknedlíky\b/gi, "knedle"],
  [/\bkorpus\b/gi, "spód"],
  [/\brohlíky\b/gi, "rogaliki"],
  [/\brohlík\b/gi, "rogalik"],
  [/\bbagety\b/gi, "bagietki"],
  [/\bbageta\b/gi, "bagietka"],
  
  // Flour & Mixes
  [/\bsměs\b/gi, "mieszanka"],
  [/\bsměsi\b/gi, "mieszanki"],
  [/\bmouka\b/gi, "mąka"],
  [/\bmouky\b/gi, "mąki"],
  [/\bstrouhanka\b/gi, "bułka tarta"],
  [/\bkrupice\b/gi, "kasza manna"],
  [/\bškrob\b/gi, "skrobia"],
  
  // Sweets & Pastries
  [/\bsušenky\b/gi, "ciasteczka"],
  [/\bsušenka\b/gi, "ciastko"],
  [/\boplatky\b/gi, "wafle"],
  [/\boplatka\b/gi, "wafel"],
  [/\bkoláč\b/gi, "ciasto"],
  [/\bkoláčky\b/gi, "ciasteczka"],
  [/\bperníčky\b/gi, "pierniczki"],
  [/\bperníček\b/gi, "pierniczek"],
  [/\blinecké\b/gi, "kruche ciasteczka"],
  [/\bpiškoty\b/gi, "biszkopty"],
  [/\btyčinky\b/gi, "paluszki"],
  [/\btyčinka\b/gi, "baton"],
  [/\bbonbóny\b/gi, "cukierki"],
  [/\bželé\b/gi, "galaretka"],
  [/\bčokoláda\b/gi, "czekolada"],
  
  // Flavors / Colors
  [/\brůžové\b/gi, "różowe"],
  [/\brůžová\b/gi, "różowa"],
  [/\brůžový\b/gi, "różowy"],
  [/\bruzove\b/gi, "różowe"],
  [/\bruzova\b/gi, "różowa"],
  [/\bčokoládové\b/gi, "czekoladowe"],
  [/\bčokoládová\b/gi, "czekoladowa"],
  [/\bčokoládový\b/gi, "czekoladowy"],
  [/\bcokoladove\b/gi, "czekoladowe"],
  [/\bpistáciové\b/gi, "pistacjowe"],
  [/\bpistáciová\b/gi, "pistacjowa"],
  [/\bpistaciove\b/gi, "pistacjowe"],
  [/\boříškové\b/gi, "orzechowe"],
  [/\boříšková\b/gi, "orzechowa"],
  [/\boriskove\b/gi, "orzechowe"],
  [/\bbílé\b/gi, "białe"],
  [/\bbílá\b/gi, "biała"],
  [/\bbilá\b/gi, "biała"],
  [/\bjahodové\b/gi, "truskawkowe"],
  [/\bjahodovou\b/gi, "truskawkową"],
  [/\bvanilkové\b/gi, "waniliowe"],
  [/\bvanilkovou\b/gi, "waniliową"],
  [/\bmeruňkové\b/gi, "morelowe"],
  [/\bmeruňkovou\b/gi, "morelową"],
  [/\bkokosové\b/gi, "kokosowe"],
  [/\bkokosovou\b/gi, "kokosową"],
  [/\bslané\b/gi, "solone"],
  [/\bsladké\b/gi, "słodkie"],
  
  // Units & Package
  [/\bvánoční perníčky\b/gi, "świąteczne pierniczki"],
  [/\bvánoční\b/gi, "świąteczne"],
  [/\bks\b/gi, "szt."],
  [/\bkusy\b/gi, "sztuki"],
  [/\bkusů\b/gi, "sztuk"],
  [/\bkus\b/gi, "szt."],
  [/\bporce\b/gi, "porcje"],
  [/\bbalení\b/gi, "opakowanie"],
  [/\bs polevou\b/gi, "z polewą"],
  [/\bs posypem\b/gi, "z posypką"],
  [/\bs náplní\b/gi, "z nadzieniem"],
  [/\bs kousky\b/gi, "z kawałkami"],
  [/\bkřehké\b/gi, "kruche"],
  [/\blahodné\b/gi, "pyszne"],
  [/\bjemné\b/gi, "delikatne"],
  [/\btrvanlivé pečivo\b/gi, "wyroby cukiernicze"],
  
  // Headings & Nutrition labels
  [/\bSložení\b/gi, "Składniki"],
  [/\bVýživové údaje na 100\s*g\b/gi, "Wartości odżywcze w 100g"],
  [/\bNutriční hodnoty \(na 100\s*g\)\b/gi, "Wartości odżywcze w 100g"],
  [/\bNutriční hodnoty\b/gi, "Wartości odżywcze"],
  [/\bVýživové údaje\b/gi, "Wartości odżywcze"],
  [/\bEnergetická hodnota\b/gi, "Wartość energetyczna"],
  [/\bTuky\b/gi, "Tłuszcze"],
  [/\bz toho nasycené mastné kyseliny\b/gi, "w tym kwasy tłuszczowe nasycone"],
  [/\bSacharidy\b/gi, "Węglowodany"],
  [/\bz toho cukry\b/gi, "w tym cukry"],
  [/\bVláknina\b/gi, "Błonnik"],
  [/\bBílkoviny\b/gi, "Białko"],
  [/\bSůl\b/gi, "Sól"],
  [/\bSkladujte v suchu a chladu\b/gi, "Przechowywać w suchym i chłodnym miejscu"],
  [/\bSkladování\b/gi, "Przechowywanie"],
  [/\bZemě původu\b/gi, "Kraj pochodzenia"],
  [/\bMinimální trvanlivost do\b/gi, "Najlepiej spożyć przed"],
  [/\bVyrobeno v\b/gi, "Wyprodukowano w"],
  [/\bVýrobce\b/gi, "Producent"],
  [/\bMůže obsahovat stopy\b/gi, "Może zawierać śladowe ilości"],
  [/\bMůže obsahovat\b/gi, "Może zawierać"],
  [/\bVhodné pro celiaky\b/gi, "Odpowiedni dla osób z celiakią"],
  [/\bCeliakie\b/gi, "Celiakia"],
];

function applyPolishGlossary(text: string): string {
  let res = text;
  for (const [regex, replacement] of czToPlDictionary) {
    res = res.replace(regex, replacement);
  }
  return res;
}

async function translateChunk(text: string): Promise<string> {
  if (!text || !text.trim()) return "";
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=cs|pl`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (
        data.responseData &&
        data.responseData.translatedText &&
        !data.responseData.translatedText.includes("QUERY LENGTH LIMIT EXCEEDED")
      ) {
        return applyPolishGlossary(data.responseData.translatedText);
      }
    }
  } catch (e) {
    console.warn("[AllegroTranslate] MyMemory error, using fallback glossary:", e);
  }
  return applyPolishGlossary(text);
}

export async function translateTextToPolish(text: string): Promise<string> {
  if (!text || !text.trim()) return "";
  
  if (text.length <= 300) {
    return translateChunk(text);
  }

  const parts = text.split(/(?<=[.,;:])\s+/);
  const translatedParts: string[] = [];
  let currentBatch = "";

  for (const part of parts) {
    if ((currentBatch + " " + part).length < 250) {
      currentBatch = currentBatch ? currentBatch + " " + part : part;
    } else {
      if (currentBatch) {
        translatedParts.push(await translateChunk(currentBatch));
      }
      currentBatch = part;
    }
  }
  if (currentBatch) {
    translatedParts.push(await translateChunk(currentBatch));
  }

  return translatedParts.join(" ");
}

export async function translateTitleToPolish(rawTitle: string): Promise<string> {
  if (!rawTitle) return "Produkt bezglutenowy";

  let clean = rawTitle
    .replace(/\s*-\s*Pomozte nepl[ýy]tvat\s*/gi, "")
    .replace(/\s*-\s*Pomoze nepl[ýy]tvat\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const translated = await translateChunk(clean);

  let finalTitle = translated.trim();
  if (finalTitle.length > 75) {
    finalTitle = finalTitle.substring(0, 75);
    const lastSpace = finalTitle.lastIndexOf(" ");
    if (lastSpace > 50) {
      finalTitle = finalTitle.substring(0, lastSpace);
    }
  }

  return finalTitle;
}

export async function translateHtmlDescriptionToPolish(rawHtml: string, fallbackTitlePl: string): Promise<string> {
  if (!rawHtml || rawHtml.trim().length === 0) {
    return `<h2>${fallbackTitlePl}</h2>\n<p>Wysokiej jakości produkt bezglutenowy.</p>`;
  }

  // 1. Extract ingredients section if present
  let ingredients = "";
  const ingMatch = rawHtml.match(/(?:Složení|Složení:)([\s\S]*?)(?:Nutriční|Výživové|Výživové údaje|Skladování|Výrobce|<table|$)/i);
  if (ingMatch) {
    ingredients = ingMatch[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // 2. Extract nutrition table or text
  let nutrition = "";
  const nutMatch = rawHtml.match(/(?:Nutriční|Výživové|Výživové údaje)[\s\S]*?(?:<\/table>|<div class="clear"|$)/i);
  if (nutMatch) {
    const rawNut = nutMatch[0];
    const rows = [...rawNut.matchAll(/<tr[^>]*>[\s\S]*?<t[hd][^>]*>([\s\S]*?)<\/t[hd]>[\s\S]*?<t[hd][^>]*>([\s\S]*?)<\/t[hd]>[\s\S]*?<\/tr>/gi)];
    if (rows.length > 0) {
      const items = rows.map((r) => {
        const key = r[1].replace(/<[^>]+>/g, "").replace(/[:\s]+$/, "").trim();
        const val = r[2].replace(/<[^>]+>/g, "").trim();
        return `${key}: ${val}`;
      }).filter((it) => it.length > 3);
      nutrition = items.join(", ");
    }
  }

  // 3. Extract storage if present
  let storage = "";
  const storageMatch = rawHtml.match(/(?:Skladujte|Skladování:?)([\s\S]*?)(?:Výrobce|Země původu|$)/i);
  if (storageMatch) {
    storage = storageMatch[0].replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  }

  // 4. Extract intro lines (before Složení / Nutriční)
  const beforeSections = rawHtml.split(/(?:Složení|Nutriční|Výživové|Výrobce|<table)/i)[0];
  const cleanBefore = beforeSections
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "$1")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ");

  const introLines = cleanBefore
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 10 && !/^(Složení|Nutriční|Výživové)/i.test(l));

  const sections: string[] = [];
  sections.push(`<h2>${fallbackTitlePl}</h2>`);

  // Translate intro lines
  for (const line of introLines) {
    const trLine = await translateTextToPolish(line);
    if (trLine && trLine.length > 5) {
      sections.push(`<p>${trLine}</p>`);
    }
  }

  // Translate and add Ingredients
  if (ingredients) {
    const trIngredients = await translateTextToPolish(ingredients);
    sections.push(`<p><b>Składniki:</b> ${trIngredients}</p>`);
  }

  // Translate and add Nutrition
  if (nutrition) {
    const trNutrition = await translateTextToPolish(nutrition);
    sections.push(`<p><b>Wartości odżywcze w 100g:</b> ${trNutrition}</p>`);
  }

  // Translate and add Storage
  if (storage) {
    const trStorage = await translateTextToPolish(storage);
    sections.push(`<p><b>Przechowywanie:</b> ${trStorage}</p>`);
  } else {
    sections.push(`<p><b>Przechowywanie:</b> Przechowywać w suchym i chłodnym miejscu.</p>`);
  }

  // Producer
  sections.push(`<p><b>Producent:</b> Piaceri Mediterranei – Włochy</p>`);

  return sections.join("\n");
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
    const finalImages = customImages && customImages.length > 0 ? customImages : (scrapedData.imageUrls || []);

    // 1. Check if database has a Polish label for this product
    let dbLabelPl: any = null;
    if (finalProductCode || scrapedData.productName) {
      try {
        dbLabelPl = await prisma.productLabel.findFirst({
          where: {
            language: "pl",
            OR: [
              ...(finalProductCode ? [{ productName: finalProductCode }] : []),
              ...(scrapedData.productName ? [
                { productName: scrapedData.productName },
              ] : []),
            ],
          },
        });
      } catch (dbErr) {
        console.warn("[CreateOffer] Could not check DB for PL label:", dbErr);
      }
    }

    // 2. Determine final Polish title
    let finalTitle = titlePl;
    if (!finalTitle || finalTitle.trim().length < 3 || /^-+$/.test(finalTitle.trim())) {
      if (dbLabelPl?.nazev && dbLabelPl.nazev.trim().length > 3 && !/^-+$/.test(dbLabelPl.nazev.trim())) {
        finalTitle = dbLabelPl.nazev;
      } else {
        const rawTitle = scrapedData.productName || "Bezglutenowy produkt";
        finalTitle = await translateTitleToPolish(rawTitle);
      }
    }
    finalTitle = finalTitle.replace(/\s+/g, " ").trim().replace(/,\s*$/, "");
    if (!finalTitle || finalTitle.length < 3 || /^-+$/.test(finalTitle)) {
      finalTitle = "Piaceri Mediterranei produkt bezglutenowy";
    }

    // 3. Determine final Polish description HTML
    let finalDescription = descriptionHtml;
    if (!finalDescription) {
      if (dbLabelPl && dbLabelPl.slozeni) {
        finalDescription = `
          <h2>${finalTitle}</h2>
          <p><b>Składniki:</b> ${dbLabelPl.slozeni}</p>
          <p><b>Wartości odżywcze:</b> ${dbLabelPl.nutricniHodnoty || "Patrz opakowanie"}</p>
          <p><b>Przechowywanie:</b> ${dbLabelPl.skladovani || "Przechowywać w suchym i chłodnym miejscu."}</p>
          <p><b>Producent:</b> ${dbLabelPl.vyrobce || "Piaceri Mediterranei – Włochy"}</p>
        `.trim();
      } else if (scrapedData.descriptionHtml) {
        finalDescription = await translateHtmlDescriptionToPolish(scrapedData.descriptionHtml, finalTitle);
      } else {
        finalDescription = `<h2>${finalTitle}</h2>\n<p>Wysokiej jakości produkt bezglutenowy.</p>`;
      }
    }

    // 4. Determine EAN
    let finalEan = customEan || scrapedData.ean;
    if (!finalEan) {
      const urlSlug = url ? url.split("/").filter(Boolean).pop() || "" : "";
      const textToMatch = `${finalProductCode} ${urlSlug} ${scrapedData.productName || ""} ${finalTitle || ""}`.toLowerCase();

      if (finalProductCode === "D187" || /livance|pancake/i.test(textToMatch)) finalEan = "8028169206189";
      else if (finalProductCode === "D186" || finalProductCode === "1043" || /donut.*(ruzov|pink|różow)/i.test(textToMatch)) finalEan = "8028169207254";
      else if (finalProductCode === "D136" || /donut.*(pistac)/i.test(textToMatch)) finalEan = "8028169207261";
      else if (/donut.*(bil|white|biał)/i.test(textToMatch)) finalEan = "8028169207230";
      else if (/donut.*(orisk|hazelnut|orzech)/i.test(textToMatch)) finalEan = "8028169207247";
      else if (finalProductCode === "S064" || /lineck/i.test(textToMatch)) finalEan = "8028169209531";
      else if (finalProductCode === "S063" || /pernick|pan-di-zenzero|piernicz/i.test(textToMatch)) finalEan = "8028169209395";
      else if (finalProductCode === "781" || /hamburger/i.test(textToMatch)) finalEan = "8028169209210";
      else if (/bagel|bajgiel/i.test(textToMatch)) finalEan = "8028169209234";
      else if (/piadin/i.test(textToMatch)) finalEan = "8028169209241";
      else if (/ciabatt/i.test(textToMatch)) finalEan = "8028169209227";
      else if (/baget|bagiet/i.test(urlSlug) || /baget|bagiet/i.test(scrapedData.productName || "")) finalEan = "8028169209203";
      else if (/pan-carre|toust|toast/i.test(textToMatch)) finalEan = "8028169209197";
      else if (/farfalle/i.test(textToMatch)) finalEan = "8028169002019";
      else if (/bbq/i.test(textToMatch)) finalEan = "8028169002231";
      else {
        finalEan = generateValidEan13(finalProductCode || url || finalTitle);
      }
    }

    const finalCategoryId = categoryId || detectAllegroCategory(url, finalTitle);
    const finalWeight = customWeight || scrapedData.weight || undefined;

    // 5. Determine stock
    let stockCount = typeof customStock === "number" ? customStock : null;
    if (stockCount === null && finalProductCode) {
      try {
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
      } catch (stockErr) {
        console.warn("[CreateOffer] Could not fetch stock from DB:", stockErr);
      }
    }
    if (stockCount === null) {
      stockCount = 5;
    }

    const createResult = await createAllegroOffer(token, {
      titlePl: finalTitle,
      productCode: finalProductCode,
      pricePln: parseFloat(pricePln),
      stockCount,
      imageUrls: finalImages,
      descriptionHtml: finalDescription,
      categoryId: finalCategoryId,
      ean: finalEan,
      brand: customBrand,
      weightGrams: finalWeight,
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
      ean: finalEan,
      category: finalCategoryId,
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
  const ean = searchParams.get("ean") || undefined;
  const brand = searchParams.get("brand") || undefined;
  const weightGrams = searchParams.get("weightGrams") || undefined;
  const categoryId = searchParams.get("categoryId") || undefined;

  if (!url || !pricePln) {
    return NextResponse.json({
      message: "Pro vytvoření nabídky zadejte ?url=...&pricePln=... (a volitelně &titlePl=...&productCode=...&ean=...)",
    }, { status: 400 });
  }

  // Reuse POST logic
  const dummyRequest = new NextRequest(request.url, {
    method: "POST",
    body: JSON.stringify({ url, pricePln, titlePl, productCode, stock, ean, brand, weightGrams, categoryId }),
  });
  return POST(dummyRequest);
}
