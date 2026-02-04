import { NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export async function GET() {
  try {
    console.log("TEST PDF: Starting...");
    
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    
    // Try to load fonts
    const baseUrl = 'https://vsebezlepku-orders.vercel.app';
    console.log("TEST PDF: Loading fonts from", baseUrl);
    
    const regularRes = await fetch(`${baseUrl}/fonts/NotoSans-Regular.ttf`);
    const boldRes = await fetch(`${baseUrl}/fonts/NotoSans-Bold.ttf`);
    
    console.log("TEST PDF: Font responses:", regularRes.status, boldRes.status);
    
    if (!regularRes.ok || !boldRes.ok) {
      return NextResponse.json({ 
        error: "Font load failed",
        regular: regularRes.status,
        bold: boldRes.status 
      }, { status: 500 });
    }
    
    const regularBytes = await regularRes.arrayBuffer();
    const boldBytes = await boldRes.arrayBuffer();
    
    console.log("TEST PDF: Font sizes:", regularBytes.byteLength, boldBytes.byteLength);
    
    const font = await pdfDoc.embedFont(regularBytes);
    const fontBold = await pdfDoc.embedFont(boldBytes);
    
    // A4 Landscape
    const page = pdfDoc.addPage([841.89, 595.28]);
    
    // Draw visible elements
    page.drawRectangle({
      x: 50,
      y: 400,
      width: 200,
      height: 100,
      color: rgb(1, 0, 0),
    });
    
    page.drawText("Test PDF - Czech: ř š ž č", {
      x: 60,
      y: 450,
      size: 16,
      font: font,
      color: rgb(1, 1, 1),
    });
    
    page.drawText("Bold text here", {
      x: 60,
      y: 420,
      size: 14,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    
    const pdfBytes = await pdfDoc.save();
    console.log("TEST PDF: Generated", pdfBytes.length, "bytes");
    
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=test.pdf",
      },
    });
  } catch (error) {
    console.error("TEST PDF ERROR:", error);
    return NextResponse.json({ 
      error: "Failed", 
      details: String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
