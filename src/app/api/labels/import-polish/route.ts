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
  // Polish name -> Czech productName
  "ZBOŻOWE KULKI MIODOWE 300g": "CEREÁLIE MEDOVÉ KROUŽKY 300g",
  "CZEKOLADOWE SERCA BATTITI 200g": "ČOKOLÁDOVÁ SRDÍČKA BATTITI 200g",
  "BATONIKI KOKOSOWE DOGO 120 g": "KOKOSOVÉ TYČINKY DOGO 120g",
  "CANTUCCI 200g": "CANTUCCI 200g",
  "MUFFINY Z NADZIENIEM OWOCOWYM 200g": "MUFFINY S OVOCNOU NÁPLNÍ 200g",
  "CIOCOMIX BATONIKI 120 g (6 szt.)": "CIOCOMIX TYČINKY 120g (6ks)",
  "SALTERINI CIASTKA 200g": "SALTERINI SUŠENKY 200g",
  "BEZGLUTENOWE CRACKERS": "CRACKERS",
  "DONUTY PISTACJOWE (90g)": "PISTÁCIOVÉ DONUTY 90g",
  "PIACERINI KARMELOWE CIASTECZKA": "PIACERINI KARAMELOVÉ SUŠENKY 81g",
  "WAFLE PISTACJOWE 150g": "PISTÁCIOVÉ OPLATKY 150g",
  "ATTIMI bezglutenowe ciasteczka orzechowe 120g": "ATTIMI KŘEHKÉ LÍSKOOŘÍŠKOVÉ KOLÁČKY 120g",
  "SFOGLIATINE z polewą morelową 150g": "SFOGLIATINE KŘEHKÉ SUŠENKY S MERUŇKOVOU GLAZUROU 150g",
  "RUSTYKALNY BEZGLUTENOWY CHLEB KROJONY (300g)": "RUSTIKÁLNÍ BEZLEPKOVÝ CHLÉB KRÁJENÝ 300g",
  "GRISTICK BARS o smaku ziemniaków i rozmarynu 60g": "GRISTICK TYČINKY S PŘÍCHUTÍ BRAMBOR A ROZMARÝNU 60g",
  "WRAP PEŁNOZIARNISTY 180 g (3 szt.)": "WRAP CELOZRNNÝ 180g (3ks)",
  "GRANOLA CZEKOLADOWA 240g": "GRANOLA ČOKOLÁDOVÁ 240g",
  "GRANOLA Z CZERWONYMI OWOCAMI 240g": "GRANOLA S ČERVENÝM OVOCEM 240g",
  "DONUTY BIAŁE 90 g": "DONUTY BÍLÉ 90g",
  "DONUTY ORZECHOWE 90 g": "DONUTY OŘÍŠKOVÉ 90g",
  "GIRINGIRO ciastka 200 g": "GIRINGIRO SUŠENKY 200g",
  "CROSTATINE ORZECHY LASKOWE": "CROSTATINE LÍSKOOŘÍŠKOVÉ 200g",
  "CROSTATINE MORELOWE 200 g": "CROSTATINE MERUŇKOVÉ 200g",
  "CROSTATINE Z OWOCAMI LEŚNYMI": "CROSTATINE S LESNÍM OVOCEM 200g",
  "PASTA Z ORZECHÓW LASKOWYCH GOLOMIX CREMA 200g": "GOLOMIX KRÉM Z LÍSKOVÝCH OŘÍŠKŮ 200g",
  "GOLOMIX Ciasteczka kakaowe z gwiazdkami 200g": "GOLOMIX SUŠENKY S KAKAEM A HVĚZDIČKAMI 200g",
  "PIŠKOTOWY CHLEBIK Z CZEKOLADĄ (270g)": "PIŠKOTOVÝ CHLEBÍČEK S ČOKOLÁDOU 270g",
  "MĄKA UNIWERSALNA 1000g": "UNIVERZÁLNÍ MOUKA 1000g",
  "COUS COUS 375g": "KUSKUS 375g",
  "BROWNIES 200g": "BROWNIES 200g",
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
  
  // Split by tabs/newlines to find product blocks
  // Look for pattern: CODE\n\tPRODUCT_NAME\n\tSkładniki:...
  const blocks = text.split(/\n\s*\n+/);
  
  for (const block of blocks) {
    // Check if block contains Polish ingredients
    if (!block.includes("Składniki:")) continue;
    
    const lines = block.split('\n').map(l => l.replace(/^\t+/, '').trim()).filter(l => l);
    
    let code = "";
    let productName = "";
    let skladniki = "";
    let wartosci = "";
    let producent = "";
    let inSkladniki = false;
    let inWartosci = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Product code (e.g., D060, CO10, S038)
      if (line.match(/^[A-Z][A-Z0-9]{2,4}$/) && !code) {
        code = line;
        continue;
      }
      
      // Product name (line after code, or first uppercase line with product info)
      if (!productName && code && !line.startsWith("Składniki")) {
        productName = line;
        continue;
      }
      
      // Ingredients
      if (line.startsWith("Składniki:")) {
        inSkladniki = true;
        inWartosci = false;
        skladniki = line.replace("Składniki:", "").trim();
        continue;
      }
      
      // Nutritional values
      if (line.startsWith("Wartości odżywcze") || line.startsWith("Wartość energetyczna")) {
        inSkladniki = false;
        inWartosci = true;
        if (line.includes("Wartość energetyczna")) {
          wartosci = line;
        }
        continue;
      }
      
      // Producer
      if (line.startsWith("Producent:")) {
        inSkladniki = false;
        inWartosci = false;
        producent = line.replace("Producent:", "").trim();
        continue;
      }
      
      // Skip storage info
      if (line.startsWith("Przechowywać") || line.startsWith("Minimalny okres")) {
        inSkladniki = false;
        inWartosci = false;
        continue;
      }
      
      // Continue collecting based on state
      if (inSkladniki && !line.startsWith("Wartości") && !line.startsWith("Producent")) {
        skladniki += " " + line;
      } else if (inWartosci && !line.startsWith("Producent") && !line.startsWith("Przechowywać")) {
        wartosci += " " + line;
      }
    }
    
    if (productName && skladniki) {
      labels.push({
        code,
        polishName: productName.trim(),
        skladniki: skladniki.trim(),
        wartosciOdzywcze: wartosci.trim(),
        producent: producent || "Piaceri Mediterranei – Włochy",
      });
    }
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
