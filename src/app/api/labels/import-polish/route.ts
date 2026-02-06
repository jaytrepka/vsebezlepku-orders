import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DOC_URL_HTML = "https://docs.google.com/document/d/1WeddfeCuDqLcauAVxWjVO99iu_2t32riFLzr1gajrkE/export?format=html";
const DOC_URL_TXT = "https://docs.google.com/document/d/1WeddfeCuDqLcauAVxWjVO99iu_2t32riFLzr1gajrkE/export?format=txt";

interface ParsedPolishLabel {
  code: string;
  polishName: string;
  skladniki: string;
  wartosciOdzywcze: string;
  producent: string;
}

// Direct mapping from Polish product names to Czech productName in database
// Only products that exist in the database with verified names
const polishToCzechMap: Record<string, string> = {
  // Verified matches - Czech labels exist in DB
  "ZBOŻOWE KULKI MIODOWE 300g": "CEREÁLIE MEDOVÉ KROUŽKY 300g",
  "CZEKOLADOWE SERCA BATTITI 200g": "Piaceri Mediterranei ČOKOLÁDOVÁ SRDÍČKA BATTITI 200g",
  "CANTUCCI 200g": "CANTUCCI 200g",
  "MUFFINY Z NADZIENIEM OWOCOWYM 200g": "Piaceri Mediterranei bezlepkové MUFFINY S OVOCNOU NÁPLNÍ 200g (4ks)",
  "BEZGLUTENOWE CRACKERS": "CRACKERS TRADICIONALES 200g",
  "DONUTY PISTACJOWE (90g)": "Piaceri Mediterranei bezlepkové DONUTY PISTÁCIOVÉ 90g",
  "DONUTY PISTACJOWE 90g": "DONUTY PISTÁCIOVÉ 90g",
  "WAFLE PISTACJOWE 150g": "PISTÁCIOVÉ OPLATKY 150g",
  "ATTIMI bezglutenowe ciasteczka orzechowe 120g": "ATTIMI KŘEHKÉ LÍSKOOŘÍŠKOVÉ KOLÁČKY 120g",
  "SFOGLIATINE z polewą morelową 150g": "SFOGLIATINE KŘEHKÉ SUŠENKY S MERUŇKOVOU GLAZUROU 150g",
  "RUSTYKALNY BEZGLUTENOWY CHLEB KROJONY (300g)": "Piaceri Mediterranei RUSTIKÁLNÍ BEZLEPKOVÝ KRÁJENÝ CHLÉB (300g)",
  "WRAP PEŁNOZIARNISTY 180 g (3 szt.)": "Piaceri Mediterranei bezlepkový WRAP 180g (3ks)",
  "DONUTY BIAŁE 90 g": "Piaceri Mediterranei DONUTY BÍLÉ 90g",
  "DONUTY ORZECHOWE 90 g": "Piaceri Mediterranei DONUTY OŘÍŠKOVÉ 90g",
  "CROSTATINE MORELOWE 200 g": "Piaceri Mediterranei CROSTATINE MERUŇKOVÉ 200g",
  "CROSTATINE Z OWOCAMI LEŚNYMI": "Piaceri Mediterranei bezlepkové CROSTATINE S LESNÍM OVOCEM 200g",
  "GOLOMIX Ciasteczka kakaowe z gwiazdkami 200g": "Piaceri Mediterranei GOLOMIX KAKAOVÉ SUŠENKY s hvězdičkami 200g",
  "COUS COUS 375g": "COUS COUS kukuřičný 375g",
  "BROWNIES 200g": "BROWNIES 200g",
  // Tortellini/Tortelloni
  "TORTELLINI PROSCIUTTO CRUDO 250g": "Piaceri Mediterranei TORTELLINI PROSCIUTTO CRUDO 250g (2 porce)",
  "TORTELLINI Z MIESEM 250 g (2 porcje)": "Piaceri Mediterranei TORTELLINI S MASEM 250g (2 porce)",
  "Tortelloni z ricottą i szpinakiem 250 g (2 porcje)": "Piaceri Mediterranei TORTELLONI S RICOTTOU A ŠPENÁTEM 250g (2 porce)",
  // Snacks
  "SFIZI BBQ CHRUPKI 100g": "Piaceri Mediterranei SFIZI BBQ KŘUPKY 100g",
  "BRUSCHETTINE z papryką i chili 100g": "BRUSCHETTINE s paprikou a chilli 100g",
  "BRUSCHETTINE Mediterranee 100g": "BRUSCHETTINE Mediterranee 100g",
  // Pasta
  "CANNELLONI": "CANNELLONI",
  // Wafers
  "WAFLE o smaku waniliowym 45g": "Piaceri Mediterranei OPLATKY S VANILKOVOU PŘÍCHUTÍ 45g",
  "WAFLE o smaku ORZECHÓW LASKOWYCH 45g": "Piaceri Mediterranei OPLATKY S LÍSKOOŘÍŠKOVOU PŘÍCHUTÍ 45g",
  // Sweets
  "CIOCOPUNTA CHOCOLATE MINICORNETS 108g (6szt)": "CIOCOPUNTA ČOKOLÁDOVÉ MINIKORNOUTKY 108g",
  "CIOCOPUNTA PISTACHIO MINICORNETS 108g (6szt)": "Piaceri Mediterranei CIOCOPUNTA PISTÁCIOVÉ MINIKORNOUTKY 108g (6ks)",
  "PIACERINI DUNE WHITE 33g": "Piaceri Mediterranei PIACERINI TYČINKA DUNE WHITE 33g",
  "GRISSINI CAŁE BATONY ZIARNISTE 160G": "Piaceri Mediterranei GRISSINI TYČINKY 160g",
  // Bread
  "PAN BAULETTO 300g": "PAN BAULETTO 300g",
  "PANE CON NOCI 150g": "PANE CON NOCI 150g",
  // Cereals
  "CEREALE KOLOROWE KÓŁKA 300g": "CEREÁLIE DUHOVÉ KROUŽKY 300g",
  "CEREALE QUADROTTI DARK 300g": "CEREÁLIE QUADROTTI DARK 300g",
  // Additional pastries
  "CROISSANT PUSTY 150g": "CROISSANT PRÁZDNÝ 150g",
  "CROISSANT CZEKOLADOWY 200g": "CROISSANT ČOKOLÁDOVÝ 200g",
  "CROISSANT MORELOWY 200g": "CROISSANT MERUŇKOVÝ 200g",
  // Muffins
  "MUFFIN Z KAWAŁKAMI CZEKOLADY 200g": "MUFFIN S ČOKOLÁDOVÝMI KOUSKY 200g",
  "MUFFIN Z KAWAŁKAMI CZEKOLADY 50g": "MUFFIN S ČOKOLÁDOVÝMI KOUSKY 50g",
  // Pasta simple
  "LASAGNE 250g": "LASAGNE 250g",
  "FUSILLI 400g": "FUSILLI 400g",
  "SPAGHETTI 400g": "SPAGHETTI 400g",
  "PENNE RIGATE 400g": "PENNE RIGATE 400g",
  "TAGLIATELLE 250g": "TAGLIATELLE 250g",
  // Cookies/Biscuits
  "BISCOTTI PETIT 200g": "SUŠENKY BISCOTTI PETIT 200g",
  "PAVONETTI 140g": "PAVONETTI - bezlepkové křehké sušenky 140g",
  "VENTAGLIETTI 140g": "VENTAGLIETTI - bezlepkové křehké vějířky 140g",
  // Cereals bars
  "BATONIKI ZBOŻOWE ŻURAWINOWE 129g": "Piaceri Mediterranei CEREÁLNÍ TYČINKY S BRUSINKAMI 129g (6ks)",
  "BATONIKI ZBOŻOWE CZEKOLADOWE 129g": "Piaceri Mediterranei bezlepkové CEREÁLNÍ TYČINKY ČOKOLÁDOVÉ 129g (6ks)",
  "CEREALNE BATONIKI CZEKOLADOWE 129g (6 szt.)": "CEREÁLNÍ TYČINKY ČOKOLÁDOVÉ 129g",
  "CEREALNE BATONIKI Z ŻURAWINAMI 129g (6 szt.)": "CEREÁLNÍ TYČINKY S BRUSINKAMI 129g",
  // Jogurt sušenky
  "JOGURTOWE CIASTECZKA Z 5 ZIARNAMI 200g": "Piaceri Mediterranei JOGURTOVÉ SUŠENKY S 5 CEREÁLIEMI 200g",
  "JOGURTOWE CIASTECZKA Z MALINAMI 210g": "Piaceri Mediterranei JOGURTOVÉ SUŠENKY S MALINAMI 210g",
  // Donuts - larger
  "DONUTY Z BIAŁĄ POLEWĄ 160g": "DONUTY S BÍLOU POLEVOU 160g",
  "DONUTY Z BIAŁĄ POLEWĄ 80g": "DONUTY S BÍLOU POLEVOU 80g",
  "DONUTY Z KAKAOWĄ POLEWĄ 160g": "DONUTY S KAKAOVOU POLEVOU 160g",
  "DONUTY Z KAKAOWĄ POLEWĄ 80g": "DONUTY S KAKAOVOU POLEVOU 80g",
  // Canestrelli
  "KWIATOWE CIASTECZKA CANESTRELLI 125g": "Piaceri Mediterranei bezlepkové KYTIČKOVÉ SUŠENKY CANESTRELLI 125g",
  "KWIATOWE CIASTECZKA CANESTRELLI 36g": "Piaceri Mediterranei bezlepkové KYTIČKOVÉ SUŠENKY CANESTRELLI 36g",
  // Piacerini
  "PIACERINI PISTACJOWE CIASTECZKA 60g": "Piaceri Mediterranei bezlepkové PIACERINI PISTÁCIOVÉ SUŠENKY 60g Bezlepkové vaflové sušenky s pistáciovou náplní",
  "PIACERINI CIASTECZKA Z BIAŁĄ CZEKOLADĄ 81g": "Piaceri Mediterranei bezlepkové PIACERINI SUŠENKY S BÍLOU ČOKOLÁDOU 81g  Bezlepkové vaflové sušenky s bílou čokoládou",
};

async function fetchFullDocument(): Promise<string> {
  const response = await fetch(DOC_URL_TXT);
  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.status}`);
  }
  return response.text();
}

// Fetch HTML version and convert bold tags to **bold** markers
async function fetchHtmlDocument(): Promise<string> {
  const response = await fetch(DOC_URL_HTML);
  if (!response.ok) {
    throw new Error(`Failed to fetch HTML document: ${response.status}`);
  }
  let html = await response.text();
  
  // Convert <b> and <strong> tags to **text** markers
  // Also handle <span style="font-weight:700"> or similar
  html = html.replace(/<b\b[^>]*>([^<]*)<\/b>/gi, '**$1**');
  html = html.replace(/<strong\b[^>]*>([^<]*)<\/strong>/gi, '**$1**');
  html = html.replace(/<span[^>]*font-weight:\s*(bold|700|800|900)[^>]*>([^<]*)<\/span>/gi, '**$2**');
  
  // Remove all other HTML tags
  html = html.replace(/<[^>]+>/g, ' ');
  
  // Decode HTML entities
  html = html.replace(/&nbsp;/g, ' ');
  html = html.replace(/&amp;/g, '&');
  html = html.replace(/&lt;/g, '<');
  html = html.replace(/&gt;/g, '>');
  html = html.replace(/&quot;/g, '"');
  html = html.replace(/&#39;/g, "'");
  
  // Normalize whitespace but preserve **markers**
  html = html.replace(/\s+/g, ' ');
  
  return html;
}

function extractPolishLabelsFromHtml(text: string): ParsedPolishLabel[] {
  const labels: ParsedPolishLabel[] = [];
  
  // The HTML is now flattened to one line with **bold** markers
  // Find all "Składniki:" sections and extract content
  const skladnikiPattern = /Składniki:\s*([^S]*?)(?=Wartości odżywcze|Wartość energetyczna|Przechowywać|$)/gi;
  const productPattern = /([A-Z][A-Z0-9]{2,4})\s+([A-ZŻŹĆŃÓŁĘĄŚ][^S]*?)\s+Składniki:/gi;
  
  // Alternative: find Składniki and work backwards/forwards
  const parts = text.split(/Składniki:\s*/i);
  
  for (let i = 1; i < parts.length; i++) {
    const beforePart = parts[i - 1];
    const afterPart = parts[i];
    
    // Extract product name from end of previous part
    // Look for pattern like "D136 BROWNIES 200g" or just product name
    const beforeWords = beforePart.trim().split(/\s+/);
    let productName = "";
    let code = "";
    
    // Work backwards to find product name (after a code like D136)
    for (let j = beforeWords.length - 1; j >= 0 && j >= beforeWords.length - 20; j--) {
      const word = beforeWords[j];
      if (/^[A-Z][A-Z0-9]{2,4}$/.test(word)) {
        code = word;
        productName = beforeWords.slice(j + 1).join(' ').trim();
        break;
      }
    }
    
    // If no code found, take last few words as product name
    if (!productName && beforeWords.length > 0) {
      const lastWords = beforeWords.slice(-10).join(' ');
      // Look for uppercase product name pattern
      const nameMatch = lastWords.match(/([A-ZŻŹĆŃÓŁĘĄŚ][A-ZŻŹĆŃÓŁĘĄŚa-zżźćńółęąś0-9\s()%-]+)$/);
      if (nameMatch) {
        productName = nameMatch[1].trim();
      }
    }
    
    if (!productName || productName.length < 3) continue;
    
    // Skip Czech labels (they have "Složení:" not "Składniki:")
    if (beforePart.includes("Složení:") && !beforePart.includes("Składniki:")) continue;
    
    // Extract ingredients - everything until "Wartości" or "Przechowywać"
    let skladniki = "";
    let wartosci = "";
    let producent = "";
    
    // Find where ingredients end
    const wartosciMatch = afterPart.match(/^(.*?)(Wartości odżywcze|Wartość energetyczna)/i);
    if (wartosciMatch) {
      skladniki = wartosciMatch[1].trim();
      
      // Extract nutritional values
      const afterWartosci = afterPart.substring(wartosciMatch.index! + wartosciMatch[0].length);
      const producentMatch = afterWartosci.match(/^(.*?)Producent:\s*([^P]*?)(?=Przechowywać|Minimalny|[A-Z][A-Z0-9]{2,4}\s|$)/i);
      if (producentMatch) {
        wartosci = (wartosciMatch[2] + producentMatch[1]).trim();
        producent = producentMatch[2].trim();
      } else {
        // Just get some nutritional info
        const nutMatch = afterWartosci.match(/^(.{0,500}?)(?=Przechowywać|Minimalny|[A-Z][A-Z0-9]{2,4}\s)/i);
        if (nutMatch) {
          wartosci = nutMatch[1].trim();
        }
      }
    } else {
      // No Wartości found, just take ingredients until next section
      const endMatch = afterPart.match(/^(.*?)(?=Przechowywać|Producent:|[A-Z][A-Z0-9]{2,4}\s)/i);
      if (endMatch) {
        skladniki = endMatch[1].trim();
      } else {
        skladniki = afterPart.substring(0, 500).trim();
      }
    }
    
    // Clean up skladniki - preserve **bold** markers
    skladniki = skladniki.replace(/\s+/g, ' ').trim();
    
    // Skip if skladniki is too short or doesn't look like ingredients
    if (skladniki.length < 10) continue;
    
    labels.push({
      code,
      polishName: productName.replace(/\*\*/g, '').trim(), // Remove bold from name
      skladniki: skladniki,
      wartosciOdzywcze: wartosci.replace(/\s+/g, ' ').trim(),
      producent: producent || "Piaceri Mediterranei – Włochy",
    });
  }
  
  return labels;
}

function extractPolishLabels(text: string): ParsedPolishLabel[] {
  const labels: ParsedPolishLabel[] = [];
  
  // Split by tabs to find blocks - the document uses tabs as separators
  // Each block starts with a code like "D060" or "CO10"
  const codePattern = /^[A-Z][A-Z0-9]{2,4}$/;
  
  // Find all positions of "Składniki:" and work backwards/forwards to extract
  const skladnikiMatches = [...text.matchAll(/Składniki:\s*([^\n]+)/gi)];
  
  for (const match of skladnikiMatches) {
    const matchPos = match.index || 0;
    
    // Look backwards to find the product name and code
    const textBefore = text.substring(Math.max(0, matchPos - 500), matchPos);
    const linesBefore = textBefore.split('\n').map(l => l.replace(/^\t+/, '').trim()).filter(l => l);
    
    // Find product name (last substantial line before Składniki)
    let productName = "";
    let code = "";
    
    for (let i = linesBefore.length - 1; i >= 0; i--) {
      const line = linesBefore[i];
      
      // Skip empty lines and storage instructions
      if (!line || line.startsWith("Producent") || line.startsWith("Přechow") || line.startsWith("Przechow")) continue;
      
      // Check if it's a product code
      if (codePattern.test(line)) {
        code = line;
        break;
      }
      
      // If no product name yet and this looks like one
      if (!productName && line.length > 5 && line.length < 150) {
        // Skip if it's part of previous label content
        if (line.includes("Tłuszcze") || line.includes("Węglowodany") || line.includes("Wartość")) continue;
        if (line.includes("Složení") || line.includes("Nutriční") || line.includes("Výrobce")) continue;
        productName = line;
      }
    }
    
    if (!productName) continue;
    
    // Extract ingredients
    let skladniki = match[1];
    
    // Look forward to get continuation of ingredients and nutritional values
    const textAfter = text.substring(matchPos + match[0].length, matchPos + 2000);
    const linesAfter = textAfter.split('\n').map(l => l.replace(/^\t+/, '').trim());
    
    let wartosci = "";
    let producent = "";
    let inSkladniki = true;
    
    for (const line of linesAfter) {
      if (!line) continue;
      
      if (line.startsWith("Wartości odżywcze") || line.startsWith("Wartość energetyczna")) {
        inSkladniki = false;
        if (line.includes("Wartość energetyczna")) {
          wartosci = line;
        }
        continue;
      }
      
      if (line.startsWith("Producent:")) {
        producent = line.replace("Producent:", "").trim();
        break;
      }
      
      if (line.startsWith("Przechowywać") || line.startsWith("Minimalny")) {
        continue;
      }
      
      // Check if we hit the next product (a code)
      if (codePattern.test(line)) {
        break;
      }
      
      if (inSkladniki) {
        // Continue ingredients if not hitting another section
        if (!line.startsWith("Wartości") && !line.startsWith("Nutriční")) {
          skladniki += " " + line;
        }
      } else if (wartosci) {
        // Continue nutritional values
        if (line.match(/^Tłuszcze|^Węglowodany|^Błonnik|^Białko|^Sól|^\d+\s*kJ/)) {
          wartosci += " " + line;
        }
      }
    }
    
    labels.push({
      code,
      polishName: productName.trim(),
      skladniki: skladniki.replace(/\s+/g, ' ').trim(),
      wartosciOdzywcze: wartosci.replace(/\s+/g, ' ').trim(),
      producent: producent || "Piaceri Mediterranei – Włochy",
    });
  }
  
  return labels;
}

function findCzechProductName(polishName: string): string | null {
  // Direct mapping
  if (polishToCzechMap[polishName]) {
    return polishToCzechMap[polishName];
  }
  
  // Try to find partial matches
  for (const [pl, cz] of Object.entries(polishToCzechMap)) {
    // Normalize and compare
    const plNorm = pl.toLowerCase().replace(/\s+/g, ' ').replace(/[()]/g, '');
    const searchNorm = polishName.toLowerCase().replace(/\s+/g, ' ').replace(/[()]/g, '');
    
    if (plNorm === searchNorm || searchNorm.includes(plNorm) || plNorm.includes(searchNorm)) {
      return cz;
    }
  }
  
  return null;
}

export async function POST(request: Request) {
  try {
    // Check if we should use HTML version (for bold allergens)
    const url = new URL(request.url);
    const useHtml = url.searchParams.get('html') === 'true';
    
    let polishLabels: ParsedPolishLabel[];
    
    if (useHtml) {
      const htmlText = await fetchHtmlDocument();
      polishLabels = extractPolishLabelsFromHtml(htmlText);
    } else {
      const documentText = await fetchFullDocument();
      polishLabels = extractPolishLabels(documentText);
    }
    
    // Get existing Czech labels
    const czechLabels = await prisma.productLabel.findMany({
      where: { language: "cs" },
    });
    
    const czechLabelMap = new Map<string, typeof czechLabels[0]>();
    for (const label of czechLabels) {
      czechLabelMap.set(label.productName, label);
    }
    
    const results = {
      found: polishLabels.length,
      matched: 0,
      created: 0,
      alreadyExists: 0,
      czechNotFound: 0,
      errors: [] as string[],
      matchedProducts: [] as { polish: string; czech: string }[],
      unmatchedProducts: [] as string[],
    };
    
    for (const plLabel of polishLabels) {
      const czechProductName = findCzechProductName(plLabel.polishName);
      
      if (!czechProductName) {
        results.unmatchedProducts.push(`${plLabel.code}: ${plLabel.polishName}`);
        continue;
      }
      
      const czechLabel = czechLabelMap.get(czechProductName);
      if (!czechLabel) {
        results.czechNotFound++;
        results.errors.push(`Czech label not in DB: "${czechProductName}" (from PL: ${plLabel.polishName})`);
        continue;
      }
      
      results.matched++;
      results.matchedProducts.push({ polish: plLabel.polishName, czech: czechProductName });
      
      // Check if Polish label already exists
      const existingPl = await prisma.productLabel.findUnique({
        where: {
          productName_language: {
            productName: czechProductName,
            language: "pl",
          },
        },
      });
      
      if (existingPl) {
        results.alreadyExists++;
        continue;
      }
      
      // Create Polish label
      try {
        await prisma.productLabel.create({
          data: {
            productName: czechProductName, // Use Czech productName for matching
            nazev: plLabel.polishName, // Polish display name
            slozeni: plLabel.skladniki,
            nutricniHodnoty: plLabel.wartosciOdzywcze || "Wartości odżywcze - patrz opakowanie",
            skladovani: "Przechowywać w suchym miejscu w temperaturze pokojowej.",
            vyrobce: plLabel.producent,
            language: "pl",
          },
        });
        results.created++;
      } catch (err) {
        results.errors.push(`Failed to create PL label for ${czechProductName}: ${err}`);
      }
    }
    
    return NextResponse.json(results);
  } catch (error) {
    console.error("Error importing Polish labels:", error);
    return NextResponse.json(
      { error: "Failed to import Polish labels", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const czechLabels = await prisma.productLabel.findMany({
    where: { language: "cs" },
    select: { productName: true },
  });
  
  const polishLabels = await prisma.productLabel.findMany({
    where: { language: "pl" },
    select: { productName: true, nazev: true },
  });
  
  return NextResponse.json({
    message: "POST to this endpoint to import Polish labels from Google Doc",
    mappingCount: Object.keys(polishToCzechMap).length,
    czechLabelCount: czechLabels.length,
    polishLabelCount: polishLabels.length,
    existingPolishLabels: polishLabels,
  });
}
