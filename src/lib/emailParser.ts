/**
 * Parser for Shoptet order confirmation emails (vsebezlepku.cz)
 */

export interface ParsedOrderItem {
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: string;
  productUrl?: string;
}

export interface ParsedOrder {
  orderNumber: string;
  orderDate: Date;
  totalPrice?: string;
  items: ParsedOrderItem[];
}

export function parseShoptetEmail(htmlContent: string): ParsedOrder {
  // 1. Order Number
  const orderNumMatch = htmlContent.match(/Číslo objednávky:\s*([A-Za-z0-9_-]+)/i)
                     || htmlContent.match(/Variabilní symbol(?: platby)?:\s*([A-Za-z0-9_-]+)/i);
  if (!orderNumMatch) {
    throw new Error("Číslo objednávky nebylo nalezeno v těle e-mailu");
  }
  const orderNumber = orderNumMatch[1].trim();

  // 2. Order Date
  const dateMatch = htmlContent.match(/Datum objednávky:\s*([0-9.]+)/i);
  let orderDate = new Date();
  if (dateMatch) {
    const parts = dateMatch[1].split(".").map(s => s.trim());
    if (parts.length >= 3) {
      orderDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
  }

  // 3. Search inside the "Obsah objednávky" section to prevent matching header links
  let itemsSection = htmlContent;
  const orderContentIdx = htmlContent.indexOf("Obsah objednávky");
  if (orderContentIdx !== -1) {
    itemsSection = htmlContent.substring(orderContentIdx);
  }

  // 4. Parse items
  // Matches: <a ... href="URL">NAME</a> ... Množství: QTY ks ... Cena za m. j.: PRICE Kč ... Kód: CODE
  const itemRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?Množství:\s*(\d+)\s*ks[\s\S]*?Cena za m\.\s*j\.:\s*([\d\s,]+)\s*Kč[\s\S]*?Kód:\s*([A-Za-z0-9_-]+)/gi;

  const items: ParsedOrderItem[] = [];
  let match;
  let totalSum = 0;

  while ((match = itemRegex.exec(itemsSection)) !== null) {
    const productUrl = match[1].trim();
    const productName = match[2]
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    const quantity = parseInt(match[3], 10);
    const unitPriceNum = parseFloat(match[4].replace(/\s/g, "").replace(",", "."));
    const unitPrice = isNaN(unitPriceNum) ? match[4].trim() + " Kč" : unitPriceNum.toFixed(2).replace(".", ",") + " Kč";
    const productCode = match[5].trim();

    if (!isNaN(unitPriceNum) && quantity > 0) {
      totalSum += unitPriceNum * quantity;
    }

    items.push({
      productName,
      productCode,
      quantity,
      unitPrice,
      productUrl: productUrl.startsWith("http") ? productUrl : `https://www.vsebezlepku.cz${productUrl}`
    });
  }

  const totalPrice = totalSum > 0 ? totalSum.toFixed(2).replace(".", ",") + " Kč" : undefined;

  return {
    orderNumber,
    orderDate,
    totalPrice,
    items
  };
}
