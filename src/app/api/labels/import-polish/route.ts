import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DOC_URL = "https://docs.google.com/document/d/1WeddfeCuDqLcauAVxWjVO99iu_2t32riFLzr1gajrkE/export?format=txt";

interface ParsedPolishLabel {
  polishName: string;
  skladniki: string;
  wartosciOdzywcze: string;
  producent: string;
}

// Mapping of Polish product identifiers to Czech productName in database
const productMatchers: { pattern: RegExp; czechProductName: string }[] = [
  // Exact matches first
  { pattern: /BROWNIES.*200\s*g/i, czechProductName: "BROWNIES 200g" },
  { pattern: /CANTUCCI.*200\s*g/i, czechProductName: "CANTUCCI 200g" },
  { pattern: /CZEKOLADOWE\s+SERCA\s+BATTITI.*200\s*g/i, czechProductName: "ČOKOLÁDOVÁ SRDÍČKA BATTITI 200g" },
  { pattern: /BATONIKI\s+KOKOSOWE\s+DOGO.*120\s*g/i, czechProductName: "KOKOSOVÉ TYČINKY DOGO 120g" },
  { pattern: /MUFFINY.*NADZIENIEM.*200\s*g/i, czechProductName: "MUFFINY S OVOCNOU NÁPLNÍ 200g" },
  { pattern: /CIOCOMIX.*BATONIKI.*120\s*g/i, czechProductName: "CIOCOMIX TYČINKY 120g (6ks)" },
  { pattern: /SALTERINI.*CIASTKA.*200\s*g/i, czechProductName: "SALTERINI SUŠENKY 200g" },
  { pattern: /BEZGLUTENOWE\s+CRACKERS/i, czechProductName: "CRACKERS" },
  { pattern: /DONUTY\s+PISTACJOWE.*90\s*g/i, czechProductName: "PISTÁCIOVÉ DONUTY 90g" },
  { pattern: /PIACERINI\s+KARMELOWE/i, czechProductName: "PIACERINI KARAMELOVÉ SUŠENKY 81g" },
  { pattern: /WAFLE\s+PISTACJOWE.*150\s*g/i, czechProductName: "PISTÁCIOVÉ OPLATKY 150g" },
  { pattern: /ATTIMI.*bezglutenowe.*ciasteczka.*orzechowe.*120\s*g/i, czechProductName: "ATTIMI KŘEHKÉ LÍSKOOŘÍŠKOVÉ KOLÁČKY 120g" },
  { pattern: /SFOGLIATINE.*polew.*morel.*150\s*g/i, czechProductName: "SFOGLIATINE KŘEHKÉ SUŠENKY S MERUŇKOVOU GLAZUROU 150g" },
  { pattern: /RUSTYKALNY.*BEZGLUTENOWY.*CHLEB.*KROJONY.*300\s*g/i, czechProductName: "RUSTIKÁLNÍ BEZLEPKOVÝ CHLÉB KRÁJENÝ 300g" },
  { pattern: /GRISTICK.*BARS.*60\s*g/i, czechProductName: "GRISTICK TYČINKY S PŘÍCHUTÍ BRAMBOR A ROZMARÝNU 60g" },
  { pattern: /WRAP.*PEŁNOZIARNISTY.*180\s*g/i, czechProductName: "WRAP CELOZRNNÝ 180g (3ks)" },
  { pattern: /GRANOLA\s+CZEKOLADOWA.*240\s*g/i, czechProductName: "GRANOLA ČOKOLÁDOVÁ 240g" },
  { pattern: /GRANOLA\s+Z\s+CZERWONYMI.*240\s*g/i, czechProductName: "GRANOLA S ČERVENÝM OVOCEM 240g" },
  { pattern: /DONUTY\s+BIAŁE.*90\s*g/i, czechProductName: "DONUTY BÍLÉ 90g" },
  { pattern: /DONUTY\s+ORZECHOWE.*90\s*g/i, czechProductName: "DONUTY OŘÍŠKOVÉ 90g" },
  { pattern: /GIRINGIRO.*ciastka.*200\s*g/i, czechProductName: "GIRINGIRO SUŠENKY 200g" },
  { pattern: /CROSTATINE\s+ORZECHY\s+LASKOWE/i, czechProductName: "CROSTATINE LÍSKOOŘÍŠKOVÉ 200g" },
  { pattern: /CROSTATINE\s+MORELOWE.*200\s*g/i, czechProductName: "CROSTATINE MERUŇKOVÉ 200g" },
  { pattern: /CROSTATINE\s+Z\s+OWOCAMI\s+LEŚNYMI/i, czechProductName: "CROSTATINE S LESNÍM OVOCEM 200g" },
  { pattern: /PASTA\s+Z\s+ORZECHÓW\s+LASKOWYCH\s+GOLOMIX.*200\s*g/i, czechProductName: "GOLOMIX KRÉM Z LÍSKOVÝCH OŘÍŠKŮ 200g" },
  { pattern: /GOLOMIX.*Ciasteczka\s+kakaowe.*200\s*g/i, czechProductName: "GOLOMIX SUŠENKY S KAKAEM A HVĚZDIČKAMI 200g" },
  { pattern: /PIŠKOTOWY\s+CHLEBIK.*CZEKOLAD.*270\s*g/i, czechProductName: "PIŠKOTOVÝ CHLEBÍČEK S ČOKOLÁDOU 270g" },
  { pattern: /MĄKA\s+UNIWERSALNA.*1000\s*g/i, czechProductName: "UNIVERZÁLNÍ MOUKA 1000g" },
  { pattern: /COUS\s*COUS.*375\s*g/i, czechProductName: "KUSKUS 375g" },
  { pattern: /ZBOŻOWE\s+KULKI\s+MIODOWE.*300\s*g/i, czechProductName: "CEREÁLIE MEDOVÉ KROUŽKY 300g" },
];

async function fetchFullDocument(): Promise<string> {
  const response = await fetch(DOC_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.status}`);
  }
  return response.text();
}

function extractPolishLabels(text: string): ParsedPolishLabel[] {
  const labels: ParsedPolishLabel[] = [];
  
  // Find all Polish label blocks - they start with a product code and contain "Składniki:"
  const regex = /([A-Z][A-Z0-9]{2,4})\s*\n\s*([^\n]+)\n[\s\S]*?Składniki:\s*([^\n]+(?:\n(?!Wartości|Producent)[^\n]+)*)\s*(?:Wartości odżywcze[^\n]*\n)?(?:Wartość energetyczna:\s*)?([^\n]*(?:\n(?!Producent|Przechow)[^\n]+)*)\s*(?:Przechowywać[^\n]*\n)?\s*Producent:\s*([^\n]+)/gi;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const productCode = match[1];
    const productName = match[2].trim();
    const skladniki = match[3].replace(/\s+/g, ' ').trim();
    const wartosci = match[4].replace(/\s+/g, ' ').trim();
    const producent = match[5].trim();
    
    // Only include if it has Polish markers
    if (skladniki && productName) {
      labels.push({
        polishName: productName,
        skladniki,
        wartosciOdzywcze: wartosci,
        producent,
      });
    }
  }
  
  return labels;
}

function findCzechProductName(polishName: string): string | null {
  for (const matcher of productMatchers) {
    if (matcher.pattern.test(polishName)) {
      return matcher.czechProductName;
    }
  }
  return null;
}

export async function POST() {
  try {
    const documentText = await fetchFullDocument();
    
    // Manual extraction based on document structure
    const polishBlocks: ParsedPolishLabel[] = [];
    
    // Split by double newlines and look for Polish content
    const sections = documentText.split(/\n\t*\n/);
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      
      // Check if section contains Polish ingredients
      if (section.includes("Składniki:")) {
        // Try to find the product name (usually uppercase, before Składniki)
        const lines = section.split('\n').map(l => l.trim()).filter(l => l);
        
        let productName = "";
        let skladniki = "";
        let wartosci = "";
        let producent = "";
        
        for (let j = 0; j < lines.length; j++) {
          const line = lines[j];
          
          // Product name is usually in uppercase
          if (!productName && line.match(/^[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ\s\-\(\)0-9g]+$/u) && line.length > 3) {
            productName = line;
          }
          
          if (line.startsWith("Składniki:")) {
            skladniki = line.replace("Składniki:", "").trim();
            // Collect continuation lines
            for (let k = j + 1; k < lines.length; k++) {
              const nextLine = lines[k];
              if (nextLine.startsWith("Wartości") || nextLine.startsWith("Producent") || nextLine.match(/^[A-Z][0-9]{2,3}$/)) {
                break;
              }
              skladniki += " " + nextLine;
            }
          }
          
          if (line.includes("Wartość energetyczna:") || line.match(/^\d+\s*kJ/)) {
            wartosci += " " + line;
          }
          if (line.match(/^Tłuszcze|^Węglowodany/)) {
            wartosci += " " + line;
          }
          
          if (line.startsWith("Producent:")) {
            producent = line.replace("Producent:", "").trim();
          }
        }
        
        if (productName && skladniki) {
          polishBlocks.push({
            polishName: productName,
            skladniki: skladniki.trim(),
            wartosciOdzywcze: wartosci.trim(),
            producent: producent || "Piaceri Mediterranei – Włochy",
          });
        }
      }
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
      found: polishBlocks.length,
      matched: 0,
      created: 0,
      alreadyExists: 0,
      errors: [] as string[],
      matchedProducts: [] as { polish: string; czech: string }[],
      unmatchedProducts: [] as string[],
    };
    
    for (const plLabel of polishBlocks) {
      const czechProductName = findCzechProductName(plLabel.polishName);
      
      if (!czechProductName) {
        results.unmatchedProducts.push(plLabel.polishName);
        continue;
      }
      
      const czechLabel = czechLabelMap.get(czechProductName);
      if (!czechLabel) {
        results.errors.push(`Czech label not found in DB: ${czechProductName} (from PL: ${plLabel.polishName})`);
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
      
      // Format nutritional values
      let nutri = plLabel.wartosciOdzywcze;
      if (!nutri.includes("kJ") && !nutri.includes("kcal")) {
        nutri = "";
      }
      
      // Create Polish label
      try {
        await prisma.productLabel.create({
          data: {
            productName: czechProductName,
            nazev: plLabel.polishName,
            slozeni: plLabel.skladniki,
            nutricniHodnoty: nutri || "Wartości odżywcze - patrz opakowanie",
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
  // List existing Czech labels for reference
  const czechLabels = await prisma.productLabel.findMany({
    where: { language: "cs" },
    select: { productName: true },
  });
  
  return NextResponse.json({
    message: "POST to this endpoint to import Polish labels from Google Doc",
    matcherCount: productMatchers.length,
    czechLabelCount: czechLabels.length,
    czechLabels: czechLabels.map(l => l.productName),
  });
}
