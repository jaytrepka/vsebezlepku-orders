import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { productUrl } = await request.json();

    if (!productUrl) {
      return NextResponse.json({ error: "Product URL required" }, { status: 400 });
    }

    // Fetch the product page
    const response = await fetch(productUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "cs-CZ,cs;q=0.9",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch product page" }, { status: 500 });
    }

    const html = await response.text();

    // Extract product info from the page
    const productInfo: {
      nazev?: string;
      slozeni?: string;
      nutricniHodnoty?: string;
      skladovani?: string;
      vyrobce?: string;
    } = {};

    // Product name from <h1> or og:title
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                       html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    if (titleMatch) {
      productInfo.nazev = titleMatch[1].trim();
    }

    // Try to find composition/ingredients section
    // Common patterns: "Složení:", "Ingredience:", in description or specific divs
    const slozeniPatterns = [
      /Složení[:\s]*<\/[^>]+>\s*<[^>]+>([^<]+)/i,
      /Složení[:\s]*([^<]+)/i,
      /složení[:\s]*([^<]+)/i,
      /<td[^>]*>Složení<\/td>\s*<td[^>]*>([^<]+)/i,
      /ingredients?[:\s]*([^<]+)/i,
    ];
    
    for (const pattern of slozeniPatterns) {
      const match = html.match(pattern);
      if (match && match[1].length > 10) {
        productInfo.slozeni = match[1].trim().replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
        break;
      }
    }

    // Nutrition values
    const nutriPatterns = [
      /Nutriční hodnoty[^<]*<\/[^>]+>\s*<[^>]+>([^<]+)/i,
      /Energetická hodnota[:\s]*([^<]+)/i,
      /na 100\s*g[:\s]*([^<]+)/i,
    ];
    
    for (const pattern of nutriPatterns) {
      const match = html.match(pattern);
      if (match && match[1].length > 10) {
        productInfo.nutricniHodnoty = match[1].trim().replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
        break;
      }
    }

    // Storage instructions
    const skladPatterns = [
      /Skladování[:\s]*([^<]+)/i,
      /Skladujte[:\s]*([^<]+)/i,
      /storage[:\s]*([^<]+)/i,
    ];
    
    for (const pattern of skladPatterns) {
      const match = html.match(pattern);
      if (match && match[1].length > 5) {
        productInfo.skladovani = match[1].trim();
        break;
      }
    }

    // Manufacturer
    const vyrobcePatterns = [
      /Výrobce[:\s]*([^<]+)/i,
      /Vyrobeno[:\s]*([^<]+)/i,
      /Manufacturer[:\s]*([^<]+)/i,
      /Dovozce[:\s]*([^<]+)/i,
    ];
    
    for (const pattern of vyrobcePatterns) {
      const match = html.match(pattern);
      if (match && match[1].length > 3) {
        productInfo.vyrobce = match[1].trim();
        break;
      }
    }

    return NextResponse.json(productInfo);
  } catch (error) {
    console.error("Product fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch product info" },
      { status: 500 }
    );
  }
}
