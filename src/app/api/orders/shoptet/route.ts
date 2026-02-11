import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper function to normalize product name (remove " - Pomozte neplýtvat" suffix)
function normalizeProductName(name: string): string {
  return name.replace(/ - Pomozte neplýtvat$/, "").trim();
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
        const { orderNumber, totalPrice, items } = orderData;

        if (!orderNumber || !items || !Array.isArray(items)) {
          results.errors.push(`Invalid order data for ${orderNumber || "unknown"}`);
          continue;
        }

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
                labelId: label?.id || null,
              },
            });
          }

          // Update total price
          await prisma.order.update({
            where: { id: existingOrder.id },
            data: { totalPrice: totalPrice || null },
          });

          results.updated++;
        } else {
          // Create new order
          const order = await prisma.order.create({
            data: {
              orderNumber,
              emailDate: new Date(), // Use current date for Shoptet imports
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
                labelId: label?.id || null,
              },
            });
          }

          results.created++;
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
