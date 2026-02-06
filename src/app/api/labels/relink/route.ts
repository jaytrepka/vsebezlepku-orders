import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper to normalize product name for matching (removes " - Pomozte neplýtvat" suffix)
function normalizeProductName(name: string): string {
  return name.replace(/\s*-\s*Pomozte nepl[ýy]tvat\s*$/i, "").trim();
}

export async function POST() {
  try {
    // Get all labels
    const labels = await prisma.productLabel.findMany();
    
    // Get all unlinked order items
    const unlinkedItems = await prisma.orderItem.findMany({
      where: { labelId: null },
    });
    
    let linkedCount = 0;
    
    // Create a map of normalized label names to label IDs
    const labelMap = new Map<string, string>();
    for (const label of labels) {
      labelMap.set(label.productName, label.id);
      labelMap.set(normalizeProductName(label.productName), label.id);
    }
    
    for (const item of unlinkedItems) {
      // Try exact match first
      let labelId = labelMap.get(item.productName);
      
      // If no exact match, try normalized name
      if (!labelId) {
        labelId = labelMap.get(normalizeProductName(item.productName));
      }
      
      if (labelId) {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { labelId },
        });
        linkedCount++;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      labelsProcessed: labels.length,
      itemsLinked: linkedCount 
    });
  } catch (error) {
    console.error("Relink error:", error);
    return NextResponse.json(
      { error: "Failed to relink labels", details: String(error) },
      { status: 500 }
    );
  }
}
