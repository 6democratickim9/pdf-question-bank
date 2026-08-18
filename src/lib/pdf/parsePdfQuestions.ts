import type { PageText, Question } from '../../types';
import { detectQuestions } from './detectQuestions';
import { normalizePdfText } from './normalizePdfText';
import { parseQuestionBlock } from './parseQuestionBlock';

export function parsePdfQuestions(pages: PageText[]): Question[] {
  const blocks = detectQuestions(normalizePdfText(pages));
  const counts = new Map<number, number>();
  blocks.forEach((block) => { if (block.number != null) counts.set(block.number, (counts.get(block.number) ?? 0) + 1); });
  return blocks.map((block) => parseQuestionBlock(block, block.number != null && (counts.get(block.number) ?? 0) > 1));
}
