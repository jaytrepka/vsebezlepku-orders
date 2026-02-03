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
  skladovani: string;
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

        // Calculate label position (top-left corner, Y from top)
        const x = MARGIN_X + col * LABEL_WIDTH;
        const y = A4_HEIGHT - MARGIN_Y - (row + 1) * LABEL_HEIGHT;

        // Draw label border (optional, for debugging)
        // page.drawRectangle({
        //   x, y, width: LABEL_WIDTH, height: LABEL_HEIGHT,
        //   borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5,
        // });

        // Draw label content
        const padding = 4;
        const contentX = x + padding;
        let contentY = y + LABEL_HEIGHT - padding - 8;
        const contentWidth = LABEL_WIDTH - 2 * padding;

        // Title (název)
        const titleSize = 7;
        const titleLines = wrapText(label.nazev, contentWidth, titleSize, 0.5);
        for (const line of titleLines.slice(0, 2)) {
          page.drawText(line, {
            x: contentX,
            y: contentY,
            size: titleSize,
            font: fontBold,
            color: rgb(0, 0, 0),
          });
          contentY -= titleSize + 1;
        }

        contentY -= 2;

        // Složení
        const textSize = 5;
        const lineHeight = textSize + 1;

        page.drawText("Slozeni:", {
          x: contentX,
          y: contentY,
          size: textSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        contentY -= lineHeight;

        const slozeniLines = wrapText(label.slozeni, contentWidth, textSize, 0.45);
        for (const line of slozeniLines.slice(0, 4)) {
          page.drawText(line, {
            x: contentX,
            y: contentY,
            size: textSize,
            font,
            color: rgb(0, 0, 0),
          });
          contentY -= lineHeight;
        }

        contentY -= 2;

        // Nutriční hodnoty
        page.drawText("Nutricni hodnoty:", {
          x: contentX,
          y: contentY,
          size: textSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        contentY -= lineHeight;

        const nutriLines = wrapText(label.nutricniHodnoty, contentWidth, textSize, 0.45);
        for (const line of nutriLines.slice(0, 4)) {
          page.drawText(line, {
            x: contentX,
            y: contentY,
            size: textSize,
            font,
            color: rgb(0, 0, 0),
          });
          contentY -= lineHeight;
        }

        contentY -= 2;

        // Skladování
        page.drawText("Skladovani:", {
          x: contentX,
          y: contentY,
          size: textSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        contentY -= lineHeight;

        const skladLines = wrapText(label.skladovani, contentWidth, textSize, 0.45);
        for (const line of skladLines.slice(0, 2)) {
          page.drawText(line, {
            x: contentX,
            y: contentY,
            size: textSize,
            font,
            color: rgb(0, 0, 0),
          });
          contentY -= lineHeight;
        }

        contentY -= 2;

        // Výrobce
        page.drawText("Vyrobce:", {
          x: contentX,
          y: contentY,
          size: textSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        contentY -= lineHeight;

        const vyrobceLines = wrapText(label.vyrobce, contentWidth, textSize, 0.45);
        for (const line of vyrobceLines.slice(0, 2)) {
          page.drawText(line, {
            x: contentX,
            y: contentY,
            size: textSize,
            font,
            color: rgb(0, 0, 0),
          });
          contentY -= lineHeight;
        }
      }
    }
  }

  return pdfDoc.save();
}
