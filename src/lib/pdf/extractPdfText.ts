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
    const parts: string[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = item.transform[5];
      if (previousY != null && Math.abs(y - previousY) > 3) parts.push('\n');
      else if (parts.length && !parts.at(-1)?.endsWith('\n')) parts.push(' ');
      parts.push(item.str);
      previousY = y;
    }
    pages.push({ pageNumber, text: parts.join('') });
    onProgress?.(pageNumber, pdf.numPages);
  }
  return pages;
}
