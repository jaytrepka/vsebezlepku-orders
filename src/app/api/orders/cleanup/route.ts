import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Clean up product names and remove empty orders
export async function POST(request: NextRequest) {
  try {
    const results = {
      cleanedNames: 0,
      deletedEmptyOrders: 0,
      deletedOrderIds: [] as string[],
      examples: [] as { before: string; after: string }[],
    };

    // 1. Clean up product names
    const allItems = await prisma.orderItem.findMany();
    
    for (const item of allItems) {
      let cleanName = item.productName;
      const originalName = cleanName;
      
      // Remove patterns like "202600061 Obsah objednávky " at the start
      cleanName = cleanName.replace(/^\d{9}\s+Obsah objednávky\s+/i, "");
      
      // Remove patterns like "BAPOL120 99 Kč " or "P047 695 Kč " at the start
      cleanName = cleanName.replace(/^[A-Z0-9\-]+\s+[\d,\.]+\s*Kč\s+/i, "");
      
      // Remove patterns like "706 63,20 Kč " at the start
      cleanName = cleanName.replace(/^\d+\s+[\d,\.]+\s*Kč\s+/i, "");
      
      // Remove leading order numbers like "202600061 " 
      cleanName = cleanName.replace(/^\d{6,}\s+/i, "");
      
      // Remove "Obsah objednávky " if still present
      cleanName = cleanName.replace(/^Obsah objednávky\s+/i, "");
      
      // Trim whitespace
      cleanName = cleanName.trim();
      
      if (cleanName !== originalName && cleanName.length > 5) {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { productName: cleanName },
        });
        results.cleanedNames++;
        
        if (results.examples.length < 10) {
          results.examples.push({
            before: originalName.substring(0, 80),
            after: cleanName.substring(0, 80),
          });
        }
      }
    }

    // 2. Delete orders with no items
    const emptyOrders = await prisma.order.findMany({
      where: {
        items: {
          none: {},
        },
      },
    });

    for (const order of emptyOrders) {
      await prisma.order.delete({
        where: { id: order.id },
      });
      results.deletedEmptyOrders++;
      results.deletedOrderIds.push(order.orderNumber);
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: "Cleanup failed", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Preview what would be cleaned
  const allItems = await prisma.orderItem.findMany({
    take: 100,
  });
  
  const wouldClean: { before: string; after: string }[] = [];
  
  for (const item of allItems) {
    let cleanName = item.productName;
    const originalName = cleanName;
    
    cleanName = cleanName.replace(/^\d{9}\s+Obsah objednávky\s+/i, "");
    cleanName = cleanName.replace(/^[A-Z0-9\-]+\s+[\d,\.]+\s*Kč\s+/i, "");
    cleanName = cleanName.replace(/^\d+\s+[\d,\.]+\s*Kč\s+/i, "");
    cleanName = cleanName.replace(/^\d{6,}\s+/i, "");
    cleanName = cleanName.replace(/^Obsah objednávky\s+/i, "");
    cleanName = cleanName.trim();
    
    if (cleanName !== originalName) {
      wouldClean.push({
        before: originalName,
        after: cleanName,
      });
    }
  }

  const emptyOrders = await prisma.order.findMany({
    where: {
      items: {
        none: {},
      },
    },
    select: {
      orderNumber: true,
      totalPrice: true,
    },
  });

  return NextResponse.json({
    wouldCleanCount: wouldClean.length,
    wouldClean: wouldClean.slice(0, 20),
    emptyOrdersCount: emptyOrders.length,
    emptyOrders,
  });
}
