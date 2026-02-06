import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper to normalize product name for matching (removes " - Pomozte neplýtvat" suffix)
function normalizeProductName(name: string): string {
  return name.replace(/\s*-\s*Pomozte nepl[ýy]tvat\s*$/i, "").trim();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const language = searchParams.get("language") || "cs";

    const labels = await prisma.productLabel.findMany({
      where: { language },
      orderBy: { productName: "asc" },
    });

    return NextResponse.json(labels);
  } catch (error) {
    console.error("Labels fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch labels" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const language = data.language || "cs";

    const label = await prisma.productLabel.upsert({
      where: { 
        productName_language: {
          productName: data.productName,
          language: language,
        }
      },
      update: {
        nazev: data.nazev,
        slozeni: data.slozeni,
        nutricniHodnoty: data.nutricniHodnoty,
        skladovani: data.skladovani || null,
        vyrobce: data.vyrobce,
      },
      create: {
        productName: data.productName,
        language: language,
        nazev: data.nazev,
        slozeni: data.slozeni,
        nutricniHodnoty: data.nutricniHodnoty,
        skladovani: data.skladovani || null,
        vyrobce: data.vyrobce,
      },
    });

    // Only link labels to OrderItems for the default language (cs)
    if (language === "cs") {
      // Link this label to all existing OrderItems with the same productName
      await prisma.orderItem.updateMany({
        where: { productName: data.productName },
        data: { labelId: label.id },
      });

      // Also link to items with " - Pomozte neplýtvat" suffix
      const normalizedName = normalizeProductName(data.productName);
      if (normalizedName === data.productName) {
        // Original name has no suffix, so look for items WITH the suffix
        const itemsWithSuffix = await prisma.orderItem.findMany({
          where: {
            labelId: null,
            productName: { contains: normalizedName },
          },
        });
        
        for (const item of itemsWithSuffix) {
          if (normalizeProductName(item.productName) === normalizedName) {
            await prisma.orderItem.update({
              where: { id: item.id },
              data: { labelId: label.id },
            });
          }
        }
      }
    }

    return NextResponse.json(label);
  } catch (error) {
    console.error("Label save error:", error);
    return NextResponse.json(
      { error: "Failed to save label" },
      { status: 500 }
    );
  }
}
