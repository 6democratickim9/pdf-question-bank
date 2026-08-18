import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function renderPdfPages(source: Blob, pageNumbers: number[]): Promise<string[]> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await source.arrayBuffer()) }).promise;
  const rendered: string[] = [];
  for (const pageNumber of pageNumbers) {
    if (pageNumber < 1 || pageNumber > pdf.numPages) continue;
    const page = await pdf.getPage(pageNumber); const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d'); if (!context) continue;
    await page.render({ canvasContext: context, viewport }).promise;
    rendered.push(canvas.toDataURL('image/jpeg', 0.9));
  }
  return rendered;
}
