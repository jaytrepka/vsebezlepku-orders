import { NextRequest, NextResponse } from "next/server";
import { generateLabelsPDF, LabelRequest } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { orderIds, startPosition = 1, excludedItemIds = [], language = "cs" } = await request.json();

    if (!orderIds || !Array.isArray(orderIds)) {
      return NextResponse.json(
        { error: "Order IDs required" },
        { status: 400 }
      );
    }

    // Get orders with items
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: {
        items: {
          include: {
            label: true,
          },
        },
      },
    });

    // Get all labels for the requested language
    const allLabels = await prisma.productLabel.findMany({
      where: { language },
    });

    // Create a map of productName -> label for quick lookup
    const labelMap = new Map<string, typeof allLabels[0]>();
    for (const label of allLabels) {
      labelMap.set(label.productName, label);
      // Also index by stripped brand prefix for fuzzy matching
      const stripped = stripBrandPrefix(label.productName);
      if (stripped !== label.productName && !labelMap.has(stripped)) {
        labelMap.set(stripped, label);
      }
    }

    // Helper to normalize product name (removes "Pomozte neplýtvat" suffix)
    function normalizeProductName(name: string): string {
      return name.replace(/\s*-\s*Pomozte nepl[ýy]tvat\s*$/i, "").replace(/\s*-\s*Pomoze nepl[ýy]tvat\s*$/i, "").trim();
    }

    // Strip brand prefix + "bezlepkové" to get core product name for fuzzy matching
    function stripBrandPrefix(name: string): string {
      return name
        .replace(/\s*-\s*Pomozte nepl[ýy]tvat\s*$/i, "")
        .replace(/^(Piaceri Mediterranei|Massimo Zero|Bauer|Glutiniente)\s*/i, "")
        .replace(/bezlepkov[áéý]\s*/i, "")
        .replace(/bezlepkové\s*/i, "")
        .trim();
    }

    // Build label requests
    const labelRequests: LabelRequest[] = [];

    for (const order of orders) {
      for (const item of order.items) {
        // Skip excluded items
        if (excludedItemIds.includes(item.id)) {
          continue;
        }

        // For requested language, look up label by productName
        // Use the Czech label's productName to find the corresponding label in the target language
        let label = null;
        if (language === "cs" && item.label) {
          // For Czech, use the linked label directly
          label = item.label;
        } else if (item.label) {
          // For other languages, try multiple lookups in order of specificity
          label = labelMap.get(item.label.productName)
            || labelMap.get(normalizeProductName(item.label.productName))
            || labelMap.get(stripBrandPrefix(item.label.productName));
        }
        
        // Also try direct lookup by item's productName (for cases without Czech label)
        if (!label && language !== "cs") {
          label = labelMap.get(item.productName)
            || labelMap.get(normalizeProductName(item.productName))
            || labelMap.get(stripBrandPrefix(item.productName));
        }

        // Skip items without labels
        if (!label) {
          continue;
        }

        // Skip items with factory labels (they already have labels from manufacturer)
        if (label.hasFactoryLabel) {
          continue;
        }

        labelRequests.push({
          label: {
            nazev: label.nazev,
            slozeni: label.slozeni,
            nutricniHodnoty: label.nutricniHodnoty,
            skladovani: label.skladovani ?? undefined,
            vyrobce: label.vyrobce,
          },
          quantity: item.quantity,
        });
      }
    }

    if (labelRequests.length === 0) {
      return NextResponse.json(
        { error: "No labels to generate" },
        { status: 400 }
      );
    }

    console.log("Generating PDF with", labelRequests.length, "label requests, startPosition:", startPosition, "language:", language);

    const pdfBytes = await generateLabelsPDF(labelRequests, startPosition, language);
    console.log("PDF generated, size:", pdfBytes.length, "bytes");

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="labels-${language}-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: String(error) },
      { status: 500 }
    );
  }
}
