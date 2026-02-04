import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Try to link order items to labels using fuzzy matching
export async function POST(request: NextRequest) {
  try {
    // Get all labels
    const labels = await prisma.productLabel.findMany();
    
    // Get all order items without labels
    const unlinkedItems = await prisma.orderItem.findMany({
      where: { labelId: null },
    });

    const results = {
      linked: 0,
      unlinked: unlinkedItems.length,
      matches: [] as { itemName: string; labelName: string }[],
    };

    for (const item of unlinkedItems) {
      // Extract the actual product name from the messy string
      // Remove order numbers, prices, etc.
      let cleanName = item.productName;
      
      // Remove patterns like "202600071 Obsah objednávky "
      cleanName = cleanName.replace(/^\d+ Obsah objednávky\s*/i, "");
      
      // Remove patterns like "BAPOL120 99 Kč " or "P047 695 Kč " 
      cleanName = cleanName.replace(/^[A-Z0-9\-]+ [\d,.]+ Kč\s*/i, "");
      
      // Remove patterns like "706 63,20 Kč "
      cleanName = cleanName.replace(/^\d+ [\d,.]+ Kč\s*/i, "");
      
      // Try to find a matching label
      // First try exact match
      for (const label of labels) {
        if (cleanName.toLowerCase().includes(label.productName.toLowerCase()) ||
            item.productName.toLowerCase().includes(label.productName.toLowerCase())) {
          await prisma.orderItem.update({
            where: { id: item.id },
            data: { labelId: label.id },
          });
          results.linked++;
          results.matches.push({
            itemName: item.productName.substring(0, 60),
            labelName: label.productName,
          });
          break;
        }
      }
      
      // If no match, try word-based matching
      if (!results.matches.find(m => m.itemName === item.productName.substring(0, 60))) {
        const itemWords = cleanName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        
        for (const label of labels) {
          const labelWords = label.productName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          // Check if at least 2 significant words match
          const matchingWords = labelWords.filter(lw => 
            itemWords.some(iw => iw.includes(lw) || lw.includes(iw))
          );
          
          if (matchingWords.length >= 2 || 
              (labelWords.length === 1 && matchingWords.length === 1)) {
            await prisma.orderItem.update({
              where: { id: item.id },
              data: { labelId: label.id },
            });
            results.linked++;
            results.matches.push({
              itemName: item.productName.substring(0, 60),
              labelName: label.productName,
            });
            break;
          }
        }
      }
    }

    results.unlinked = unlinkedItems.length - results.linked;
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: "Linking failed", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Get all unlinked items
  const unlinkedItems = await prisma.orderItem.findMany({
    where: { labelId: null },
    select: { productName: true },
  });

  const uniqueNames = [...new Set(unlinkedItems.map(i => i.productName))];
  
  return NextResponse.json({
    count: uniqueNames.length,
    products: uniqueNames.sort(),
  });
}
