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
  // Extract order number: Oxxxxxxxxxx pattern
  const orderNumberMatch = emailBody.match(/O\d{10}/);
  if (!orderNumberMatch) return null;

  const orderNumber = orderNumberMatch[0];

  // Parse items from the email - vsebezlepku uses HTML tables
  const items: { productName: string; quantity: number; unitPrice?: string }[] = [];

  // Pattern for items: Product name, quantity, price
  // This regex looks for table rows with product info
  const itemPattern = /<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>(\d+)\s*ks<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi;
  let match;

  while ((match = itemPattern.exec(emailBody)) !== null) {
    const productName = match[1].trim();
    const quantity = parseInt(match[2], 10);
    const unitPrice = match[3].trim();

    if (productName && quantity > 0) {
      items.push({ productName, quantity, unitPrice });
    }
  }

  // Alternative pattern for plain text emails
  if (items.length === 0) {
    const plainItemPattern = /(\d+)\s*[xX×]\s*(.+?)\s*[-–]\s*(\d+[,.]?\d*)\s*Kč/g;
    while ((match = plainItemPattern.exec(emailBody)) !== null) {
      const quantity = parseInt(match[1], 10);
      const productName = match[2].trim();
      const unitPrice = match[3].trim() + " Kč";

      if (productName && quantity > 0) {
        items.push({ productName, quantity, unitPrice });
      }
    }
  }

  // Try another common format
  if (items.length === 0) {
    const lines = emailBody.split(/\n|\r\n/);
    for (const line of lines) {
      const lineMatch = line.match(/(.+?)\s+(\d+)\s*(?:ks|x)\s*(?:[\d,.]+\s*Kč)?/i);
      if (lineMatch) {
        const productName = lineMatch[1].trim();
        const quantity = parseInt(lineMatch[2], 10);
        if (productName.length > 3 && productName.length < 100 && quantity > 0) {
          items.push({ productName, quantity });
        }
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
  const after = new Date();
  after.setDate(after.getDate() - daysBack);
  const afterStr = Math.floor(after.getTime() / 1000);

  const query = `from:info@vsebezlepku.cz subject:"Potvrzení objednávky" after:${afterStr}`;

  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 100,
  });

  const messages = response.data.messages || [];
  const orders: ParsedOrder[] = [];

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
