import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PageText } from '../../types';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractPdfText(file: File, onProgress?: (done: number, total: number) => void): Promise<PageText[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: PageText[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    let previousY: number | undefined;
    let previousEndX: number | undefined;
    let previousHeight = 0;
    const parts: string[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = item.transform[5];
      const x = item.transform[4];
      const height = Math.abs(item.transform[3]) || item.height || previousHeight;
      const newLine = previousY != null && Math.abs(y - previousY) > Math.max(2, height * 0.35);
      if (newLine) parts.push('\n');
      else if (parts.length && previousEndX != null) {
        // PDF.js may emit every Hangul syllable as a separate item. Only insert a
        // space when the actual glyph gap is large enough, rather than between items.
        const gap = x - previousEndX;
        if (gap > Math.max(1.2, height * 0.18)) parts.push(' ');
      }
      parts.push(item.str);
      previousY = y;
      previousEndX = x + item.width;
      previousHeight = height;
      if (item.hasEOL) { parts.push('\n'); previousY = undefined; previousEndX = undefined; }
    }
    pages.push({ pageNumber, text: parts.join('') });
    onProgress?.(pageNumber, pdf.numPages);
  }
  return pages;
}
