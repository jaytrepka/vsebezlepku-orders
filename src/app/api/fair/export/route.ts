import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

async function loadFonts(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vsebezlepku-orders.vercel.app";
  const [regularRes, boldRes] = await Promise.all([
    fetch(`${baseUrl}/fonts/NotoSans-Regular.ttf`),
    fetch(`${baseUrl}/fonts/NotoSans-Bold.ttf`),
  ]);
  if (!regularRes.ok || !boldRes.ok) {
    throw new Error(`Failed to load fonts`);
  }
  return {
    regular: await regularRes.arrayBuffer(),
    bold: await boldRes.arrayBuffer(),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fairId = searchParams.get("id");

  if (!fairId) {
    return NextResponse.json({ error: "Fair ID required" }, { status: 400 });
  }

  try {
    const fair = await prisma.fair.findUnique({
      where: { id: fairId },
      include: { products: { orderBy: { productName: "asc" } } },
    });

    if (!fair) {
      return NextResponse.json({ error: "Fair not found" }, { status: 404 });
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fonts = await loadFonts();
    const regularFont = await pdfDoc.embedFont(fonts.regular);
    const boldFont = await pdfDoc.embedFont(fonts.bold);

    const PAGE_WIDTH = 595; // A4
    const PAGE_HEIGHT = 842;
    const MARGIN = 40;
    const ROW_HEIGHT = 22;

    const colName = MARGIN;
    const colCount = 370;
    const colPrice = 440;

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    // Title
    page.drawText(fair.name, {
      x: MARGIN,
      y,
      size: 18,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    y -= 30;

    // Table header
    function drawHeader(p: typeof page, yPos: number) {
      p.drawRectangle({
        x: MARGIN - 5,
        y: yPos - 5,
        width: PAGE_WIDTH - 2 * MARGIN + 10,
        height: ROW_HEIGHT,
        color: rgb(0.92, 0.92, 0.92),
      });
      p.drawText("Produkt", { x: colName, y: yPos, size: 9, font: boldFont, color: rgb(0, 0, 0) });
      p.drawText("Ks", { x: colCount, y: yPos, size: 9, font: boldFont, color: rgb(0, 0, 0) });
      p.drawText("Cena/ks", { x: colPrice, y: yPos, size: 9, font: boldFont, color: rgb(0, 0, 0) });
      return yPos - ROW_HEIGHT - 5;
    }

    y = drawHeader(page, y);

    let totalItems = 0;

    for (const product of fair.products) {
      if (y < MARGIN + ROW_HEIGHT) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
        y = drawHeader(page, y);
      }

      totalItems += product.totalCount;

      // Truncate long names
      let displayName = product.productName;
      const maxNameWidth = colCount - colName - 15;
      while (regularFont.widthOfTextAtSize(displayName, 9) > maxNameWidth && displayName.length > 3) {
        displayName = displayName.slice(0, -1);
      }
      if (displayName !== product.productName) displayName += "…";

      page.drawText(displayName, {
        x: colName,
        y,
        size: 9,
        font: regularFont,
        color: rgb(0, 0, 0),
      });
      page.drawText(String(product.totalCount), {
        x: colCount,
        y,
        size: 9,
        font: regularFont,
        color: rgb(0, 0, 0),
      });
      page.drawText(`${product.price} Kč`, {
        x: colPrice,
        y,
        size: 9,
        font: regularFont,
        color: rgb(0, 0, 0),
      });

      y -= ROW_HEIGHT;
    }

    // Summary line
    y -= 10;
    if (y < MARGIN + ROW_HEIGHT * 2) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }

    page.drawRectangle({
      x: MARGIN - 5,
      y: y - 5,
      width: PAGE_WIDTH - 2 * MARGIN + 10,
      height: ROW_HEIGHT + 4,
      color: rgb(0.95, 0.95, 0.85),
    });
    page.drawText("CELKEM", { x: colName, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText(String(totalItems), { x: colCount, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="veletrh-${fair.name.replace(/\s+/g, "-")}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Fair export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
