import { PDFDocument, rgb, PDFFont, PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// Load fonts via HTTP - works on Vercel serverless
async function loadFonts(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vsebezlepku-orders.vercel.app';
  
  const [regularRes, boldRes] = await Promise.all([
    fetch(`${baseUrl}/fonts/NotoSans-Regular.ttf`),
    fetch(`${baseUrl}/fonts/NotoSans-Bold.ttf`),
  ]);
  
  if (!regularRes.ok || !boldRes.ok) {
    throw new Error(`Failed to load fonts: regular=${regularRes.status}, bold=${boldRes.status}`);
  }
  
  return {
    regular: await regularRes.arrayBuffer(),
    bold: await boldRes.arrayBuffer(),
  };
}

// A4 dimensions in points - LANDSCAPE
const A4_WIDTH = 841.89;
const A4_HEIGHT = 595.28;

// Label dimensions: 36mm x 70mm
const MM_TO_PT = 2.83465;
const LABEL_WIDTH = 36 * MM_TO_PT;
const LABEL_HEIGHT = 70 * MM_TO_PT;

// Grid: 8 columns x 3 rows = 24 labels
const COLS = 8;
const ROWS = 3;
const MARGIN_X = (A4_WIDTH - COLS * LABEL_WIDTH) / 2;
const MARGIN_Y = (A4_HEIGHT - ROWS * LABEL_HEIGHT) / 2;

export interface LabelData {
  nazev: string;
  slozeni: string;
  nutricniHodnoty: string;
  skladovani?: string;
  vyrobce: string;
}

export interface LabelRequest {
  label: LabelData;
  quantity: number;
}

// Wrap text using actual font measurements
function wrapTextWithFont(text: string, maxWidth: number, fontSize: number, font: PDFFont): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    
    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      // If single word is too long, just add it anyway
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

// Calculate how many lines a section needs
function calculateSectionLines(
  prefix: string,
  text: string,
  maxWidth: number,
  fontSize: number,
  font: PDFFont,
  fontBold: PDFFont
): number {
  const prefixWidth = fontBold.widthOfTextAtSize(prefix, fontSize);
  const firstLineWidth = maxWidth - prefixWidth - 2;
  
  // First line has prefix, so less space
  const allLines = wrapTextWithFont(text, maxWidth, fontSize, font);
  if (allLines.length === 0) return 1;
  
  // Check if first line fits after prefix
  const firstLineText = allLines[0];
  const firstLineActualWidth = font.widthOfTextAtSize(firstLineText, fontSize);
  
  if (firstLineActualWidth <= firstLineWidth) {
    return allLines.length;
  } else {
    // First line needs to wrap more
    return wrapTextWithFont(text, maxWidth, fontSize, font).length + 1;
  }
}

// Find optimal font size that fits all content
function findOptimalFontSize(
  label: LabelData,
  contentWidth: number,
  availableHeight: number,
  font: PDFFont,
  fontBold: PDFFont
): number {
  const minSize = 3;
  const maxSize = 7;
  
  for (let size = maxSize; size >= minSize; size -= 0.5) {
    const lineHeight = size * 1.3;
    const titleLineHeight = (size + 1) * 1.3;
    
    // Calculate title lines
    const titleLines = wrapTextWithFont(label.nazev, contentWidth - 4, size + 1, fontBold);
    let totalHeight = titleLines.length * titleLineHeight + 4; // title + separator space
    
    // Složení section
    const slozeniLines = wrapTextWithFont("Složení: " + label.slozeni, contentWidth, size, font);
    totalHeight += slozeniLines.length * lineHeight + 2;
    
    // Nutriční hodnoty section
    const nutriHeader = "Nutriční hodnoty (100g):";
    totalHeight += lineHeight; // header
    const nutriLines = wrapTextWithFont(label.nutricniHodnoty, contentWidth, size, font);
    totalHeight += nutriLines.length * lineHeight + 2;
    
    // Skladování (optional)
    if (label.skladovani) {
      const skladLines = wrapTextWithFont("Skladování: " + label.skladovani, contentWidth, size, font);
      totalHeight += skladLines.length * lineHeight + 2;
    }
    
    // Výrobce
    const vyrobceLines = wrapTextWithFont("Výrobce: " + label.vyrobce, contentWidth, size, font);
    totalHeight += vyrobceLines.length * lineHeight;
    
    if (totalHeight <= availableHeight) {
      return size;
    }
  }
  
  return minSize;
}

// Draw a single label
function drawLabel(
  page: PDFPage,
  label: LabelData,
  x: number,
  y: number,
  font: PDFFont,
  fontBold: PDFFont
) {
  const padding = 3;
  const contentWidth = LABEL_WIDTH - 2 * padding;
  const contentHeight = LABEL_HEIGHT - 2 * padding;
  const borderColor = rgb(0, 0, 0);
  
  // Draw border
  page.drawRectangle({
    x: x + padding,
    y: y + padding,
    width: LABEL_WIDTH - 2 * padding,
    height: LABEL_HEIGHT - 2 * padding,
    borderColor,
    borderWidth: 0.5,
    color: rgb(1, 1, 1),
  });
  
  // Find optimal font size
  const fontSize = findOptimalFontSize(label, contentWidth - 4, contentHeight - 4, font, fontBold);
  const lineHeight = fontSize * 1.3;
  const titleSize = fontSize + 1;
  const titleLineHeight = titleSize * 1.3;
  
  let currentY = y + LABEL_HEIGHT - padding - 2;
  const textX = x + padding + 2;
  const maxTextWidth = contentWidth - 4;
  
  // === NÁZEV (title, bold, centered) ===
  const titleLines = wrapTextWithFont(label.nazev, maxTextWidth, titleSize, fontBold);
  for (const line of titleLines) {
    currentY -= titleLineHeight;
    const lineWidth = fontBold.widthOfTextAtSize(line, titleSize);
    page.drawText(line, {
      x: x + (LABEL_WIDTH - lineWidth) / 2,
      y: currentY,
      size: titleSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
  }
  
  // Separator line after title
  currentY -= 2;
  page.drawLine({
    start: { x: x + padding, y: currentY },
    end: { x: x + LABEL_WIDTH - padding, y: currentY },
    color: borderColor,
    thickness: 0.3,
  });
  currentY -= 2;
  
  // === SLOŽENÍ ===
  const slozeniText = "Složení: " + label.slozeni;
  const slozeniLines = wrapTextWithFont(slozeniText, maxTextWidth, fontSize, font);
  
  for (let i = 0; i < slozeniLines.length; i++) {
    currentY -= lineHeight;
    const line = slozeniLines[i];
    
    if (i === 0) {
      // First line: "Složení:" in bold, rest in regular
      const prefixWidth = fontBold.widthOfTextAtSize("Složení: ", fontSize);
      page.drawText("Složení:", {
        x: textX,
        y: currentY,
        size: fontSize,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      const restText = line.substring("Složení: ".length);
      if (restText) {
        page.drawText(restText, {
          x: textX + prefixWidth,
          y: currentY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }
    } else {
      page.drawText(line, {
        x: textX,
        y: currentY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }
  currentY -= 2;
  
  // === NUTRIČNÍ HODNOTY ===
  currentY -= lineHeight;
  page.drawText("Nutriční hodnoty (100g):", {
    x: textX,
    y: currentY,
    size: fontSize,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  
  const nutriLines = wrapTextWithFont(label.nutricniHodnoty, maxTextWidth, fontSize, font);
  for (const line of nutriLines) {
    currentY -= lineHeight;
    page.drawText(line, {
      x: textX,
      y: currentY,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }
  currentY -= 2;
  
  // === SKLADOVÁNÍ (optional) ===
  if (label.skladovani) {
    const skladText = "Skladování: " + label.skladovani;
    const skladLines = wrapTextWithFont(skladText, maxTextWidth, fontSize, font);
    
    for (let i = 0; i < skladLines.length; i++) {
      currentY -= lineHeight;
      const line = skladLines[i];
      
      if (i === 0) {
        const prefixWidth = fontBold.widthOfTextAtSize("Skladování: ", fontSize);
        page.drawText("Skladování:", {
          x: textX,
          y: currentY,
          size: fontSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        const restText = line.substring("Skladování: ".length);
        if (restText) {
          page.drawText(restText, {
            x: textX + prefixWidth,
            y: currentY,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
        }
      } else {
        page.drawText(line, {
          x: textX,
          y: currentY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }
    currentY -= 2;
  }
  
  // === VÝROBCE ===
  const vyrobceText = "Výrobce: " + label.vyrobce;
  const vyrobceLines = wrapTextWithFont(vyrobceText, maxTextWidth, fontSize, font);
  
  for (let i = 0; i < vyrobceLines.length; i++) {
    currentY -= lineHeight;
    const line = vyrobceLines[i];
    
    if (i === 0) {
      const prefixWidth = fontBold.widthOfTextAtSize("Výrobce: ", fontSize);
      page.drawText("Výrobce:", {
        x: textX,
        y: currentY,
        size: fontSize,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      const restText = line.substring("Výrobce: ".length);
      if (restText) {
        page.drawText(restText, {
          x: textX + prefixWidth,
          y: currentY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }
    } else {
      page.drawText(line, {
        x: textX,
        y: currentY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }
}

export async function generateLabelsPDF(
  labels: LabelRequest[],
  startPosition: number = 1
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  
  const fonts = await loadFonts();
  const font = await pdfDoc.embedFont(fonts.regular);
  const fontBold = await pdfDoc.embedFont(fonts.bold);

  // Flatten labels by quantity
  const allLabels: LabelData[] = [];
  for (const req of labels) {
    for (let i = 0; i < req.quantity; i++) {
      allLabels.push(req.label);
    }
  }

  const totalLabels = allLabels.length;
  const startIndex = startPosition - 1;
  const totalPositions = startIndex + totalLabels;
  const totalPages = Math.ceil(totalPositions / (COLS * ROWS));

  let labelIndex = 0;

  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const position = pageNum * (COLS * ROWS) + row * COLS + col;

        if (position < startIndex) continue;
        if (labelIndex >= allLabels.length) continue;

        const label = allLabels[labelIndex];
        labelIndex++;

        const x = MARGIN_X + col * LABEL_WIDTH;
        const y = A4_HEIGHT - MARGIN_Y - (row + 1) * LABEL_HEIGHT;

        drawLabel(page, label, x, y, font, fontBold);
      }
    }
  }

  return pdfDoc.save();
}
