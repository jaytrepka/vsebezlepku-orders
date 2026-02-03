import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// A4 dimensions in points (1 point = 1/72 inch)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// Label dimensions in mm -> points (1mm = 2.83465 points)
const MM_TO_PT = 2.83465;
const LABEL_WIDTH = 36 * MM_TO_PT; // ~102 points
const LABEL_HEIGHT = 70 * MM_TO_PT; // ~198 points

// Grid: 3 columns x 8 rows = 24 labels
const COLS = 3;
const ROWS = 8;

// Margins to center the grid on page
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

function wrapText(text: string, maxWidth: number, fontSize: number, charWidth: number): string[] {
  const avgCharWidth = charWidth * fontSize;
  const maxChars = Math.floor(maxWidth / avgCharWidth);
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxChars) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

export async function generateLabelsPDF(
  labels: LabelRequest[],
  startPosition: number = 1
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Flatten labels by quantity
  const allLabels: LabelData[] = [];
  for (const req of labels) {
    for (let i = 0; i < req.quantity; i++) {
      allLabels.push(req.label);
    }
  }

  // Calculate total positions needed
  const totalLabels = allLabels.length;
  const startIndex = startPosition - 1; // Convert to 0-based
  const totalPositions = startIndex + totalLabels;
  const totalPages = Math.ceil(totalPositions / (COLS * ROWS));

  let labelIndex = 0;

  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const position = pageNum * (COLS * ROWS) + row * COLS + col;

        // Skip positions before startPosition
        if (position < startIndex) continue;

        // Check if we have labels left
        if (labelIndex >= allLabels.length) continue;

        const label = allLabels[labelIndex];
        labelIndex++;

        // Calculate label position (top-left corner, Y from bottom in PDF)
        const x = MARGIN_X + col * LABEL_WIDTH;
        const y = A4_HEIGHT - MARGIN_Y - (row + 1) * LABEL_HEIGHT;

        const padding = 2;
        const innerPadding = 3;
        const contentWidth = LABEL_WIDTH - 2 * padding;
        const borderColor = rgb(0, 0, 0);
        const lineWidth = 0.5;

        // Draw outer border
        page.drawRectangle({
          x: x + padding,
          y: y + padding,
          width: LABEL_WIDTH - 2 * padding,
          height: LABEL_HEIGHT - 2 * padding,
          borderColor,
          borderWidth: lineWidth,
        });

        let currentY = y + LABEL_HEIGHT - padding;

        // === NAZEV section (product name box at top) ===
        const nazevHeight = 16;
        page.drawLine({
          start: { x: x + padding, y: currentY - nazevHeight },
          end: { x: x + LABEL_WIDTH - padding, y: currentY - nazevHeight },
          color: borderColor,
          thickness: lineWidth,
        });

        // Product name - bold, centered, wrapped if needed
        const nazevSize = 6;
        const nazevLines = wrapText(label.nazev, contentWidth - 4, nazevSize, 0.55);
        const nazevLineHeight = nazevSize + 1;
        const nazevTotalHeight = nazevLines.length * nazevLineHeight;
        let nazevY = currentY - (nazevHeight - nazevTotalHeight) / 2 - nazevSize;
        
        for (const line of nazevLines.slice(0, 2)) {
          const lineWidthPx = fontBold.widthOfTextAtSize(line, nazevSize);
          page.drawText(line, {
            x: x + (LABEL_WIDTH - lineWidthPx) / 2,
            y: nazevY,
            size: nazevSize,
            font: fontBold,
            color: rgb(0, 0, 0),
          });
          nazevY -= nazevLineHeight;
        }
        currentY -= nazevHeight;

        // Calculate remaining height for content sections
        const nutriHeight = 45;
        const vyrobceHeight = label.skladovani ? 20 : 14;
        const slozeniHeight = LABEL_HEIGHT - 2 * padding - nazevHeight - nutriHeight - vyrobceHeight;

        // === SLOZENI section ===
        page.drawLine({
          start: { x: x + padding, y: currentY - slozeniHeight },
          end: { x: x + LABEL_WIDTH - padding, y: currentY - slozeniHeight },
          color: borderColor,
          thickness: lineWidth,
        });

        const textSize = 4.5;
        const lineHeight = textSize + 1;
        let textY = currentY - innerPadding - textSize;
        const textX = x + padding + innerPadding;
        const textWidth = contentWidth - 2 * innerPadding;

        page.drawText("Slozeni:", {
          x: textX,
          y: textY,
          size: textSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        
        const slozeniText = label.slozeni;
        const slozeniLines = wrapText(slozeniText, textWidth, textSize, 0.45);
        
        const slozeniPrefix = "Slozeni: ";
        const prefixWidth = fontBold.widthOfTextAtSize(slozeniPrefix, textSize);
        
        if (slozeniLines.length > 0) {
          const firstLineRemainder = wrapText(slozeniLines[0], textWidth - prefixWidth / 0.45 / textSize, textSize, 0.45);
          page.drawText(firstLineRemainder[0] || slozeniLines[0], {
            x: textX + prefixWidth,
            y: textY,
            size: textSize,
            font,
            color: rgb(0, 0, 0),
          });
        }
        textY -= lineHeight;

        const maxSlozeniLines = Math.floor((slozeniHeight - innerPadding * 2) / lineHeight) - 1;
        for (let i = 1; i < Math.min(slozeniLines.length, maxSlozeniLines); i++) {
          page.drawText(slozeniLines[i], {
            x: textX,
            y: textY,
            size: textSize,
            font,
            color: rgb(0, 0, 0),
          });
          textY -= lineHeight;
        }
        currentY -= slozeniHeight;

        // === NUTRICNI HODNOTY section ===
        page.drawLine({
          start: { x: x + padding, y: currentY - nutriHeight },
          end: { x: x + LABEL_WIDTH - padding, y: currentY - nutriHeight },
          color: borderColor,
          thickness: lineWidth,
        });

        textY = currentY - innerPadding - textSize;
        page.drawText("Nutricni hodnoty (na 100g):", {
          x: textX,
          y: textY,
          size: textSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        textY -= lineHeight;

        const nutriLines = wrapText(label.nutricniHodnoty, textWidth, textSize, 0.45);
        for (let i = 0; i < Math.min(nutriLines.length, 6); i++) {
          page.drawText(nutriLines[i], {
            x: textX,
            y: textY,
            size: textSize,
            font,
            color: rgb(0, 0, 0),
          });
          textY -= lineHeight;
        }
        currentY -= nutriHeight;

        // === VYROBCE section (bottom box, with optional skladovani) ===
        textY = currentY - innerPadding - textSize;
        
        // Skladovani (if present)
        if (label.skladovani) {
          page.drawText("Skladovani:", {
            x: textX,
            y: textY,
            size: textSize,
            font: fontBold,
            color: rgb(0, 0, 0),
          });
          const skladPrefix = "Skladovani: ";
          const skladPrefixWidth = fontBold.widthOfTextAtSize(skladPrefix, textSize);
          page.drawText(label.skladovani, {
            x: textX + skladPrefixWidth,
            y: textY,
            size: textSize,
            font,
            color: rgb(0, 0, 0),
          });
          textY -= lineHeight;
        }
        
        // Vyrobce
        page.drawText("Vyrobce:", {
          x: textX,
          y: textY,
          size: textSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        
        const vyrobcePrefix = "Vyrobce: ";
        const vyrobcePrefixWidth = fontBold.widthOfTextAtSize(vyrobcePrefix, textSize);
        page.drawText(label.vyrobce, {
          x: textX + vyrobcePrefixWidth,
          y: textY,
          size: textSize,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }
  }

  return pdfDoc.save();
}
