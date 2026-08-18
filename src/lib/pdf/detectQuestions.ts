import { EXPLICIT_QUESTION_START, NUMBERED_QUESTION_START, PAGE_NOISE } from './parserPatterns';
import type { FlowLine } from './normalizePdfText';

export interface QuestionBlock { number?: number; lines: FlowLine[] }

export function detectQuestions(lines: FlowLine[]): QuestionBlock[] {
  const starts: number[] = [];
  lines.forEach((line, index) => {
    if (PAGE_NOISE.test(line.text)) return;
    if (EXPLICIT_QUESTION_START.test(line.text) || NUMBERED_QUESTION_START.test(line.text)) starts.push(index);
  });
  return starts.map((start, index) => {
    const linesInBlock = lines.slice(start, starts[index + 1] ?? lines.length);
    const match = linesInBlock[0]?.text.match(EXPLICIT_QUESTION_START) ?? linesInBlock[0]?.text.match(NUMBERED_QUESTION_START);
    return { number: match ? Number(match[1]) : undefined, lines: linesInBlock };
  });
}
