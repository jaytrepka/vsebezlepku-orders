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

// Text segment with optional bold flag
interface TextSegment {
  text: string;
  bold: boolean;
}

// Parse text with **bold** markers into segments
function parseTextWithBold(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add regular text before this match
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    // Add bold text
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }
  // Add remaining regular text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }
  return segments;
}

// Calculate width of text with bold segments
function getSegmentedTextWidth(segments: TextSegment[], fontSize: number, font: PDFFont, fontBold: PDFFont): number {
  let totalWidth = 0;
  for (const seg of segments) {
    totalWidth += (seg.bold ? fontBold : font).widthOfTextAtSize(seg.text, fontSize);
  }
  return totalWidth;
}

// Wrap text using actual font measurements
// Keeps punctuation attached to preceding word (e.g., "mléko." stays together)
function wrapTextWithFont(text: string, maxWidth: number, fontSize: number, font: PDFFont): string[] {
  // Split but keep punctuation attached to previous word
  const rawWords = text.split(/\s+/);
  const words: string[] = [];
  
  for (const word of rawWords) {
    // If word is just punctuation and we have a previous word, attach it
    if (/^[.,;:!?]+$/.test(word) && words.length > 0) {
      words[words.length - 1] += word;
    } else {
      words.push(word);
    }
  }
  
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

// Wrap text with bold markers preserved, returning lines as segment arrays
// Keeps punctuation attached to preceding word (e.g., "mléko." stays together)
function wrapTextWithBold(text: string, maxWidth: number, fontSize: number, font: PDFFont, fontBold: PDFFont): TextSegment[][] {
  // Remove ** markers for word splitting but track positions
  const plainText = text.replace(/\*\*/g, '');
  const rawWords = plainText.split(/\s+/);
  
  // Keep punctuation attached to previous word
  const words: string[] = [];
  for (const word of rawWords) {
    if (/^[.,;:!?]+$/.test(word) && words.length > 0) {
      words[words.length - 1] += word;
    } else {
      words.push(word);
    }
  }
  
  // Track bold ranges in plain text
  const boldRanges: { start: number; end: number }[] = [];
  let plainIndex = 0;
  let originalIndex = 0;
  
  while (originalIndex < text.length) {
    if (text.slice(originalIndex, originalIndex + 2) === '**') {
      originalIndex += 2;
      const startPlain = plainIndex;
      // Find closing **
      const closeIdx = text.indexOf('**', originalIndex);
      if (closeIdx !== -1) {
        const boldText = text.slice(originalIndex, closeIdx);
        boldRanges.push({ start: startPlain, end: startPlain + boldText.length });
        plainIndex += boldText.length;
        originalIndex = closeIdx + 2;
      }
    } else {
      plainIndex++;
      originalIndex++;
    }
  }
  
  // Function to check if a character position is bold
  const isBold = (pos: number) => boldRanges.some(r => pos >= r.start && pos < r.end);
  
  // Wrap into lines
  const lines: TextSegment[][] = [];
  let currentLine = "";
  let currentLineStart = 0;
  let charPos = 0;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine.replace(/\*\*/g, ''), fontSize);
    
    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        // Convert currentLine to segments
        lines.push(lineToSegments(currentLine, currentLineStart, isBold));
        currentLineStart = charPos;
      }
      currentLine = word;
    }
    charPos += word.length + (i < words.length - 1 ? 1 : 0);
  }
  if (currentLine) {
    lines.push(lineToSegments(currentLine, currentLineStart, isBold));
  }
  
  return lines;
}

// Convert a line to segments based on bold positions
function lineToSegments(line: string, startPos: number, isBold: (pos: number) => boolean): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentText = "";
  let currentBold = isBold(startPos);
  
  for (let i = 0; i < line.length; i++) {
    const charBold = isBold(startPos + i);
    if (charBold !== currentBold) {
      if (currentText) {
        segments.push({ text: currentText, bold: currentBold });
      }
      currentText = line[i];
      currentBold = charBold;
    } else {
      currentText += line[i];
    }
  }
  if (currentText) {
    segments.push({ text: currentText, bold: currentBold });
  }
  return segments;
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
  const maxSize = 12;
  
  for (let size = maxSize; size >= minSize; size -= 0.25) {
    const lineHeight = size * 1.15;
    const titleLineHeight = (size + 1) * 1.15;
    const separatorHeight = 4; // 2px before + 2px after each separator line
    
    // Calculate title lines
    const titleLines = wrapTextWithFont(label.nazev, contentWidth - 4, size + 1, fontBold);
    let totalHeight = titleLines.length * titleLineHeight + 3; // title + separator space
    
    // Složení section (use plain text for height calc, bold doesn't change line count much)
    const slozeniPlain = "Složení: " + label.slozeni.replace(/\*\*/g, '');
    const slozeniLines = wrapTextWithFont(slozeniPlain, contentWidth, size, font);
    totalHeight += slozeniLines.length * lineHeight + separatorHeight;
    
    // Nutriční hodnoty section (header may wrap to 2 lines + content)
    const nutriHeaderTest = "Nutriční hodnoty (100g):";
    const nutriHeaderWidth = fontBold.widthOfTextAtSize(nutriHeaderTest, size);
    totalHeight += nutriHeaderWidth <= contentWidth ? lineHeight : lineHeight * 2; // header
    const nutriLines = wrapTextWithFont(label.nutricniHodnoty, contentWidth, size, font);
    totalHeight += nutriLines.length * lineHeight + separatorHeight;
    
    // Info (optional) - no prefix
    if (label.skladovani) {
      const infoLines = wrapTextWithFont(label.skladovani, contentWidth, size, font);
      totalHeight += infoLines.length * lineHeight + separatorHeight;
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
  
  // Find optimal font size (subtract extra padding for bottom margin)
  const fontSize = findOptimalFontSize(label, contentWidth - 4, contentHeight - 8, font, fontBold);
  const lineHeight = fontSize * 1.15;
  const titleSize = fontSize + 1;
  const titleLineHeight = titleSize * 1.15;
  
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
  
  // === SLOŽENÍ (with bold support) ===
  const slozeniText = "Složení: " + label.slozeni;
  const slozeniSegmentLines = wrapTextWithBold(slozeniText, maxTextWidth, fontSize, font, fontBold);
  
  for (let i = 0; i < slozeniSegmentLines.length; i++) {
    currentY -= lineHeight;
    let drawX = textX;
    const segments = slozeniSegmentLines[i];
    
    // First line: make "Složení:" bold regardless
    if (i === 0 && segments.length > 0) {
      const firstSegText = segments[0].text;
      if (firstSegText.startsWith("Složení:")) {
        // Draw "Složení:" in bold
        page.drawText("Složení:", {
          x: drawX,
          y: currentY,
          size: fontSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        drawX += fontBold.widthOfTextAtSize("Složení:", fontSize);
        // Draw rest of first segment
        const restOfFirst = firstSegText.substring("Složení:".length);
        if (restOfFirst) {
          const restFont = segments[0].bold ? fontBold : font;
          page.drawText(restOfFirst, {
            x: drawX,
            y: currentY,
            size: fontSize,
            font: restFont,
            color: rgb(0, 0, 0),
          });
          drawX += restFont.widthOfTextAtSize(restOfFirst, fontSize);
        }
        // Draw remaining segments
        for (let j = 1; j < segments.length; j++) {
          const seg = segments[j];
          const segFont = seg.bold ? fontBold : font;
          page.drawText(seg.text, {
            x: drawX,
            y: currentY,
            size: fontSize,
            font: segFont,
            color: rgb(0, 0, 0),
          });
          drawX += segFont.widthOfTextAtSize(seg.text, fontSize);
        }
      } else {
        // Normal segment drawing
        for (const seg of segments) {
          const segFont = seg.bold ? fontBold : font;
          page.drawText(seg.text, {
            x: drawX,
            y: currentY,
            size: fontSize,
            font: segFont,
            color: rgb(0, 0, 0),
          });
          drawX += segFont.widthOfTextAtSize(seg.text, fontSize);
        }
      }
    } else {
      // Other lines: draw segments with bold support
      for (const seg of segments) {
        const segFont = seg.bold ? fontBold : font;
        page.drawText(seg.text, {
          x: drawX,
          y: currentY,
          size: fontSize,
          font: segFont,
          color: rgb(0, 0, 0),
        });
        drawX += segFont.widthOfTextAtSize(seg.text, fontSize);
      }
    }
  }
  currentY -= 2;
  
  // Separator line after Složení
  page.drawLine({
    start: { x: x + padding, y: currentY },
    end: { x: x + LABEL_WIDTH - padding, y: currentY },
    color: borderColor,
    thickness: 0.3,
  });
  currentY -= 2;
  
  // === NUTRIČNÍ HODNOTY ===
  const nutriHeader = "Nutriční hodnoty (100g):";
  const nutriHeaderWidth = fontBold.widthOfTextAtSize(nutriHeader, fontSize);
  
  if (nutriHeaderWidth <= maxTextWidth) {
    // Fits on one line
    currentY -= lineHeight;
    page.drawText(nutriHeader, {
      x: textX,
      y: currentY,
      size: fontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
  } else {
    // Wrap to two lines
    currentY -= lineHeight;
    page.drawText("Nutriční hodnoty", {
      x: textX,
      y: currentY,
      size: fontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    currentY -= lineHeight;
    page.drawText("(100g):", {
      x: textX,
      y: currentY,
      size: fontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
  }
  
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
  
  // Separator line after Nutriční hodnoty
  page.drawLine({
    start: { x: x + padding, y: currentY },
    end: { x: x + LABEL_WIDTH - padding, y: currentY },
    color: borderColor,
    thickness: 0.3,
  });
  currentY -= 2;
  
  // === INFO (optional, no prefix - raw text) ===
  if (label.skladovani) {
    const infoLines = wrapTextWithFont(label.skladovani, maxTextWidth, fontSize, font);
    
    for (const line of infoLines) {
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
    
    // Separator line after Info
    page.drawLine({
      start: { x: x + padding, y: currentY },
      end: { x: x + LABEL_WIDTH - padding, y: currentY },
      color: borderColor,
      thickness: 0.3,
    });
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
