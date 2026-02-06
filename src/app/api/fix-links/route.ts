import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper to normalize product name for matching (removes " - Pomozte neplýtvat" suffix)
function normalizeProductName(name: string): string {
  return name.replace(/\s*-\s*Pomozte nepl[ýy]tvat\s*$/i, "").trim();
}

export async function POST() {
  try {
    // Get all order items with their labels
    const items = await prisma.orderItem.findMany({
      include: { label: true },
    });
    
    // Get all labels
    const labels = await prisma.productLabel.findMany();
    
    // Create a map of normalized label names to label
    const labelMap = new Map<string, typeof labels[0]>();
    for (const label of labels) {
      labelMap.set(label.productName, label);
      labelMap.set(normalizeProductName(label.productName), label);
    }
    
    let fixedCount = 0;
    
    for (const item of items) {
      const normalizedItemName = normalizeProductName(item.productName);
      const correctLabel = labelMap.get(item.productName) || labelMap.get(normalizedItemName);
      
      // Check if current link is wrong
      if (item.labelId && item.label) {
        const normalizedLabelName = normalizeProductName(item.label.productName);
        // If the item's normalized name doesn't match the label's normalized name
        if (normalizedItemName !== normalizedLabelName) {
          // Unlink and relink to correct label
          if (correctLabel && normalizeProductName(correctLabel.productName) === normalizedItemName) {
            await prisma.orderItem.update({
              where: { id: item.id },
              data: { labelId: correctLabel.id },
            });
            fixedCount++;
          } else {
            // Just unlink if no correct label
            await prisma.orderItem.update({
              where: { id: item.id },
              data: { labelId: null },
            });
            fixedCount++;
          }
        }
      } else if (!item.labelId && correctLabel) {
        // Link if currently unlinked but correct label exists
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { labelId: correctLabel.id },
        });
        fixedCount++;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      itemsFixed: fixedCount 
    });
  } catch (error) {
    console.error("Fix links error:", error);
    return NextResponse.json(
      { error: "Failed to fix links", details: String(error) },
      { status: 500 }
    );
  }
}
