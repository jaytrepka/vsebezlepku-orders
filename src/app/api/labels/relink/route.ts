import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Get all labels
    const labels = await prisma.productLabel.findMany();
    
    let linkedCount = 0;
    
    for (const label of labels) {
      // Link this label to all OrderItems with matching productName
      const result = await prisma.orderItem.updateMany({
        where: { 
          productName: label.productName,
          labelId: null, // Only update items without a label
        },
        data: { labelId: label.id },
      });
      linkedCount += result.count;
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
