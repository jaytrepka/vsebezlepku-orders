import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseShoptetEmail } from "@/lib/emailParser";
import { syncOrderItemsToAllegro } from "@/lib/allegro";

// Helper function to normalize product name (remove " - Pomozte neplýtvat" suffix)
function normalizeProductName(name: string): string {
  return name.replace(/\s*-\s*Pomozte nepl[ýy]tvat\s*$/i, "").trim();
}

// Decrement stock counts for order items (FIFO from soonest-expiring batches)
async function decrementStockForOrder(items: { productName: string; quantity: number; productCode?: string | null }[]) {
  for (const item of items) {
    const normalized = normalizeProductName(item.productName);
    const quantity = item.quantity || 1;

    // Find matching stock product by name or code
    const orConditions: { productName?: string; code?: string }[] = [
      { productName: item.productName },
      { productName: normalized },
    ];
    if (item.productCode) {
      orConditions.push({ code: item.productCode });
    }

    const stockProduct = await prisma.stockProduct.findFirst({
      where: { OR: orConditions },
      include: { expirations: { orderBy: { expirationDate: "asc" } } },
    });

    if (!stockProduct || stockProduct.totalCount <= 0) continue;

    const newTotal = Math.max(0, stockProduct.totalCount - quantity);
    const diff = stockProduct.totalCount - newTotal;

    // FIFO: subtract from soonest-expiring batches
    let remaining = diff;
    for (const exp of stockProduct.expirations) {
      if (remaining <= 0) break;
      if (exp.count <= remaining) {
        remaining -= exp.count;
        await prisma.expirationDate.delete({ where: { id: exp.id } });
      } else {
        await prisma.expirationDate.update({
          where: { id: exp.id },
          data: { count: exp.count - remaining },
        });
        remaining = 0;
      }
    }

    await prisma.stockProduct.update({
      where: { id: stockProduct.id },
      data: { totalCount: newTotal },
    });
  }
}

// Decrement warehouse boxes for order items (highest priority shelf, earliest expiration first)
async function decrementWarehouseForOrder(items: { productName: string; quantity: number }[]) {
  for (const item of items) {
    let remaining = item.quantity || 1;
    const normalized = normalizeProductName(item.productName);

    const boxes = await prisma.shelfBox.findMany({
      where: {
        pieces: { gt: 0 },
        OR: [
          { productName: item.productName },
          { productName: normalized },
        ],
      },
      include: { shelf: true },
      orderBy: [
        { shelf: { priority: "desc" } },
        { expirationDate: "asc" },
      ],
    });

    for (const box of boxes) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, box.pieces);
      await prisma.shelfBox.update({
        where: { id: box.id },
        data: { pieces: box.pieces - deduct },
      });
      remaining -= deduct;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.WEBHOOK_SECRET || "vbl_secret_webhook_token_2026";
    const secretHeader = request.headers.get("x-webhook-secret");

    if (secretHeader && secretHeader !== expectedSecret) {
      return NextResponse.json({ error: "Neplatný autorizační klíč webhooku" }, { status: 401 });
    }

    const data = await request.json();
    const html = data.html || data.rawEmail || data.body;

    if (!html) {
      return NextResponse.json({ error: "Tělo e-mailu (html) je povinné" }, { status: 400 });
    }

    // 1. Parse Shoptet order confirmation email
    const parsed = parseShoptetEmail(html);

    if (!parsed.orderNumber) {
      return NextResponse.json({ error: "Nepodařilo se najít číslo objednávky" }, { status: 400 });
    }

    // 2. Check for duplicate order
    const existingOrder = await prisma.order.findUnique({
      where: { orderNumber: parsed.orderNumber },
      include: { items: true },
    });

    if (existingOrder) {
      return NextResponse.json({
        message: "Objednávka již v systému existuje",
        orderNumber: parsed.orderNumber,
        orderId: existingOrder.id,
      });
    }

    // 3. Create new Order in database
    const order = await prisma.order.create({
      data: {
        orderNumber: parsed.orderNumber,
        emailDate: parsed.orderDate,
        totalPrice: parsed.totalPrice || null,
        rawEmail: html,
      },
    });

    // 4. Create OrderItems & link to labels
    for (const item of parsed.items) {
      const normalizedName = normalizeProductName(item.productName);

      const label = await prisma.productLabel.findFirst({
        where: {
          language: "cs",
          OR: [
            { productName: item.productName },
            { productName: normalizedName },
            { productName: { contains: normalizedName } },
          ],
        },
      });

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productName: item.productName,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || null,
          productUrl: item.productUrl || null,
          productCode: item.productCode || null,
          labelId: label?.id || null,
        },
      });
    }

    // 5. Decrement Stock & Expirations (FIFO)
    await decrementStockForOrder(parsed.items);

    // 6. Decrement Warehouse Boxes
    await decrementWarehouseForOrder(parsed.items);

    // 7. Automatically update stock on Allegro for the ordered items
    try {
      await syncOrderItemsToAllegro(parsed.items);
    } catch (allegroErr) {
      console.error("[EmailWebhook] Allegro sync error (non-fatal):", allegroErr);
    }

    console.log(`[EmailWebhook] Úspěšně zpracována objednávka ${parsed.orderNumber} s ${parsed.items.length} položkami`);

    return NextResponse.json({
      success: true,
      orderNumber: parsed.orderNumber,
      itemsCount: parsed.items.length,
      items: parsed.items,
    });
  } catch (error) {
    console.error("[EmailWebhook] Chyba při zpracování e-mailu:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chyba při zpracování e-mailu" },
      { status: 500 }
    );
  }
}
