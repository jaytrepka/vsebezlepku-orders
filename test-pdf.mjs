import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';

async function test() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  
  const cwd = process.cwd();
  const fontPath = path.join(cwd, 'public', 'fonts', 'NotoSans-Regular.ttf');
  const fontBoldPath = path.join(cwd, 'public', 'fonts', 'NotoSans-Bold.ttf');
  
  console.log('Font path:', fontPath);
  console.log('Font exists:', fs.existsSync(fontPath));
  
  const fontBytes = fs.readFileSync(fontPath);
  const fontBoldBytes = fs.readFileSync(fontBoldPath);
  
  const font = await pdfDoc.embedFont(fontBytes);
  const fontBold = await pdfDoc.embedFont(fontBoldBytes);
  
  // A4 Landscape
  const A4_WIDTH = 841.89;
  const A4_HEIGHT = 595.28;
  
  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  
  // Draw test text with Czech characters
  page.drawText('Test Čeština ř š ž', {
    x: 50,
    y: 400,
    size: 20,
    font: font,
    color: rgb(0, 0, 0),
  });
  
  // Draw a visible rectangle
  page.drawRectangle({
    x: 50,
    y: 300,
    width: 100,
    height: 50,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    color: rgb(0.95, 0.95, 0.95),
  });
  
  // Simulate the actual label positions
  const MM_TO_PT = 2.83465;
  const LABEL_WIDTH = 36 * MM_TO_PT;
  const LABEL_HEIGHT = 70 * MM_TO_PT;
  const COLS = 8;
  const ROWS = 3;
  const MARGIN_X = (A4_WIDTH - COLS * LABEL_WIDTH) / 2;
  const MARGIN_Y = (A4_HEIGHT - ROWS * LABEL_HEIGHT) / 2;
  
  console.log('LABEL_WIDTH:', LABEL_WIDTH);
  console.log('LABEL_HEIGHT:', LABEL_HEIGHT);
  console.log('MARGIN_X:', MARGIN_X);
  console.log('MARGIN_Y:', MARGIN_Y);
  
  // Draw first label position (position 0 = row 0, col 0)
  const x0 = MARGIN_X;
  const y0 = A4_HEIGHT - MARGIN_Y - LABEL_HEIGHT;
  console.log('Position 0: x=', x0, 'y=', y0);
  
  page.drawRectangle({
    x: x0,
    y: y0,
    width: LABEL_WIDTH,
    height: LABEL_HEIGHT,
    borderColor: rgb(1, 0, 0),
    borderWidth: 2,
  });
  
  page.drawText('Label 1', {
    x: x0 + 10,
    y: y0 + LABEL_HEIGHT - 20,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  
  const bytes = await pdfDoc.save();
  fs.writeFileSync('/tmp/test-label.pdf', bytes);
  console.log('PDF saved to /tmp/test-label.pdf, size:', bytes.length);
}

test().catch(console.error);
