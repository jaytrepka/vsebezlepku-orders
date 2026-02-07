import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DOC_URL_HTML =
  "https://docs.google.com/document/d/1V97zNPTENRnjfqJS1_WCAq_K8WDsSWGrF3DmerVxidg/export?format=html";
const DOC_URL_TXT =
  "https://docs.google.com/document/d/1V97zNPTENRnjfqJS1_WCAq_K8WDsSWGrF3DmerVxidg/export?format=txt";

// Map Slovak product names to Czech product names for matching
const slovakToCzechMap: Record<string, string> = {
  "AMARETTI 200g": "AMARETTI 200g",
  "ATTIMI – MASLOVÁ KOLIESKA 200g": "ATTIMI – MÁSLOVÁ KOLEČKA 200g",
  "BAGETA KLASICKÁ 175g": "BAGETA KLASICKÁ 175g",
  "BAGETA RUSTIKÁLNA 175g": "BAGETA RUSTIKÁLNÍ 175g",
  "BIELE MINI CROISSANT 200g": "BÍLÉ MINI CROISSANTY 200g",
  "BROWNIES 200g": "BROWNIES 200g",
  "CANTUCCINI 200g": "CANTUCCINI 200g",
  "CEREÁLNE TYČINKY ČOKOLÁDOVÉ 129g (6ks)": "CEREÁLNÍ TYČINKY ČOKOLÁDOVÉ 129g (6ks)",
  "CEREÁLNE TYČINKY S BRUSNICAMI 129g (6ks)": "CEREÁLNÍ TYČINKY S BRUSINKAMI 129g (6ks)",
  "CIABATTA 200g": "CIABATTA 200g",
  "CIOCOPUNTA PISTACHIO MINIKORNÚTKY 108g (6ks)": "CIOCOPUNTA PISTACHIO MINICORNETS 108g (6ks)",
  "CORNETTI CROISSANTY S ČOKOLÁDOU 250g (5ks)": "CORNETTI S ČOKOLÁDOU 250g (5ks)",
  "CORNETTI CROISSANTY S MARHUĽAMI 250g (5ks)": "CORNETTI S MERUŇKAMI 250g (5ks)",
  "CROSTATINE KAKAOVÉ 200g": "CROSTATINE KAKAOVÉ 200g",
  "CROSTATINE MARHUĽOVÉ 200g": "CROSTATINE MERUŇKOVÉ 200g",
  "CROSTATINE SMOTANOVÉ 200g": "CROSTATINE SMETANOVÉ 200g",
  "CROSTATINE ČOKOLÁDOVÉ 200g": "CROSTATINE ČOKOLÁDOVÉ 200g",
  "ČOKOLÁDOVÉ SRDIEČKA BATTITI 200g": "ČOKOLÁDOVÁ SRDÍČKA BATTITI 200g",
  "ČOKOLÁDOVÝ CHLIEB 250g": "ČOKOLÁDOVÝ CHLÉB 250g",
  "ELISEO krémové sušienky 200g": "ELISEO 200g",
  "ELISEO s BIELOU ČOKOLÁDOU 200g": "ELISEO s BÍLOU ČOKOLÁDOU 200g",
  "FROLLINI KAKAO 200g": "FROLLINI KAKAO 200g",
  "FROLLINI S ČOKOLÁDOVÝMI LUPIENKAMI 200g": "FROLLINI S ČOKOLÁDOVÝMI LUPÍNKY 200g",
  "GRISSINI TYČINKY klasické 150g": "GRISSINI TYČINKY klasické 150g",
  "GRISSINI TYČINKY s olivovým olejom 150g": "GRISSINI TYČINKY s olivovým olejem 150g",
  "GRISSINI TYČINKY s rozmarínom 150g": "GRISSINI TYČINKY s rozmarýnem 150g",
  "GRISSINI TYČINKY sézamové 150g": "GRISSINI TYČINKY sezamové 150g",
  "HARMÓNIA – sušienky s kúskami čokolády 200g": "HARMONIE – sušenky s kousky čokolády 200g",
  "JOGURTOVÉ SUŠIENKY S 5 CEREÁLIAMI 200g": "JOGURTOVÉ SUŠENKY S 5 CEREÁLIEMI 200g",
  "JOGURTOVÉ SUŠIENKY S MALINAMI 210g": "JOGURTOVÉ SUŠENKY S MALINAMI",
  "KAKAOVÉ CROISSANTY 200g": "KAKAOVÉ CROISSANTY 200g",
  "KLASICKÉ CROISSANTY 200g": "KLASICKÉ CROISSANTY 200g",
  "KOSTKY s mliečnou čokoládou 200g": "KOSTKY s mléčnou čokoládou 200g",
  "MIRTILLINI sušienky s čučoriedkami 200g": "MIRTILLINI sušenky s borůvkami 200g",
  "PAVONETTI – krehké sušienky 140g": "PAVONETTI - bezlepkové křehké sušenky 140g",
  "PLNENÉ WAFLE S KRÉMOM GIANDUIA 150g": "PLNĚNÉ OPLATKY S KRÉMEM GIANDUIA 150g",
  "PLNENÉ WAFLE S LIESKOVOORIEŠKOVOU NÁPLŇOU 175g": "PLNĚNÉ OPLATKY S LÍSKOOŘÍŠKOVOU NÁPLNÍ 175g",
  "POLENTA hrubozrnná 500g": "POLENTA hrubozrnná 500g",
  "POLENTA jemnozrnná 500g": "POLENTA jemnozrnná 500g",
  "SAVOIARDI PIŠKÓTY 150g": "SAVOIARDI PIŠKOTY 150g",
  "SLANÉ KREKRY 175g": "SLANÉ KREKRY 175g",
  "SUŠIENKY CANESTRELLI 125g": "SUŠENKY CANESTRELLI",
  "SUŠIENKY S KARAMELOM 200g": "SUŠENKY S KARAMELEM 200g",
  "TARALLI klasické 200g": "TARALLI klasické 200g",
  "TARALLI s extra virgin olivovým olejom 200g": "TARALLI s extra virgin olivovým olejem 200g",
  "TARALLINI SLADKÉ 200g": "TARALLINI SLADKÉ 200g",
  "TOAST CELOZRNNÝ 400g": "TOUST CELOZRNNÝ 400g",
  "TOAST KLASICKÝ 400g": "TOUST KLASICKÝ 400g",
  "TOAST RUSTIKÁLNY 400g": "TOUST RUSTIKÁLNÍ 400g",
  "VEGÁNSKE PIŠKÓTY 150g": "VEGANSKÉ PIŠKOTY 150g",
  "ZMES MÚKY NA BEZLEPKOVÝ CHLIEB 500g": "SMĚS MOUKY NA BEZLEPKOVÝ CHLÉB 500g",
  "ZMES MÚKY NA PIZZU 500g": "SMĚS MOUKY NA PIZZU 500g",
};

interface LabelData {
  name: string;
  ingredients: string;
  nutritionalValues: string;
  storage: string;
  producer: string;
}

async function fetchHtmlDocument(): Promise<{ html: string; boldClasses: string[] }> {
  const response = await fetch(DOC_URL_HTML);
  const html = await response.text();
  
  // Extract bold classes from CSS
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const boldClasses: string[] = [];
  
  if (styleMatch) {
    const cssContent = styleMatch[1];
    // Find all class definitions with font-weight:700
    const classRegex = /\.(c\d+)\s*\{[^}]*font-weight:\s*700[^}]*\}/g;
    let match;
    while ((match = classRegex.exec(cssContent)) !== null) {
      boldClasses.push(match[1]);
    }
  }
  
  return { html, boldClasses };
}

async function fetchTextDocument(): Promise<string> {
  const response = await fetch(DOC_URL_TXT);
  return await response.text();
}

function markBoldText(text: string, html: string, boldClasses: string[]): string {
  if (boldClasses.length === 0) return text;
  
  // Create a pattern to find bold spans
  const classPattern = boldClasses.join('|');
  const spanRegex = new RegExp(`<span[^>]*class="[^"]*\\b(${classPattern})\\b[^"]*"[^>]*>([^<]*)</span>`, 'gi');
  
  // Extract bold words from HTML
  const boldWords: string[] = [];
  let match;
  while ((match = spanRegex.exec(html)) !== null) {
    const word = match[2].trim();
    if (word && word.length > 1) {
      boldWords.push(word);
    }
  }
  
  // Replace bold words in text with markdown bold
  let result = text;
  for (const word of boldWords) {
    // Escape special regex characters
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordRegex = new RegExp(`(?<!\\*\\*)${escaped}(?!\\*\\*)`, 'g');
    result = result.replace(wordRegex, `**${word}**`);
  }
  
  return result;
}

function extractSlovakLabelsFromText(text: string): LabelData[] {
  const labels: LabelData[] = [];
  
  // Split by product codes (like D136, S042, CO10, P019)
  const productBlocks = text.split(/(?=^[A-Z]{1,2}\d{2,3}\s*$)/m);
  
  for (const block of productBlocks) {
    // Check if block contains ingredients (either "Zloženie:" or "Ingrediencie:")
    if (!block.match(/(?:Zloženie|Ingrediencie):/i)) continue;
    
    // Extract product name - usually on the first or second line after code
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 3) continue;
    
    // Find the product name (usually contains weight like "200g" or "200 g")
    let name = '';
    for (let i = 0; i < Math.min(4, lines.length); i++) {
      if (lines[i].match(/\d+\s*g|\d+\s*ks/i) && !lines[i].match(/^[A-Z]{1,2}\d{2,3}$/)) {
        name = lines[i].trim();
        break;
      }
    }
    
    if (!name) continue;
    
    // Extract ingredients (either "Zloženie:" or "Ingrediencie:")
    const ingredientsMatch = block.match(/(?:Zloženie|Ingrediencie):\s*([\s\S]*?)(?=Nutričné|Výrobca:|Príprava:|$)/i);
    let ingredients = ingredientsMatch ? ingredientsMatch[1].trim() : '';
    
    // Clean up ingredients
    ingredients = ingredients
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract nutritional values
    const nutritionMatch = block.match(/Nutričné[^:]*hodnoty[^:]*:\s*([\s\S]*?)(?=Výrobca:|Skladujte|Príprava:|Minimálna|$)/i);
    let nutritionalValues = nutritionMatch ? nutritionMatch[1].trim() : '';
    nutritionalValues = nutritionalValues
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Default storage and producer for Slovak
    const storage = 'Skladujte na suchom mieste pri izbovej teplote.';
    const producer = 'Piaceri Mediterranei – Taliansko';
    
    if (name && ingredients) {
      labels.push({
        name,
        ingredients,
        nutritionalValues,
        storage,
        producer,
      });
    }
  }
  
  return labels;
}

function extractSlovakLabelsFromHtml(html: string, boldClasses: string[]): LabelData[] {
  const labels: LabelData[] = [];
  
  // Remove HTML tags but preserve structure
  const textContent = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n');
  
  // Split by product codes (like D136, S042, CO10)
  const productBlocks = textContent.split(/(?=\b[A-Z]{1,2}\d{2,3}\b)/);
  
  for (const block of productBlocks) {
    // Check if block contains "Zloženie:" (Slovak for ingredients)
    if (!block.includes('Zloženie:')) continue;
    
    // Extract product name - usually on the first or second line after code
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 3) continue;
    
    // Find the product name (usually contains weight like "200g")
    let name = '';
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      if (lines[i].match(/\d+g|\d+ks/i) && !lines[i].match(/^[A-Z]{1,2}\d{2,3}$/)) {
        name = lines[i].trim();
        break;
      }
    }
    
    if (!name) continue;
    
    // Extract ingredients
    const ingredientsMatch = block.match(/Zloženie:\s*([\s\S]*?)(?=Nutričné hodnoty|Výrobca:|$)/i);
    let ingredients = ingredientsMatch ? ingredientsMatch[1].trim() : '';
    
    // Mark bold allergens in ingredients
    if (ingredients && boldClasses.length > 0) {
      // Find the corresponding HTML section for this product
      const nameEscaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const productHtmlMatch = html.match(new RegExp(`${nameEscaped}[\\s\\S]*?(?=<p[^>]*>[A-Z]{1,2}\\d{2,3}|$)`, 'i'));
      if (productHtmlMatch) {
        ingredients = markBoldText(ingredients, productHtmlMatch[0], boldClasses);
      }
    }
    
    // Clean up ingredients
    ingredients = ingredients
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract nutritional values
    const nutritionMatch = block.match(/Nutričné hodnoty[^:]*:\s*([\s\S]*?)(?=Výrobca:|Skladujte|$)/i);
    let nutritionalValues = nutritionMatch ? nutritionMatch[1].trim() : '';
    nutritionalValues = nutritionalValues
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Default storage and producer for Slovak
    const storage = 'Skladujte na suchom mieste pri izbovej teplote.';
    const producer = 'Piaceri Mediterranei – Taliansko';
    
    if (name && ingredients) {
      labels.push({
        name,
        ingredients,
        nutritionalValues,
        storage,
        producer,
      });
    }
  }
  
  return labels;
}

export async function GET() {
  try {
    const labels = await prisma.productLabel.findMany({
      where: { language: "sk" },
      orderBy: { productName: "asc" },
    });

    return NextResponse.json({
      count: labels.length,
      labels: labels.map((l) => ({
        id: l.id,
        productName: l.productName,
        ingredients: l.slozeni?.substring(0, 100) + "...",
      })),
    });
  } catch (error) {
    console.error("Error fetching Slovak labels:", error);
    return NextResponse.json(
      { error: "Failed to fetch Slovak labels" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const useHtml = url.searchParams.get("html") === "true";
    const forceUpdate = url.searchParams.get("update") === "true";

    let labels: LabelData[] = [];

    // Always use text parsing for extraction, but fetch HTML for bold detection if requested
    const textContent = await fetchTextDocument();
    labels = extractSlovakLabelsFromText(textContent);
    
    console.log(`Found ${labels.length} Slovak labels from text`);
    
    // If HTML mode, also get bold classes for allergen marking
    if (useHtml && labels.length > 0) {
      const { html, boldClasses } = await fetchHtmlDocument();
      console.log(`Found ${boldClasses.length} bold CSS classes for allergen detection`);
      
      // Re-process with HTML bold detection
      if (boldClasses.length > 0) {
        labels = labels.map(label => {
          const nameEscaped = label.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const productHtmlMatch = html.match(new RegExp(`${nameEscaped}[\\s\\S]*?(?=<p[^>]*>[A-Z]{1,2}\\d{2,3}|$)`, 'i'));
          if (productHtmlMatch) {
            return {
              ...label,
              ingredients: markBoldText(label.ingredients, productHtmlMatch[0], boldClasses),
            };
          }
          return label;
        });
      }
    }

    console.log(`Found ${labels.length} Slovak labels to import`);

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      matched: 0,
      errors: [] as string[],
    };

    for (const label of labels) {
      try {
        // Try to find matching Czech product name
        let czechName = slovakToCzechMap[label.name];
        
        if (!czechName) {
          // Try fuzzy matching by looking for similar names
          const possibleMatch = Object.entries(slovakToCzechMap).find(([sk]) => 
            label.name.toLowerCase().includes(sk.toLowerCase().split(' ')[0]) ||
            sk.toLowerCase().includes(label.name.toLowerCase().split(' ')[0])
          );
          
          if (!possibleMatch) {
            results.errors.push(`No Czech match for: ${label.name}`);
            results.skipped++;
            continue;
          }
          
          // Extract Czech name from the found match
          czechName = possibleMatch[1];
        }

        const productName = czechName;

        // Check if Czech label exists for this product
        const czechLabel = await prisma.productLabel.findFirst({
          where: {
            productName: {
              contains: productName.split(' ')[0],
              mode: 'insensitive',
            },
            language: "cs",
          },
        });

        if (!czechLabel) {
          results.errors.push(`No Czech label found for: ${productName}`);
          results.skipped++;
          continue;
        }

        results.matched++;

        // Check if Slovak label already exists
        const existingLabel = await prisma.productLabel.findFirst({
          where: {
            productName: czechLabel.productName,
            language: "sk",
          },
        });

        if (existingLabel) {
          if (forceUpdate) {
            await prisma.productLabel.update({
              where: { id: existingLabel.id },
              data: {
                nazev: label.name,
                slozeni: label.ingredients,
                nutricniHodnoty: label.nutritionalValues,
                skladovani: label.storage,
                vyrobce: label.producer,
              },
            });
            results.updated++;
          } else {
            results.skipped++;
          }
        } else {
          await prisma.productLabel.create({
            data: {
              productName: czechLabel.productName,
              nazev: label.name,
              slozeni: label.ingredients,
              nutricniHodnoty: label.nutritionalValues,
              skladovani: label.storage,
              vyrobce: label.producer,
              language: "sk",
            },
          });
          results.created++;
        }
      } catch (error) {
        console.error(`Error processing label ${label.name}:`, error);
        results.errors.push(`Error processing: ${label.name}`);
      }
    }

    return NextResponse.json({
      message: "Slovak labels import completed",
      totalFound: labels.length,
      ...results,
    });
  } catch (error) {
    console.error("Error importing Slovak labels:", error);
    return NextResponse.json(
      { error: "Failed to import Slovak labels" },
      { status: 500 }
    );
  }
}
