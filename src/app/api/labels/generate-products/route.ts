import { NextRequest, NextResponse } from "next/server";
import { generateLabelsPDF, LabelRequest } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { items, startPosition = 1, language = "cs" } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Items array required" },
        { status: 400 }
      );
    }

    // Get all labels for the requested language
    const allLabels = await prisma.productLabel.findMany({
      where: { language },
    });

    // Create maps for quick lookup
    const labelMap = new Map<string, typeof allLabels[0]>();
    for (const label of allLabels) {
      labelMap.set(label.productName, label);
      const stripped = stripBrandPrefix(label.productName);
      if (stripped !== label.productName && !labelMap.has(stripped)) {
        labelMap.set(stripped, label);
      }
    }

    // If not Czech, also load Czech labels for cross-reference
    let czLabelMap: Map<string, string> | null = null;
    if (language !== "cs") {
      const czLabels = await prisma.productLabel.findMany({
        where: { language: "cs" },
      });
      czLabelMap = new Map<string, string>();
      for (const l of czLabels) {
        czLabelMap.set(l.productName, l.productName);
        czLabelMap.set(stripBrandPrefix(l.productName), l.productName);
        czLabelMap.set(normalizeProductName(l.productName), l.productName);
      }
    }

    const labelRequests: LabelRequest[] = [];

    for (const item of items) {
      const { productName, quantity } = item;
      if (!productName || !quantity || quantity <= 0) continue;

      let label = labelMap.get(productName)
        || labelMap.get(normalizeProductName(productName))
        || labelMap.get(stripBrandPrefix(productName));

      // For non-Czech: try matching via Czech label name
      if (!label && czLabelMap) {
        const czName = czLabelMap.get(productName)
          || czLabelMap.get(normalizeProductName(productName))
          || czLabelMap.get(stripBrandPrefix(productName));
        if (czName) {
          label = labelMap.get(czName)
            || labelMap.get(normalizeProductName(czName))
            || labelMap.get(stripBrandPrefix(czName));
        }
      }

      if (!label || label.hasFactoryLabel) continue;

      labelRequests.push({
        label: {
          nazev: label.nazev,
          slozeni: label.slozeni,
          nutricniHodnoty: label.nutricniHodnoty,
          skladovani: label.skladovani ?? undefined,
          vyrobce: label.vyrobce,
        },
        quantity,
      });
    }

    if (labelRequests.length === 0) {
      return NextResponse.json(
        { error: "No labels to generate" },
        { status: 400 }
      );
    }

    const pdfBytes = await generateLabelsPDF(labelRequests, startPosition, language);

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="product-labels-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Generate products labels error:", error);
    return NextResponse.json(
      { error: "Failed to generate labels" },
      { status: 500 }
    );
  }
}

function normalizeProductName(name: string): string {
  return name.replace(/\s*-\s*Pomozte nepl[ýy]tvat\s*$/i, "").replace(/\s*-\s*Pomoze nepl[ýy]tvat\s*$/i, "").trim();
}

function stripBrandPrefix(name: string): string {
  return name
    .replace(/\s*-\s*Pomozte nepl[ýy]tvat\s*$/i, "")
    .replace(/^(Piaceri Mediterranei|Massimo Zero|Bauer|Glutiniente)\s*/i, "")
    .replace(/bezlepkov[áéý]\s*/i, "")
    .replace(/bezlepkové\s*/i, "")
    .trim();
}
