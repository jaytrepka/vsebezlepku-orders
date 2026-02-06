import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DOC_URL = "https://docs.google.com/document/d/1WeddfeCuDqLcauAVxWjVO99iu_2t32riFLzr1gajrkE/export?format=txt";

interface ParsedPolishLabel {
  code: string;
  polishName: string;
  skladniki: string;
  wartosciOdzywcze: string;
  producent: string;
}

// Direct mapping from Polish product names to Czech productName in database
// Based on matching product codes, weights, or key identifiers
const polishToCzechMap: Record<string, string> = {
  // Polish name -> Czech productName (as it exists in DB)
  "ZBOŻOWE KULKI MIODOWE 300g": "CEREÁLIE MEDOVÉ KROUŽKY 300g",
  "CZEKOLADOWE SERCA BATTITI 200g": "Piaceri Mediterranei ČOKOLÁDOVÁ SRDÍČKA BATTITI 200g",
  "BATONIKI KOKOSOWE DOGO 120 g": "Piaceri Mediterranei KOKOSOVÉ TYČINKY DOGO 120g",
  "CANTUCCI 200g": "CANTUCCI 200g",
  "MUFFINY Z NADZIENIEM OWOCOWYM 200g": "Piaceri Mediterranei bezlepkové MUFFINY S OVOCNOU NÁPLNÍ 200g (4ks)",
  "CIOCOMIX BATONIKI 120 g (6 szt.)": "Piaceri Mediterranei bezlepkové CIOCOMIX TYČINKY 120g (6ks)",
  "SALTERINI CIASTKA 200g": "Piaceri Mediterranei SALTERINI SUŠENKY 200g",
  "BEZGLUTENOWE CRACKERS": "CRACKERS TRADICIONALES 200g",
  "DONUTY PISTACJOWE (90g)": "Piaceri Mediterranei bezlepkové DONUTY PISTÁCIOVÉ 90g",
  "PIACERINI KARMELOWE CIASTECZKA": "Piaceri Mediterranei PIACERINI KARAMELOVÉ SUŠENKY 81g",
  "WAFLE PISTACJOWE 150g": "PISTÁCIOVÉ OPLATKY 150g",
  "ATTIMI bezglutenowe ciasteczka orzechowe 120g": "ATTIMI KŘEHKÉ LÍSKOOŘÍŠKOVÉ KOLÁČKY 120g",
  "SFOGLIATINE z polewą morelową 150g": "SFOGLIATINE KŘEHKÉ SUŠENKY S MERUŇKOVOU GLAZUROU 150g",
  "RUSTYKALNY BEZGLUTENOWY CHLEB KROJONY (300g)": "Piaceri Mediterranei RUSTIKÁLNÍ BEZLEPKOVÝ KRÁJENÝ CHLÉB (300g)",
  "GRISTICK BARS o smaku ziemniaków i rozmarynu 60g": "Piaceri Mediterranei GRISTICK TYČINKY 60g",
  "WRAP PEŁNOZIARNISTY 180 g (3 szt.)": "Piaceri Mediterranei bezlepkový WRAP 180g (3ks)",
  "GRANOLA CZEKOLADOWA 240g": "Piaceri Mediterranei GRANOLA ČOKOLÁDOVÁ 240g",
  "GRANOLA Z CZERWONYMI OWOCAMI 240g": "Piaceri Mediterranei GRANOLA S ČERVENÝM OVOCEM 240g",
  "DONUTY BIAŁE 90 g": "Piaceri Mediterranei DONUTY BÍLÉ 90g",
  "DONUTY ORZECHOWE 90 g": "Piaceri Mediterranei DONUTY OŘÍŠKOVÉ 90g",
  "GIRINGIRO ciastka 200 g": "Piaceri Mediterranei GIRINGIRO SUŠENKY 200g",
  "CROSTATINE ORZECHY LASKOWE": "Piaceri Mediterranei CROSTATINE LÍSKOOŘÍŠKOVÉ 200g",
  "CROSTATINE MORELOWE 200 g": "Piaceri Mediterranei CROSTATINE MERUŇKOVÉ 200g",
  "CROSTATINE Z OWOCAMI LEŚNYMI": "Piaceri Mediterranei bezlepkové CROSTATINE S LESNÍM OVOCEM 200g",
  "PASTA Z ORZECHÓW LASKOWYCH GOLOMIX CREMA 200g": "Piaceri Mediterranei GOLOMIX KRÉM Z LÍSKOVÝCH OŘÍŠKŮ 200g",
  "GOLOMIX Ciasteczka kakaowe z gwiazdkami 200g": "Piaceri Mediterranei GOLOMIX KAKAOVÉ SUŠENKY s hvězdičkami 200g",
  "PIŠKOTOWY CHLEBIK Z CZEKOLADĄ (270g)": "Piaceri Mediterranei PIŠKOTOVÝ CHLEBÍČEK S ČOKOLÁDOU 270g",
  "MĄKA UNIWERSALNA 1000g": "Piaceri Mediterranei UNIVERZÁLNÍ MOUKA 1000g",
  "COUS COUS 375g": "COUS COUS kukuřičný 375g",
  "BROWNIES 200g": "BROWNIES 200g",
  // More mappings based on actual DB content
  "TORTELLINI PROSCIUTTO CRUDO 250g": "Piaceri Mediterranei TORTELLINI PROSCIUTTO CRUDO 250g (2 porce)",
  "TORTELLINI Z MIESEM 250 g (2 porcje)": "Piaceri Mediterranei TORTELLINI S MASEM 250g (2 porce)",
  "Tortelloni z ricottą i szpinakiem 250 g (2 porcje)": "Piaceri Mediterranei TORTELLONI S RICOTTOU A ŠPENÁTEM 250g (2 porce)",
  "SFIZI BBQ CHRUPKI 100g": "Piaceri Mediterranei SFIZI BBQ KŘUPKY 100g",
  "BRUSCHETTINE z papryką i chili 100g": "BRUSCHETTINE s paprikou a chilli 100g",
  "BRUSCHETTINE Mediterranee 100g": "BRUSCHETTINE Mediterranee 100g",
  "CANNELLONI": "CANNELLONI",
  "WAFLE o smaku waniliowym 45g": "Piaceri Mediterranei OPLATKY S VANILKOVOU PŘÍCHUTÍ 45g",
  "WAFLE o smaku ORZECHÓW LASKOWYCH 45g": "Piaceri Mediterranei OPLATKY S LÍSKOOŘÍŠKOVOU PŘÍCHUTÍ 45g",
  "CIOCOPUNTA CHOCOLATE MINICORNETS 108g (6szt)": "CIOCOPUNTA ČOKOLÁDOVÉ MINIKORNOUTKY 108g",
  "CIOCOPUNTA PISTACHIO MINICORNETS 108g (6szt)": "Piaceri Mediterranei CIOCOPUNTA PISTÁCIOVÉ MINIKORNOUTKY 108g (6ks)",
  "PIACERINI DUNE WHITE 33g": "Piaceri Mediterranei PIACERINI TYČINKA DUNE WHITE 33g",
  "SAVOIARDI PIECZYWO CUKROWE 180g": "Piaceri Mediterranei SAVOIARDI PIŠKOTY 180g",
  "GRISSINI CAŁE BATONY ZIARNISTE 160G": "Piaceri Mediterranei GRISSINI TYČINKY 160g",
};

async function fetchFullDocument(): Promise<string> {
  const response = await fetch(DOC_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.status}`);
  }
  return response.text();
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

export async function POST() {
  try {
    const documentText = await fetchFullDocument();
    const polishLabels = extractPolishLabels(documentText);
    
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
