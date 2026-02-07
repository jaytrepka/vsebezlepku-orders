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
  "ATTIMI LIESKOVOORIEŠKOVÉ KOLÁČIKY 120g": "ATTIMI KŘEHKÉ LÍSKOOŘÍŠKOVÉ KOLÁČKY 120g",
  "BAGETA KLASICKÁ 175g": "BAGETA KLASICKÁ 175g",
  "BAGETA RUSTIKÁLNA 175g": "BAGETA RUSTIKÁLNÍ 175g",
  "BIELE MINI CROISSANT 200g": "BÍLÉ MINI CROISSANTY 200g",
  "BROWNIES 200g": "BROWNIES 200g",
  "BROWNIES 200 g": "BROWNIES 200g",
  "BRUSCHETTINE Mediterranee 100 g": "BRUSCHETTINE Mediterranee 100g",
  "BRUSCHETTINE Mediterranee 100g": "BRUSCHETTINE Mediterranee 100g",
  "BRUSCHETTINE s paprikou a čili 100g": "BRUSCHETTINE s paprikou a chilli 100g",
  "BRUŠETÍN s paprikou a chilli 100 g": "BRUSCHETTINE s paprikou a chilli 100g",
  "CANNELLONI": "CANNELLONI",
  "CANTUCCINI 200g": "CANTUCCINI 200g",
  "CANTUCCI 200 g": "CANTUCCI 200g",
  "CANTUCCI 200g": "CANTUCCI 200g",
  "CEREÁLIA MEDOVEJ KRÚŽKY 300g": "CEREÁLIE MEDOVÉ KROUŽKY 300g",
  "CEREÁLNE DÚHOVÉ KRÚŽKY 300g": "CEREÁLIE DUHOVÉ KROUŽKY 300g",
  "CEREÁLNE MEDOVÉ GULIČKY 300g": "CEREÁLIE MEDOVÉ KROUŽKY 300g",
  "CEREÁLNE TYČINKY ČOKOLÁDOVÉ 129g (6ks)": "CEREÁLNÍ TYČINKY ČOKOLÁDOVÉ 129g (6ks)",
  "CEREÁLNE TYČINKY S BRUSNICAMI 129g (6ks)": "CEREÁLNÍ TYČINKY S BRUSINKAMI 129g (6ks)",
  "CIABATTA 200g": "CIABATTA 200g",
  "CIOCOPUNTA PISTACHIO MINIKORNÚTKY 108g (6ks)": "CIOCOPUNTA PISTÁCIOVÉ MINIKORNOUTKY 108g",
  "CIOCOMIX MINICOOKIES 200g": "CIOCOMIX MINICOOKIES 200g",
  "CIOCOMIX TYČINKY (120g)": "Piaceri Mediterranei bezlepkové CIOCOMIX TYČINKY 120g (6ks)",
  "CORNETTI CROISSANTY S ČOKOLÁDOU 250g (5ks)": "CORNETTI S ČOKOLÁDOU 250g (5ks)",
  "CORNETTI CROISSANTY S MARHUĽAMI 250g (5ks)": "CORNETTI S MERUŇKAMI 250g (5ks)",
  "COUS COUS 375 g": "COUS COUS kukuřičný 375g",
  "COUS COUS 375g": "COUS COUS kukuřičný 375g",
  "CROSTATINE KAKAOVÉ 200g": "CROSTATINE KAKAOVÉ 200g",
  "CROSTATINE MARHUĽOVÉ 200g": "CROSTATINE MERUŇKOVÉ 200g",
  "CROSTATINE SMOTANOVÉ 200g": "CROSTATINE SMETANOVÉ 200g",
  "CROSTATINE ČOKOLÁDOVÉ 200g": "CROSTATINE ČOKOLÁDOVÉ 200g",
  "ČOKOLÁDOVÉ SRDIEČKA BATTITI 200g": "Piaceri Mediterranei ČOKOLÁDOVÁ SRDÍČKA BATTITI 200g",
  "ČOKOLÁDOVÝ CHLIEB 250g": "ČOKOLÁDOVÝ CHLÉB 250g",
  "DONUTY BIELE 90g": "Piaceri Mediterranei DONUTY BÍLÉ 90g",
  "DONUTY Orieškové 90g": "Piaceri Mediterranei DONUTY OŘÍŠKOVÉ 90g",
  "DONUTY RUZOVE 90g": "DONUTY S BÍLOU POLEVOU 80g",
  "ELISEO krémové sušienky 200g": "ELISEO 200g",
  "ELISEO s BIELOU ČOKOLÁDOU 200g": "ELISEO s BÍLOU ČOKOLÁDOU 200g",
  "FROLLINI KAKAO 200g": "FROLLINI KAKAO 200g",
  "FROLLINI S ČOKOLÁDOVÝMI LUPIENKAMI 200g": "FROLLINI S ČOKOLÁDOVÝMI LUPÍNKY 200g",
  "GNOCCHI 400g (2x200g)": "GNOCCHI 200g",
  "GOLOMIX KAKAOVÉ SUŠIENKY S HVIEZD. 200g": "Piaceri Mediterranei GOLOMIX KAKAOVÉ SUŠENKY s hvězdičkami 200g",
  "GRISSINI TYČINKY klasické 150g": "GRISSINI TYČINKY klasické 150g",
  "GRISSINI TYČINKY s olivovým olejom 150g": "GRISSINI TYČINKY s olivovým olejem 150g",
  "GRISSINI TYČINKY s rozmarínom 150g": "GRISSINI TYČINKY s rozmarýnem 150g",
  "GRISSINI TYČINKY sézamové 150g": "GRISSINI TYČINKY sezamové 150g",
  "GRISSINI TYČINKY 160g": "Piaceri Mediterranei GRISSINI TYČINKY 160g",
  "HARMÓNIA – sušienky s kúskami čokolády 200g": "HARMONIE – sušenky s kousky čokolády 200g",
  "JOGURTOVÉ SUŠIENKY S 5 CEREÁLIAMI 200g": "Piaceri Mediterranei JOGURTOVÉ SUŠENKY S 5 CEREÁLIEMI 200g",
  "JOGURTOVÉ SUŠIENKY S MALINAMI 210g": "Piaceri Mediterranei JOGURTOVÉ SUŠENKY S MALINAMI 210g",
  "KAKAOVÉ CROISSANTY 200g": "KAKAOVÉ CROISSANTY 200g",
  "KLASICKÉ CROISSANTY 200g": "KLASICKÉ CROISSANTY 200g",
  "KOSTKY s mliečnou čokoládou 200g": "KOSTKY s mléčnou čokoládou 200g",
  "MIRTILLINI sušienky s čučoriedkami 200g": "MIRTILLINI sušenky s borůvkami 200g",
  "MUFFINY S OVOCNOU NÁPLNOU (200g)": "Piaceri Mediterranei bezlepkové MUFFINY S OVOCNOU NÁPLNÍ 200g (4ks)",
  "MUFFINY S ČOKOLÁDOVÝMI KÚSKAMI 200g": "MUFFIN S ČOKOLÁDOVÝMI KOUSKY 200g",
  "OPLATKY S LIESKOORÍŠKOVOU PRÍCHUTOU 45g": "Piaceri Mediterranei OPLATKY S LÍSKOOŘÍŠKOVOU PŘÍCHUTÍ 45g",
  "OPLATKY S VANILKOVOU PRÍCHUTOU 45g": "Piaceri Mediterranei OPLATKY S VANILKOVOU PŘÍCHUTÍ 45g",
  "PAVONETTI – krehké sušienky 140g": "PAVONETTI - bezlepkové křehké sušenky 140g",
  "PIACERINI DUNE BIELA ​​33g": "Piaceri Mediterranei PIACERINI TYČINKA DUNE WHITE 33g",
  "PIACERINI TYČINKA DUNE DARK 33g": "Piaceri Mediterranei PIACERINI BEZLEPKOVÁ TYČINKA DUNE DARK (33g)  bez lepku, bez palmového oleje",
  "PIACERINI TYČINKA DUNE WHITE 33g": "Piaceri Mediterranei PIACERINI TYČINKA DUNE WHITE 33g",
  "PISTÁCIOVÉ DONUTY (90g)": "Piaceri Mediterranei bezlepkové DONUTY PISTÁCIOVÉ 90g",
  "PISTÁCIOVÉ OPLATKY 150g": "PISTÁCIOVÉ OPLATKY 150g",
  "PLNENÉ WAFLE S KRÉMOM GIANDUIA 150g": "PLNĚNÉ OPLATKY S KRÉMEM GIANDUIA 150g",
  "PLNENÉ WAFLE S LIESKOVOORIEŠKOVOU NÁPLŇOU 175g": "PLNĚNÉ OPLATKY S LÍSKOOŘÍŠKOVOU NÁPLNÍ 175g",
  "POLENTA hrubozrnná 500g": "POLENTA hrubozrnná 500g",
  "POLENTA jemnozrnná 500g": "POLENTA jemnozrnná 500g",
  "SAVOIARDI PIŠKÓTY 150g": "SAVOIARDI PIŠKOTY 150g",
  "SFIZI BBQ 100g": "Piaceri Mediterranei SFIZI BBQ KŘUPKY 100g",
  "SFOGLIATINE S MARHUĽOVOU GLAZÚROU 150g": "SFOGLIATINE KŘEHKÉ SUŠENKY S MERUŇKOVOU GLAZUROU 150g",
  "SLANÉ KREKRY 175g": "SLANÉ KREKRY 175g",
  "SUŠIENKY CANESTRELLI 125g": "Piaceri Mediterranei bezlepkové KYTIČKOVÉ SUŠENKY CANESTRELLI 125g",
  "SUŠIENKY S KARAMELOM 200g": "SUŠENKY S KARAMELEM 200g",
  "TARALLI klasické 200g": "TARALLI klasické 200g",
  "TARALLI MEDITERRANEAN 200g": "TARALLI MEDITERRANEAN 200g",
  "TARALLI s extra virgin olivovým olejom 200g": "TARALLI S EXTRA PANENSKÝM OLIVOVÝM OLEJEM 200g",
  "TARALLINI SLADKÉ 200g": "TARALLINI SLADKÉ 200g",
  "TOAST CELOZRNNÝ 400g": "TOUST CELOZRNNÝ 400g",
  "TOAST KLASICKÝ 400g": "TOUST KLASICKÝ 400g",
  "TOAST RUSTIKÁLNY 400g": "TOUST RUSTIKÁLNÍ 400g",
  "TORTELLINI PROSCIUTTO CRUDO 250g": "Piaceri Mediterranei TORTELLINI PROSCIUTTO CRUDO 250g (2 porce)",
  "TORTELLINI S MÄSOM 250g (2 porcie)": "Piaceri Mediterranei TORTELLINI S MASEM 250g (2 porce)",
  "TORTELLONI S RICOTTOU A ŠPENÁTOM 250g (2 porcie)": "Piaceri Mediterranei TORTELLONI S RICOTTOU A ŠPENÁTEM 250g (2 porce)",
  "VEGÁNSKE PIŠKÓTY 150g": "VEGANSKÉ PIŠKOTY 150g",
  "VENTAGLIETTI - bezlepkové krehké vejáriky 140g": "VENTAGLIETTI - bezlepkové křehké vějířky 140g",
  "BIELÝ BEZLEPKOVÝ KRÁJENÝ CHLIEB (300g)": "Piaceri Mediterranei BÍLÝ BEZLEPKOVÝ KRÁJENÝ CHLÉB (300g)",
  "RUSTIKÁLNY BEZLEPKOVÝ KRÁJENÝ CHLIEB (300g)": "Piaceri Mediterranei RUSTIKÁLNÍ BEZLEPKOVÝ KRÁJENÝ CHLÉB (300g)",
  "WRAP (180 g)": "Piaceri Mediterranei bezlepkový WRAP 180g (3ks)",
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
    // Find all class definitions with font-weight:700 (handles c2, c11, c17, etc.)
    const classRegex = /\.(c\d+)\s*\{[^}]*font-weight:\s*700[^}]*\}/g;
    let match;
    while ((match = classRegex.exec(cssContent)) !== null) {
      boldClasses.push(match[1]);
    }
    // Also check for shorthand declarations like .c17{font-weight:700}
    const shorthandRegex = /\.(c\d+)\s*\{\s*font-weight:\s*700\s*[;}]/g;
    while ((match = shorthandRegex.exec(cssContent)) !== null) {
      if (!boldClasses.includes(match[1])) {
        boldClasses.push(match[1]);
      }
    }
    // Check for combined declarations like .c5{font-size:8pt;font-weight:700}
    const combinedRegex = /\.(c\d+)\s*\{[^}]*font-weight:\s*700/g;
    while ((match = combinedRegex.exec(cssContent)) !== null) {
      if (!boldClasses.includes(match[1])) {
        boldClasses.push(match[1]);
      }
    }
  }
  
  console.log('Found bold classes:', boldClasses);
  return { html, boldClasses };
}

async function fetchTextDocument(): Promise<string> {
  const response = await fetch(DOC_URL_TXT);
  return await response.text();
}

// Czech to Slovak allergen translation map
const allergenTranslations: Record<string, string[]> = {
  // Czech allergen -> Slovak equivalents (all forms)
  'vejce': ['vajcia', 'vajce', 'vajec', 'vaječný', 'vaječné', 'vaječná', 'vaječných', 'vaječnom', 'vajíčka'],
  'vaječný': ['vaječný', 'vaječné', 'vaječná', 'vaječných', 'vaječnom'],
  'mléko': ['mlieko', 'mlieka', 'mliečny', 'mliečna', 'mliečne', 'mliečnych', 'mliečneho'],
  'mléčný': ['mliečny', 'mliečna', 'mliečne', 'mliečnych', 'mliečneho', 'mliečnej'],
  'ořechy': ['orechy', 'orechov', 'orech', 'orechový', 'orechová', 'orechové', 'orechových', 'oriešky', 'orieškov'],
  'ořech': ['orech', 'orechy', 'orechov', 'orechový', 'orechová', 'orechové', 'oriešok', 'oriešky'],
  'oříšky': ['oriešky', 'orieškov', 'oriešok', 'orechy', 'orechov'],
  'lískové ořechy': ['lieskové orechy', 'lieskovoorieškový', 'lieskovoorieškové', 'lieskovoorieškových', 'lieskovými orechmi', 'lieskové oriešky'],
  'mandle': ['mandle', 'mandlí', 'mandľový', 'mandľová', 'mandľové', 'mandľových', 'mandliach'],
  'sója': ['sója', 'sóji', 'sójový', 'sójová', 'sójové', 'sójových', 'sójou', 'sóju'],
  'sójový': ['sójový', 'sójová', 'sójové', 'sójových', 'sójou'],
  'sóju': ['sóju', 'sója', 'sóji', 'sójou'],
  'sezam': ['sezam', 'sezamu', 'sezamový', 'sezamová', 'sezamové', 'sezamových', 'sezamovými'],
  'sezamový': ['sezamový', 'sezamová', 'sezamové', 'sezamových', 'sezamovými', 'sezamových'],
  'lepek': ['lepok', 'lepku', 'lepkový', 'lepková', 'lepkové'],
  'pšenice': ['pšenica', 'pšenice', 'pšeničný', 'pšeničná', 'pšeničné', 'pšeničných'],
  'oves': ['ovos', 'ovsa', 'ovsený', 'ovsená', 'ovsené', 'ovseným', 'ovsených'],
  'ječmen': ['jačmeň', 'jačmeňa', 'jačmenný', 'jačmenná', 'jačmenné'],
  'žito': ['raž', 'raži', 'ražný', 'ražná', 'ražné'],
  'máslo': ['maslo', 'masla', 'maslový', 'maslová', 'maslové', 'maslom'],
  'maslo': ['maslo', 'masla', 'maslový', 'maslová', 'maslové', 'maslom'],
  'ryba': ['ryba', 'ryby', 'rýb', 'rybí', 'rybie', 'rybou'],
  'korýši': ['kôrovce', 'kôrovcov'],
  'měkkýši': ['mäkkýše', 'mäkkýšov'],
  'hořčice': ['horčica', 'horčice', 'horčičný', 'horčičná', 'horčičné', 'horčicu'],
  'hořčici': ['horčicu', 'horčica', 'horčice'],
  'celer': ['zeler', 'zeleru', 'zelerový', 'zelerová', 'zelerové'],
  'vlčí bob': ['vlčí bôb', 'vlčieho bôbu', 'lupina', 'lupinový', 'lupinová', 'lupinové', 'lupinovou'],
  'lupina': ['lupina', 'lupinový', 'lupinová', 'lupinové', 'lupinovou', 'lupinových'],
  'lupinová': ['lupinová', 'lupinový', 'lupinové', 'lupinovou', 'lupinových'],
  'arašídy': ['arašidy', 'arašidov', 'arašidový', 'arašidová', 'arašidové'],
  'kakao': ['kakao', 'kakaa', 'kakaový', 'kakaová', 'kakaové', 'kakaovým', 'kakaové'],
  'kakaové': ['kakaové', 'kakaový', 'kakaová', 'kakaovým'],
  'lecithin': ['lecitín', 'lecitínu', 'lecitínový', 'lecitínová'],
  'lecitin': ['lecitín', 'lecitínu', 'lecitínový', 'lecitínová'],
  'smetana': ['smotana', 'smotany', 'smotanový', 'smotanová', 'smotanové'],
  'bílek': ['bielok', 'bielka', 'bielkový', 'bielková'],
  'bílkoviny': ['bielkoviny', 'bielkovín', 'bielkovinový', 'bielkovinová'],
  'pistácie': ['pistácie', 'pistácií', 'pistáciový', 'pistáciová', 'pistáciové', 'pistáciových'],
  // Common simple forms
  'vajec': ['vajec', 'vajcia', 'vajce'],
  'mléka': ['mlieka', 'mlieko'],
  'ořechů': ['orechov', 'orechy', 'orieškov', 'oriešky'],
};

// Extract bold allergens from Czech text and apply to Slovak text
function transferBoldAllergens(slovakText: string, czechText: string): string {
  if (!czechText) return slovakText;
  
  // Extract bolded words from Czech text
  const boldRegex = /\*\*([^*]+)\*\*/g;
  const czechBoldWords: string[] = [];
  let match;
  while ((match = boldRegex.exec(czechText)) !== null) {
    czechBoldWords.push(match[1].toLowerCase());
  }
  
  if (czechBoldWords.length === 0) return slovakText;
  
  let result = slovakText;
  
  // For each Czech bold word, find and bold Slovak equivalents
  for (const czechWord of czechBoldWords) {
    // Check direct translations
    for (const [csKey, skVariants] of Object.entries(allergenTranslations)) {
      if (czechWord.includes(csKey.toLowerCase()) || csKey.toLowerCase().includes(czechWord)) {
        for (const skWord of skVariants) {
          // Match the Slovak word - use lookahead/lookbehind for word boundaries
          // that work with Slovak diacritics
          const escapedSk = skWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Match word not already bolded, with space/punctuation boundaries
          const skRegex = new RegExp(`(?<!\\*\\*|[a-záäčďéěíĺľňóôŕšťúůýžA-ZÁÄČĎÉĚÍĹĽŇÓÔŔŠŤÚŮÝŽ])(${escapedSk})(?![a-záäčďéěíĺľňóôŕšťúůýžA-ZÁÄČĎÉĚÍĹĽŇÓÔŔŠŤÚŮÝŽ]|\\*\\*)`, 'gi');
          result = result.replace(skRegex, '**$1**');
        }
      }
    }
  }
  
  // Clean up any double bold markers
  result = result.replace(/\*\*\*\*+/g, '**');
  
  return result;
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
  // Extend partial matches to full words
  let result = text;
  for (const word of boldWords) {
    // Escape special regex characters
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the bold fragment and extend to the full word (including Slovak diacritics)
    // This captures any word characters before and after the bold fragment
    const fullWordRegex = new RegExp(`(?<!\\*\\*)([a-záäčďéěíĺľňóôŕšťúůýžA-ZÁÄČĎÉĚÍĹĽŇÓÔŔŠŤÚŮÝŽ]*${escaped}[a-záäčďéěíĺľňóôŕšťúůýžA-ZÁÄČĎÉĚÍĹĽŇÓÔŔŠŤÚŮÝŽ]*)(?!\\*\\*)`, 'g');
    result = result.replace(fullWordRegex, '**$1**');
  }
  
  // Clean up any double bold markers
  result = result.replace(/\*\*\*\*+/g, '**');
  
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

    // Fetch all Czech labels for nutritional value matching
    const allCzechLabels = await prisma.productLabel.findMany({
      where: { language: "cs" },
    });

    // Helper function to extract numbers from nutritional values for comparison
    function extractNutritionNumbers(text: string): string[] {
      if (!text) return [];
      // Extract all numbers with optional decimals
      const matches = text.match(/\d+[,.]?\d*/g) || [];
      return matches.map(n => n.replace(',', '.'));
    }

    // Helper function to compare nutritional values
    function nutritionMatch(sk: string, cs: string): boolean {
      const skNumbers = extractNutritionNumbers(sk);
      const csNumbers = extractNutritionNumbers(cs);
      if (skNumbers.length < 3 || csNumbers.length < 3) return false;
      // Compare first 5 numbers (energy, fat, saturated, carbs, sugars)
      let matches = 0;
      for (let i = 0; i < Math.min(5, skNumbers.length, csNumbers.length); i++) {
        if (skNumbers[i] === csNumbers[i]) matches++;
      }
      return matches >= 4; // At least 4 out of 5 numbers must match
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      matched: 0,
      matchedByNutrition: 0,
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
          
          if (possibleMatch) {
            czechName = possibleMatch[1];
          }
        }

        let czechLabel = null;

        if (czechName) {
          // Check if Czech label exists for this product
          czechLabel = await prisma.productLabel.findFirst({
            where: {
              productName: {
                contains: czechName.split(' ')[0],
                mode: 'insensitive',
              },
              language: "cs",
            },
          });
        }

        // If no match by name, try matching by nutritional values
        if (!czechLabel && label.nutritionalValues) {
          for (const csLabel of allCzechLabels) {
            if (nutritionMatch(label.nutritionalValues, csLabel.nutricniHodnoty)) {
              // Additional check: product names should have some similarity
              const skWords = label.name.toLowerCase().split(/\s+/);
              const csWords = csLabel.productName.toLowerCase().split(/\s+/);
              const hasCommonWord = skWords.some(sw => 
                csWords.some(cw => sw.length > 3 && cw.length > 3 && 
                  (sw.includes(cw.substring(0, 4)) || cw.includes(sw.substring(0, 4)))
                )
              );
              if (hasCommonWord) {
                czechLabel = csLabel;
                results.matchedByNutrition++;
                console.log(`Matched by nutrition: "${label.name}" -> "${csLabel.productName}"`);
                break;
              }
            }
          }
        }

        if (!czechLabel) {
          results.errors.push(`No Czech match for: ${label.name}`);
          results.skipped++;
          continue;
        }

        results.matched++;

        // Transfer bold allergens from Czech label to Slovak ingredients
        const slovakIngredientsWithBold = transferBoldAllergens(label.ingredients, czechLabel.slozeni);

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
                slozeni: slovakIngredientsWithBold,
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
              slozeni: slovakIngredientsWithBold,
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
