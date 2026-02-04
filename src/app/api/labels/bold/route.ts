import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Common allergens in Czech that should be bold (EU regulation)
const ALLERGEN_PATTERNS: [RegExp, string][] = [
  // Eggs
  [/\bvejce\b/gi, "**vejce**"],
  [/\bvajec\b/gi, "**vajec**"],
  [/\bvaječný\b/gi, "**vaječný**"],
  [/\bvaječné\b/gi, "**vaječné**"],
  [/\bvaječného\b/gi, "**vaječného**"],
  [/\bvaječným\b/gi, "**vaječným**"],
  [/\bvaječná\b/gi, "**vaječná**"],
  [/\bvaječnou\b/gi, "**vaječnou**"],
  [/\bvaječných\b/gi, "**vaječných**"],
  [/\bžloutek\b/gi, "**žloutek**"],
  [/\bžloutku\b/gi, "**žloutku**"],
  [/\bžloutkem\b/gi, "**žloutkem**"],
  [/\bbílek\b/gi, "**bílek**"],
  [/\bbílku\b/gi, "**bílku**"],
  [/\bbílkem\b/gi, "**bílkem**"],
  
  // Milk and dairy
  [/\bmléko\b/gi, "**mléko**"],
  [/\bmléka\b/gi, "**mléka**"],
  [/\bmlékem\b/gi, "**mlékem**"],
  [/\bmléce\b/gi, "**mléce**"],
  [/\bmléčný\b/gi, "**mléčný**"],
  [/\bmléčné\b/gi, "**mléčné**"],
  [/\bmléčného\b/gi, "**mléčného**"],
  [/\bmléčných\b/gi, "**mléčných**"],
  [/\bmléčná\b/gi, "**mléčná**"],
  [/\bmléčnou\b/gi, "**mléčnou**"],
  [/\blaktóza\b/gi, "**laktóza**"],
  [/\blaktózy\b/gi, "**laktózy**"],
  [/\blaktózu\b/gi, "**laktózu**"],
  [/\blaktózou\b/gi, "**laktózou**"],
  [/\bsyrovátka\b/gi, "**syrovátka**"],
  [/\bsyrovátky\b/gi, "**syrovátky**"],
  [/\bsyrovátkou\b/gi, "**syrovátkou**"],
  [/\bsmetana\b/gi, "**smetana**"],
  [/\bsmetany\b/gi, "**smetany**"],
  [/\bsmetanou\b/gi, "**smetanou**"],
  [/\bmáslo\b/gi, "**máslo**"],
  [/\bmásla\b/gi, "**másla**"],
  [/\bmáslem\b/gi, "**máslem**"],
  [/\bjogurt\b/gi, "**jogurt**"],
  [/\bjogurtu\b/gi, "**jogurtu**"],
  [/\bjogurtem\b/gi, "**jogurtem**"],
  [/\bricotta\b/gi, "**ricotta**"],
  [/\bricotty\b/gi, "**ricotty**"],
  [/\bricottou\b/gi, "**ricottou**"],
  
  // Soy
  [/\bsója\b/gi, "**sója**"],
  [/\bsóji\b/gi, "**sóji**"],
  [/\bsóju\b/gi, "**sóju**"],
  [/\bsójou\b/gi, "**sójou**"],
  [/\bsójový\b/gi, "**sójový**"],
  [/\bsójové\b/gi, "**sójové**"],
  [/\bsójového\b/gi, "**sójového**"],
  [/\bsójová\b/gi, "**sójová**"],
  [/\bsójovou\b/gi, "**sójovou**"],
  [/\bsojový lecitin\b/gi, "**sojový lecitin**"],
  [/\bsójový lecitin\b/gi, "**sójový lecitin**"],
  
  // Nuts
  [/\boříšky\b/gi, "**oříšky**"],
  [/\boříšků\b/gi, "**oříšků**"],
  [/\boříškem\b/gi, "**oříškem**"],
  [/\bořechy\b/gi, "**ořechy**"],
  [/\bořechů\b/gi, "**ořechů**"],
  [/\bořechem\b/gi, "**ořechem**"],
  [/\bořech\b/gi, "**ořech**"],
  [/\blískové\b/gi, "**lískové**"],
  [/\blískových\b/gi, "**lískových**"],
  [/\blískovými\b/gi, "**lískovými**"],
  [/\bmandle\b/gi, "**mandle**"],
  [/\bmandlí\b/gi, "**mandlí**"],
  [/\bmandlemi\b/gi, "**mandlemi**"],
  [/\bpistácie\b/gi, "**pistácie**"],
  [/\bpistácií\b/gi, "**pistácií**"],
  [/\bpistáciemi\b/gi, "**pistáciemi**"],
  [/\bvlašské\b/gi, "**vlašské**"],
  [/\bvlašských\b/gi, "**vlašských**"],
  [/\bkešu\b/gi, "**kešu**"],
  [/\barašídy\b/gi, "**arašídy**"],
  [/\barašídů\b/gi, "**arašídů**"],
  [/\barašídové\b/gi, "**arašídové**"],
  [/\barašíd\b/gi, "**arašíd**"],
  
  // Cereals with gluten (wheat, rye, barley, oats)
  [/\bpšenice\b/gi, "**pšenice**"],
  [/\bpšeničný\b/gi, "**pšeničný**"],
  [/\bpšeničné\b/gi, "**pšeničné**"],
  [/\bpšeničného\b/gi, "**pšeničného**"],
  [/\bpšeničná\b/gi, "**pšeničná**"],
  [/\bpšeničnou\b/gi, "**pšeničnou**"],
  [/\bžito\b/gi, "**žito**"],
  [/\bžita\b/gi, "**žita**"],
  [/\bžitný\b/gi, "**žitný**"],
  [/\bžitné\b/gi, "**žitné**"],
  [/\bječmen\b/gi, "**ječmen**"],
  [/\bječmene\b/gi, "**ječmene**"],
  [/\bječný\b/gi, "**ječný**"],
  [/\bječné\b/gi, "**ječné**"],
  [/\boves\b/gi, "**oves**"],
  [/\bovsa\b/gi, "**ovsa**"],
  [/\bovsem\b/gi, "**ovsem**"],
  [/\bovsený\b/gi, "**ovsený**"],
  [/\bovsené\b/gi, "**ovsené**"],
  [/\bovesný\b/gi, "**ovesný**"],
  [/\bovesné\b/gi, "**ovesné**"],
  [/\bovesná\b/gi, "**ovesná**"],
  [/\bovesnou\b/gi, "**ovesnou**"],
  
  // Celery
  [/\bceler\b/gi, "**celer**"],
  [/\bceleru\b/gi, "**celeru**"],
  [/\bcelerem\b/gi, "**celerem**"],
  [/\bcelerový\b/gi, "**celerový**"],
  [/\bcelerové\b/gi, "**celerové**"],
  
  // Mustard
  [/\bhořčice\b/gi, "**hořčice**"],
  [/\bhořčici\b/gi, "**hořčici**"],
  [/\bhořčicí\b/gi, "**hořčicí**"],
  [/\bhořčicový\b/gi, "**hořčicový**"],
  [/\bhořčicové\b/gi, "**hořčicové**"],
  
  // Sesame
  [/\bsezam\b/gi, "**sezam**"],
  [/\bsezamu\b/gi, "**sezamu**"],
  [/\bsezamem\b/gi, "**sezamem**"],
  [/\bsezamový\b/gi, "**sezamový**"],
  [/\bsezamové\b/gi, "**sezamové**"],
  [/\bsezamová\b/gi, "**sezamová**"],
  [/\bsezamových\b/gi, "**sezamových**"],
  [/\bsezamovými\b/gi, "**sezamovými**"],
  
  // Sulphites
  [/\bsiřičitany\b/gi, "**siřičitany**"],
  [/\bsiřičitanů\b/gi, "**siřičitanů**"],
  [/\bsiřičitan\b/gi, "**siřičitan**"],
  [/\bsírany\b/gi, "**sírany**"],
  
  // Lupin
  [/\blupina\b/gi, "**lupina**"],
  [/\blupiny\b/gi, "**lupiny**"],
  [/\blupinu\b/gi, "**lupinu**"],
  [/\blupinová\b/gi, "**lupinová**"],
  [/\blupinové\b/gi, "**lupinové**"],
  [/\blupinový\b/gi, "**lupinový**"],
  
  // Fish
  [/\bryby\b/gi, "**ryby**"],
  [/\bryb\b/gi, "**ryb**"],
  [/\brybí\b/gi, "**rybí**"],
  [/\brybou\b/gi, "**rybou**"],
  
  // Crustaceans
  [/\bkorýši\b/gi, "**korýši**"],
  [/\bkorýšů\b/gi, "**korýšů**"],
  
  // Molluscs
  [/\bměkkýši\b/gi, "**měkkýši**"],
  [/\bměkkýšů\b/gi, "**měkkýšů**"],
];

function addBoldToAllergens(text: string): string {
  if (!text) return text;
  
  // Skip if already has bold markers
  if (text.includes("**")) return text;
  
  let result = text;
  
  for (const [pattern, replacement] of ALLERGEN_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  
  return result;
}

export async function POST() {
  try {
    const labels = await prisma.productLabel.findMany();
    
    const updates: { id: string; nazev: string; before: string; after: string }[] = [];
    
    for (const label of labels) {
      const newSlozeni = addBoldToAllergens(label.slozeni);
      
      if (newSlozeni !== label.slozeni) {
        await prisma.productLabel.update({
          where: { id: label.id },
          data: { slozeni: newSlozeni },
        });
        updates.push({
          id: label.id,
          nazev: label.nazev,
          before: label.slozeni.substring(0, 100) + "...",
          after: newSlozeni.substring(0, 100) + "...",
        });
      }
    }
    
    return NextResponse.json({
      total: labels.length,
      updated: updates.length,
      updates: updates.slice(0, 10), // Show first 10 examples
    });
  } catch (error) {
    console.error("Bold allergens update error:", error);
    return NextResponse.json(
      { error: "Failed to update labels" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const labels = await prisma.productLabel.findMany();
    
    const wouldUpdate: { nazev: string; example: string }[] = [];
    
    for (const label of labels) {
      const newSlozeni = addBoldToAllergens(label.slozeni);
      
      if (newSlozeni !== label.slozeni) {
        wouldUpdate.push({
          nazev: label.nazev,
          example: newSlozeni.substring(0, 150) + "...",
        });
      }
    }
    
    return NextResponse.json({
      total: labels.length,
      wouldUpdate: wouldUpdate.length,
      alreadyHasBold: labels.length - wouldUpdate.length,
      preview: wouldUpdate.slice(0, 10),
    });
  } catch (error) {
    console.error("Bold allergens preview error:", error);
    return NextResponse.json(
      { error: "Failed to preview labels" },
      { status: 500 }
    );
  }
}
