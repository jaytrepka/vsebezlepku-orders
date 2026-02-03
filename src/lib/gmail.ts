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

export interface ParsedOrder {
  orderNumber: string;
  items: { productName: string; quantity: number; unitPrice?: string }[];
  totalPrice?: string;
  emailDate: Date;
  rawEmail: string;
}

export function parseOrderEmail(emailBody: string, emailDate: Date): ParsedOrder | null {
  // Extract order number: O + 9 digits (e.g., O202600072)
  const orderNumberMatch = emailBody.match(/O\d{9}/);
  if (!orderNumberMatch) return null;

  const orderNumber = orderNumberMatch[0];

  // Parse items from the email
  // Format:
  // Product Name
  // Množství: X ks
  // Cena za m. j.: XXX Kč
  // Kód: XXX
  // XXX Kč
  const items: { productName: string; quantity: number; unitPrice?: string }[] = [];

  // Pattern to match product blocks:
  // Look for lines followed by "Množství: X ks"
  const productPattern = /([^\n<>]{10,200})\s*(?:<[^>]*>)*\s*Množství:\s*(\d+)\s*ks\s*(?:<[^>]*>)*\s*Cena za m\. j\.:\s*(\d+(?:[,.]\d+)?)\s*Kč/gi;
  
  let match;
  while ((match = productPattern.exec(emailBody)) !== null) {
    let productName = match[1].trim();
    // Clean up HTML tags and entities
    productName = productName.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    // Remove trailing whitespace and common suffixes
    productName = productName.replace(/\s+$/, '');
    
    const quantity = parseInt(match[2], 10);
    const unitPrice = match[3].replace(',', '.') + ' Kč';

    if (productName && productName.length > 5 && quantity > 0) {
      items.push({ productName, quantity, unitPrice });
    }
  }

  // Alternative: try simpler pattern if no items found
  if (items.length === 0) {
    const simplePattern = /([A-ZÁ-Ž][^\n]{5,150})\n\s*Množství:\s*(\d+)\s*ks/gi;
    while ((match = simplePattern.exec(emailBody)) !== null) {
      const productName = match[1].trim();
      const quantity = parseInt(match[2], 10);
      if (productName && quantity > 0) {
        items.push({ productName, quantity });
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
  daysBack: number = 30
): Promise<ParsedOrder[]> {
  // Search for order confirmations - the subject starts with www.vsebezlepku.cz
  const query = `subject:"Potvrzení objednávky"`;
  
  console.log("Gmail query:", query);

  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 100,
  });

  console.log("Gmail response:", response.data.resultSizeEstimate, "results");
  console.log("Messages:", response.data.messages);

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
        orders.push(parsed);
      }
    }
  }

  return orders;
}
