import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export function getAuthUrl() {
  const scopes = ["https://www.googleapis.com/auth/gmail.readonly"];
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });
}

export async function getTokensFromCode(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export function setCredentials(tokens: { access_token?: string | null; refresh_token?: string | null }) {
  oauth2Client.setCredentials(tokens);
}

export async function getGmailClient(tokens: { access_token?: string | null; refresh_token?: string | null }) {
  setCredentials(tokens);
  return google.gmail({ version: "v1", auth: oauth2Client });
}

export interface ParsedOrderItem {
  productName: string;
  quantity: number;
  unitPrice?: string;
  productUrl?: string;
}

export interface ParsedOrder {
  orderNumber: string;
  items: ParsedOrderItem[];
  totalPrice?: string;
  emailDate: Date;
  rawEmail: string;
}

export function parseOrderEmail(emailBody: string, emailDate: Date): ParsedOrder | null {
  // Extract order number: O + 9 digits (e.g., O202600072)
  const orderNumberMatch = emailBody.match(/O\d{9}/);
  if (!orderNumberMatch) return null;

  const orderNumber = orderNumberMatch[0];

  // Parse items from the email - Shoptet HTML format
  // Product name is in <a href="productUrl" title="ProductName">ProductName</a>
  // Followed by: Množství: X ks<br /> Cena za m. j.: XXX Kč
  const items: ParsedOrderItem[] = [];

  // Pattern 1: Extract from <a href="..." title="..."> tags followed by quantity
  const htmlPattern = /<a\s+href="([^"]+)"[^>]*title="([^"]+)"[^>]*>[^<]*<\/a>[\s\S]*?Množství:\s*(\d+)\s*ks[\s\S]*?Cena za m\. j\.:\s*(\d+(?:[,.]\d+)?)\s*Kč/gi;
  
  let match;
  while ((match = htmlPattern.exec(emailBody)) !== null) {
    const productUrl = match[1].trim();
    const productName = match[2].trim();
    const quantity = parseInt(match[3], 10);
    const unitPrice = match[4].replace(',', '.') + ' Kč';

    if (productName && productName.length >= 5 && quantity > 0) {
      items.push({ productName, quantity, unitPrice, productUrl });
    }
  }

  // Pattern 2: Try without href if pattern 1 didn't match
  if (items.length === 0) {
    const simpleHtmlPattern = /<a[^>]+title="([^"]+)"[^>]*>[^<]*<\/a>[\s\S]*?Množství:\s*(\d+)\s*ks[\s\S]*?Cena za m\. j\.:\s*(\d+(?:[,.]\d+)?)\s*Kč/gi;
    
    while ((match = simpleHtmlPattern.exec(emailBody)) !== null) {
      const productName = match[1].trim();
      const quantity = parseInt(match[2], 10);
      const unitPrice = match[3].replace(',', '.') + ' Kč';

      if (productName && productName.length >= 5 && quantity > 0) {
        items.push({ productName, quantity, unitPrice });
      }
    }
  }

  // Pattern 3: Fallback for plain text format
  if (items.length === 0) {
    const normalizedBody = emailBody.replace(/[\t ]+/g, ' ');
    const plainPattern = /([A-ZÁ-Ža-zá-ž0-9][A-ZÁ-Ža-zá-ž0-9\s\-\(\)%,\.\/]+?)\s+Množství:\s*(\d+)\s*ks\s+Cena za m\. j\.:\s*(\d+(?:[,.]\d+)?)\s*Kč/g;
    
    while ((match = plainPattern.exec(normalizedBody)) !== null) {
      let productName = match[1].trim().replace(/\s+/g, ' ');
      const quantity = parseInt(match[2], 10);
      const unitPrice = match[3].replace(',', '.') + ' Kč';

      // Clean up product name - remove order number prefix and "Obsah objednávky"
      productName = productName.replace(/^\d{9}\s+Obsah objednávky\s+/i, "");
      productName = productName.replace(/^[A-Z0-9\-]+\s+[\d,\.]+\s*Kč\s+/i, "");
      productName = productName.replace(/^\d+\s+[\d,\.]+\s*Kč\s+/i, "");
      productName = productName.replace(/^\d{6,}\s+/i, "");
      productName = productName.replace(/^Obsah objednávky\s+/i, "");
      productName = productName.trim();

      if (productName && productName.length >= 10 && quantity > 0 && !/^\d+$/.test(productName)) {
        items.push({ productName, quantity, unitPrice });
      }
    }
  }

  // Extract total price
  const totalMatch = emailBody.match(/celkem[:\s]*(\d+[,.]?\d*)\s*Kč/i);
  const totalPrice = totalMatch ? totalMatch[1] + " Kč" : undefined;

  return {
    orderNumber,
    items,
    totalPrice,
    emailDate,
    rawEmail: emailBody,
  };
}

export async function fetchOrderEmails(
  gmail: ReturnType<typeof google.gmail>,
  daysBack: number = 30,
  existingOrderNumbers: string[] = []
): Promise<ParsedOrder[]> {
  // Calculate date for query
  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - daysBack);
  const afterTimestamp = Math.floor(afterDate.getTime() / 1000);
  
  // Search for order confirmations with date filter
  const query = `subject:"Potvrzení objednávky" after:${afterTimestamp}`;
  
  console.log("Gmail query:", query);

  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 100,
  });

  console.log("Gmail response:", response.data.resultSizeEstimate, "results");

  const messages = response.data.messages || [];
  const orders: ParsedOrder[] = [];
  
  // Get subjects of first few emails for debugging
  const debugSubjects: string[] = [];
  for (const message of messages.slice(0, 5)) {
    const fullMessage = await gmail.users.messages.get({
      userId: "me",
      id: message.id!,
      format: "metadata",
      metadataHeaders: ["Subject", "From"],
    });
    const headers = fullMessage.data.payload?.headers || [];
    const subject = headers.find((h) => h.name === "Subject")?.value || "no subject";
    const from = headers.find((h) => h.name === "From")?.value || "no from";
    debugSubjects.push(`${from} | ${subject}`);
  }
  
  // Store debug info to return
  (fetchOrderEmails as any).debugSubjects = debugSubjects;

  for (const message of messages) {
    const fullMessage = await gmail.users.messages.get({
      userId: "me",
      id: message.id!,
      format: "full",
    });

    const headers = fullMessage.data.payload?.headers || [];
    const dateHeader = headers.find((h) => h.name === "Date");
    const emailDate = dateHeader ? new Date(dateHeader.value!) : new Date();

    // Get email body
    let body = "";
    const payload = fullMessage.data.payload;

    if (payload?.body?.data) {
      body = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload?.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/html" && part.body?.data) {
          body = Buffer.from(part.body.data, "base64").toString("utf-8");
          break;
        }
        if (part.mimeType === "text/plain" && part.body?.data) {
          body = Buffer.from(part.body.data, "base64").toString("utf-8");
        }
      }
    }

    if (body) {
      const parsed = parseOrderEmail(body, emailDate);
      if (parsed) {
        // Skip if we already have this order
        if (existingOrderNumbers.includes(parsed.orderNumber)) {
          continue;
        }
        orders.push(parsed);
      }
    }
  }

  return orders;
}
