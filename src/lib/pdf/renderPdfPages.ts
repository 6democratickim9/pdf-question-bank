import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface PositionedLine { y: number; text: string }

function positionedLines(items: unknown[]): PositionedLine[] {
  const grouped = new Map<number, string[]>();
  for (const item of items as Array<{ str?: string; transform?: number[] }>) {
    if (typeof item.str !== 'string' || !item.transform) continue;
    const y = Math.round(item.transform[5] / 3) * 3;
    grouped.set(y, [...(grouped.get(y) ?? []), item.str]);
  }
  return [...grouped.entries()].map(([y, text]) => ({ y, text: text.join('') })).sort((a, b) => b.y - a.y);
}

const compact = (text: string) => text.toUpperCase().replace(/\s+/g, '');
const isAnswerStart = (text: string) => /^(?:CORRECTANSWERS?|ANSWERS?):|^(?:EXPLANATION|SOLUTION|RATIONALE):?|^정답및해설|^해설|^정답[:：]?[A-H]/.test(compact(text));
const isQuestionStart = (text: string, number: number) => new RegExp(`^(?:(?:QUESTION|Q\\.?)?)${number}(?:[.):]|$)`).test(compact(text));

export async function renderQuestionPages(source: Blob, pageNumbers: number[], questionNumber: number): Promise<string[]> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await source.arrayBuffer()) }).promise;
  const rendered: string[] = []; let started = false;
  for (const pageNumber of pageNumbers) {
    if (pageNumber < 1 || pageNumber > pdf.numPages) continue;
    const page = await pdf.getPage(pageNumber); const content = await page.getTextContent(); const lines = positionedLines(content.items);
    const startLine = lines.find((line) => isQuestionStart(line.text, questionNumber));
    if (startLine) started = true;
    if (!started) continue;
    const linesAfterStart = startLine ? lines.filter((line) => line.y < startLine.y) : lines;
    const answerLine = linesAfterStart.find((line) => isAnswerStart(line.text));
    const viewport = page.getViewport({ scale: 1.5 });
    const top = startLine ? Math.max(0, viewport.convertToViewportPoint(0, startLine.y)[1] - 12) : 0;
    const bottom = answerLine ? Math.min(viewport.height, viewport.convertToViewportPoint(0, answerLine.y)[1] - 8) : viewport.height;
    const height = Math.floor(bottom - top); if (height <= 40) { if (answerLine) break; continue; }
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d'); if (!context) continue;
    await page.render({ canvasContext: context, viewport }).promise;
    const crop = document.createElement('canvas'); crop.width = canvas.width; crop.height = height;
    crop.getContext('2d')?.drawImage(canvas, 0, top, canvas.width, height, 0, 0, canvas.width, height);
    rendered.push(crop.toDataURL('image/jpeg', 0.9));
    if (answerLine) break;
  }
  if (!rendered.length) throw new Error('Question region was not found');
  return rendered;
}
