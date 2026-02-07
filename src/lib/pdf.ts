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

// Language-specific label headers
type LabelLanguage = "cs" | "pl" | "sk";

const labelHeaders: Record<LabelLanguage, {
  slozeni: string;
  nutricniHodnoty: string;
  vyrobce: string;
}> = {
  cs: {
    slozeni: "Složení:",
    nutricniHodnoty: "Nutriční hodnoty (100g):",
    vyrobce: "Výrobce:",
  },
  pl: {
    slozeni: "Składniki:",
    nutricniHodnoty: "Wartości odżywcze (na 100 g):",
    vyrobce: "Producent:",
  },
  sk: {
    slozeni: "Zloženie:",
    nutricniHodnoty: "Nutričné hodnoty (na 100g):",
    vyrobce: "Výrobca:",
  },
};

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

// Parse text with **bold** markers into word tokens preserving bold info
interface WordToken {
  text: string;
  bold: boolean;
}

function parseTextToWordTokens(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  const regex = /\*\*([^*]+)\*\*|([^*\s]+)/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      // Bold text (inside **)
      tokens.push({ text: match[1], bold: true });
    } else if (match[2]) {
      // Regular text
      tokens.push({ text: match[2], bold: false });
    }
  }
  
  // Merge punctuation with previous token
  const merged: WordToken[] = [];
  for (const token of tokens) {
    if (/^[.,;:!?]+$/.test(token.text) && merged.length > 0) {
      merged[merged.length - 1].text += token.text;
    } else {
      merged.push(token);
    }
  }
  
  return merged;
}

// Wrap text with bold markers preserved, returning lines as segment arrays
function wrapTextWithBold(text: string, maxWidth: number, fontSize: number, font: PDFFont, fontBold: PDFFont): TextSegment[][] {
  const tokens = parseTextToWordTokens(text);
  
  const lines: TextSegment[][] = [];
  let currentLineTokens: WordToken[] = [];
  let currentLineWidth = 0;
  
  for (const token of tokens) {
    const tokenFont = token.bold ? fontBold : font;
    const tokenWidth = tokenFont.widthOfTextAtSize(token.text, fontSize);
    const spaceWidth = font.widthOfTextAtSize(' ', fontSize);
    const addedWidth = currentLineTokens.length > 0 ? spaceWidth + tokenWidth : tokenWidth;
    
    if (currentLineWidth + addedWidth <= maxWidth) {
      currentLineTokens.push(token);
      currentLineWidth += addedWidth;
    } else {
      // Finish current line
      if (currentLineTokens.length > 0) {
        lines.push(tokensToSegments(currentLineTokens));
      }
      // Start new line with this token
      currentLineTokens = [token];
      currentLineWidth = tokenWidth;
    }
  }
  
  // Add remaining tokens
  if (currentLineTokens.length > 0) {
    lines.push(tokensToSegments(currentLineTokens));
  }
  
  return lines;
}

// Convert tokens to segments, merging adjacent tokens with same bold state
function tokensToSegments(tokens: WordToken[]): TextSegment[] {
  if (tokens.length === 0) return [];
  
  const segments: TextSegment[] = [];
  let currentText = tokens[0].text;
  let currentBold = tokens[0].bold;
  
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.bold === currentBold) {
      currentText += ' ' + token.text;
    } else {
      segments.push({ text: currentText, bold: currentBold });
      currentText = ' ' + token.text; // Add space before new segment
      currentBold = token.bold;
    }
  }
  
  segments.push({ text: currentText, bold: currentBold });
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
  fontBold: PDFFont,
  headers: typeof labelHeaders["cs"]
): number {
  const minSize = 3;
  const maxSize = 14;
  
  for (let size = maxSize; size >= minSize; size -= 0.25) {
    const lineHeight = size * 1.15;
    const titleSize = size + 1;
    const titleLineHeight = titleSize * 1.15;
    const separatorHeight = 3; // spacing around separator lines (2 before + 1 after)
    
    // Calculate title lines - uses narrower width like in drawing
    const titleLines = wrapTextWithFont(label.nazev, contentWidth, titleSize, fontBold);
    // Title block height includes the +2 padding from drawing code
    let totalHeight = titleLines.length * titleLineHeight + 2 + separatorHeight;
    
    // Složení section - use wrapTextWithBold for accurate line count
    const slozeniText = headers.slozeni + " " + label.slozeni;
    const slozeniLines = wrapTextWithBold(slozeniText, contentWidth, size, font, fontBold);
    totalHeight += slozeniLines.length * lineHeight + separatorHeight;
    
    // Nutriční hodnoty section (header + content)
    const nutriText = headers.nutricniHodnoty + " " + label.nutricniHodnoty;
    const nutriLines = wrapTextWithFont(nutriText, contentWidth, size, font);
    totalHeight += nutriLines.length * lineHeight + separatorHeight;
    
    // Info (optional)
    if (label.skladovani) {
      const infoLines = wrapTextWithFont(label.skladovani, contentWidth, size, font);
      totalHeight += infoLines.length * lineHeight + separatorHeight;
    }
    
    // Výrobce
    const vyrobceText = headers.vyrobce + " " + label.vyrobce;
    const vyrobceLines = wrapTextWithFont(vyrobceText, contentWidth, size, font);
    totalHeight += vyrobceLines.length * lineHeight;
    
    // Add buffer for starting offset (-1 in drawing) and safety margin
    if (totalHeight + 5 <= availableHeight) {
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
  fontBold: PDFFont,
  headers: typeof labelHeaders["cs"]
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
  
  // Find optimal font size (use most of available height)
  const fontSize = findOptimalFontSize(label, contentWidth - 4, contentHeight - 2, font, fontBold, headers);
  const lineHeight = fontSize * 1.15;
  const titleSize = fontSize + 1;
  const titleLineHeight = titleSize * 1.15;
  
  let currentY = y + LABEL_HEIGHT - padding - 1;
  const textX = x + padding + 2;
  const maxTextWidth = contentWidth - 4;
  
  // === NÁZEV (title, bold, centered, with grey background) ===
  const titleLines = wrapTextWithFont(label.nazev, maxTextWidth, titleSize, fontBold);
  const titleBlockHeight = titleLines.length * titleLineHeight + 2;
  
  // Draw grey background for title
  page.drawRectangle({
    x: x + padding,
    y: currentY - titleBlockHeight,
    width: LABEL_WIDTH - 2 * padding,
    height: titleBlockHeight,
    color: rgb(0.92, 0.92, 0.92),
  });
  
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
  currentY -= 1;
  
  // === SLOŽENÍ (with bold support) ===
  const slozeniHeader = headers.slozeni;
  const slozeniText = slozeniHeader + " " + label.slozeni;
  const slozeniSegmentLines = wrapTextWithBold(slozeniText, maxTextWidth, fontSize, font, fontBold);
  
  for (let i = 0; i < slozeniSegmentLines.length; i++) {
    currentY -= lineHeight;
    let drawX = textX;
    const segments = slozeniSegmentLines[i];
    
    // First line: make header bold regardless
    if (i === 0 && segments.length > 0) {
      const firstSegText = segments[0].text;
      if (firstSegText.startsWith(slozeniHeader)) {
        // Draw header in bold
        page.drawText(slozeniHeader, {
          x: drawX,
          y: currentY,
          size: fontSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        drawX += fontBold.widthOfTextAtSize(slozeniHeader, fontSize);
        // Draw rest of first segment
        const restOfFirst = firstSegText.substring(slozeniHeader.length);
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
  const nutriHeader = headers.nutricniHodnoty;
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
    // Wrap header to multiple lines
    const headerLines = wrapTextWithFont(nutriHeader, maxTextWidth, fontSize, fontBold);
    for (const hLine of headerLines) {
      currentY -= lineHeight;
      page.drawText(hLine, {
        x: textX,
        y: currentY,
        size: fontSize,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
    }
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
  const vyrobceHeader = headers.vyrobce;
  const vyrobceText = vyrobceHeader + " " + label.vyrobce;
  const vyrobceLines = wrapTextWithFont(vyrobceText, maxTextWidth, fontSize, font);
  
  for (let i = 0; i < vyrobceLines.length; i++) {
    currentY -= lineHeight;
    const line = vyrobceLines[i];
    
    if (i === 0) {
      const prefixWidth = fontBold.widthOfTextAtSize(vyrobceHeader + " ", fontSize);
      page.drawText(vyrobceHeader, {
        x: textX,
        y: currentY,
        size: fontSize,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      const restText = line.substring((vyrobceHeader + " ").length);
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
  startPosition: number = 1,
  language: LabelLanguage = "cs"
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  
  const fonts = await loadFonts();
  const font = await pdfDoc.embedFont(fonts.regular);
  const fontBold = await pdfDoc.embedFont(fonts.bold);
  
  const headers = labelHeaders[language];

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

        drawLabel(page, label, x, y, font, fontBold, headers);
      }
    }
  }

  return pdfDoc.save();
}
