import { NextRequest, NextResponse } from "next/server";
import { generateLabelsPDF, LabelRequest } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { orderIds, startPosition = 1 } = await request.json();

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
        if (!item.label) {
          missingLabels.push(item.productName);
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

    if (missingLabels.length > 0) {
      return NextResponse.json(
        {
          error: "Missing labels for products",
          missingLabels: [...new Set(missingLabels)],
        },
        { status: 400 }
      );
    }

    if (labelRequests.length === 0) {
      return NextResponse.json(
        { error: "No labels to generate" },
        { status: 400 }
      );
    }

    const pdfBytes = await generateLabelsPDF(labelRequests, startPosition);

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
