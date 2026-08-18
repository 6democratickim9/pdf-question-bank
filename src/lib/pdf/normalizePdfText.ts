import type { PageText } from '../../types';

export interface FlowLine { text: string; pageNumber: number }

export function normalizePdfText(pages: PageText[]): FlowLine[] {
  return pages.flatMap(({ pageNumber, text }) => text
    .replace(/\r/g, '')
    .replace(/[\u00a0\t]+/g, ' ')
    .split('\n')
    .map((line) => ({ text: line.trimEnd(), pageNumber })));
}
