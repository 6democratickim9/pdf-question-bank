import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parsePdfQuestions } from '../src/lib/pdf/parsePdfQuestions';
import type { PageText } from '../src/types';

const input = resolve(process.argv[2] ?? '/Users/min/Downloads/dva-c02-full-553.pdf');
const output = resolve(process.argv[3] ?? 'data/dva-c02-questions.json');
const pdf = await getDocument({ url: input }).promise;
const pages: PageText[] = [];
for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
  const page = await pdf.getPage(pageNumber); const content = await page.getTextContent(); let previousY: number | undefined; let previousEndX: number | undefined; let previousHeight = 0; const parts: string[] = [];
  for (const item of content.items) { if (!('str' in item)) continue; const y = item.transform[5]; const x = item.transform[4]; const height = Math.abs(item.transform[3]) || item.height || previousHeight; const newLine = previousY != null && Math.abs(y - previousY) > Math.max(2, height * .35); if (newLine) parts.push('\n'); else if (parts.length && previousEndX != null && x - previousEndX > Math.max(1.2, height * .18)) parts.push(' '); parts.push(item.str); previousY = y; previousEndX = x + item.width; previousHeight = height; if (item.hasEOL) { parts.push('\n'); previousY = undefined; previousEndX = undefined; } }
  pages.push({ pageNumber, text: parts.join('') });
  if (pageNumber % 50 === 0) console.log(`${pageNumber}/${pdf.numPages} pages`);
}
const parsed = parsePdfQuestions(pages); const rejected = parsed.filter((question) => question.choices.length < 2 || !question.correctAnswers.length);
const questions = parsed.filter((question) => question.choices.length >= 2 && question.correctAnswers.length > 0);
console.log('Rejected parser blocks:', rejected.map((q) => ({ number: q.originalNumber, page: q.sourcePages[0], choices: q.choices.length, answers: q.correctAnswers })));
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, JSON.stringify(questions, null, 2));
console.log(`Extracted ${questions.length} questions to ${output}`);
