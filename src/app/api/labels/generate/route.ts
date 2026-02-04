import { NextRequest, NextResponse } from "next/server";
import { generateLabelsPDF, LabelRequest } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { orderIds, startPosition = 1, excludedItemIds = [] } = await request.json();

    if (!orderIds || !Array.isArray(orderIds)) {
      return NextResponse.json(
        { error: "Order IDs required" },
        { status: 400 }
      );
    }

    // Get orders with items and labels
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

    // Build label requests
    const labelRequests: LabelRequest[] = [];
    const missingLabels: string[] = [];

    for (const order of orders) {
      for (const item of order.items) {
        // Skip excluded items
        if (excludedItemIds.includes(item.id)) {
          continue;
        }

        // Skip items without labels (instead of error)
        if (!item.label) {
          continue;
        }

        labelRequests.push({
          label: {
            nazev: item.label.nazev,
            slozeni: item.label.slozeni,
            nutricniHodnoty: item.label.nutricniHodnoty,
            skladovani: item.label.skladovani ?? undefined,
            vyrobce: item.label.vyrobce,
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

    console.log("Generating PDF with", labelRequests.length, "label requests, startPosition:", startPosition);
    console.log("Label data:", JSON.stringify(labelRequests, null, 2));

    const pdfBytes = await generateLabelsPDF(labelRequests, startPosition);
    console.log("PDF generated, size:", pdfBytes.length, "bytes");

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="labels-${Date.now()}.pdf"`,
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
