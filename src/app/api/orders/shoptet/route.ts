import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

// GET - Return list of existing order numbers
export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      select: {
        orderNumber: true,
      },
    });

    const orderNumbers = orders.map((o) => o.orderNumber);
    return NextResponse.json({ orderNumbers });
  } catch (error) {
    console.error("Error fetching order numbers:", error);
    return NextResponse.json(
      { error: "Failed to fetch order numbers" },
      { status: 500 }
    );
  }
}

// POST - Create or update orders from Shoptet
export async function POST(request: NextRequest) {
  try {
    const { orders } = await request.json();

    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json(
        { error: "Orders array required" },
        { status: 400 }
      );
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const orderData of orders) {
      try {
        const { orderNumber, totalPrice, items, orderDate } = orderData;

        if (!orderNumber || !items || !Array.isArray(items)) {
          results.errors.push(`Invalid order data for ${orderNumber || "unknown"}`);
          continue;
        }

        const parsedDate = orderDate ? new Date(orderDate) : new Date();

        // Check if order exists
        const existingOrder = await prisma.order.findUnique({
          where: { orderNumber },
          include: { items: true },
        });

        if (existingOrder) {
          // Update existing order - delete old items and create new ones
          await prisma.orderItem.deleteMany({
            where: { orderId: existingOrder.id },
          });

          // Create new items
          for (const item of items) {
            const normalizedName = normalizeProductName(item.productName);
            
            // Try to find a matching label
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
                orderId: existingOrder.id,
                productName: item.productName,
                quantity: item.quantity || 1,
                unitPrice: item.unitPrice || null,
                productUrl: item.productUrl || null,
                productCode: item.productCode || null,
                labelId: label?.id || null,
              },
            });
          }

          // Update total price and date
          await prisma.order.update({
            where: { id: existingOrder.id },
            data: { totalPrice: totalPrice || null, emailDate: parsedDate },
          });

          results.updated++;
        } else {
          // Create new order
          const order = await prisma.order.create({
            data: {
              orderNumber,
              emailDate: parsedDate,
              totalPrice: totalPrice || null,
              rawEmail: null,
            },
          });

          // Create items
          for (const item of items) {
            const normalizedName = normalizeProductName(item.productName);
            
            // Try to find a matching label
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

          results.created++;

          // Decrement stock for newly created orders
          await decrementStockForOrder(items.map((i: { productName: string; quantity?: number; productCode?: string }) => ({
            productName: i.productName,
            quantity: i.quantity || 1,
            productCode: i.productCode || null,
          })));
        }
      } catch (orderError) {
        console.error("Error processing order:", orderError);
        results.errors.push(`Error processing order: ${orderData.orderNumber}`);
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Shoptet import error:", error);
    return NextResponse.json(
      { error: "Failed to import orders" },
      { status: 500 }
    );
  }
}
