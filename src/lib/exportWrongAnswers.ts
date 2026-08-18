import { jsPDF } from 'jspdf';
import type { CycleResult, Question, QuestionBank } from '../types';

const safe = (value: string) => value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '');
export function exportWrongAnswers(bank: QuestionBank, result: CycleResult) {
  const questions = new Map(bank.questions.map((q) => [q.id, q]));
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 48; const width = 500;
  const write = (text: string, size = 11) => {
    doc.setFontSize(size); const lines = doc.splitTextToSize(text, width);
    if (y + lines.length * (size + 4) > 790) { doc.addPage(); y = 48; }
    doc.text(lines, 48, y); y += lines.length * (size + 4) + 8;
  };
  result.results.filter((item) => !item.correct).forEach((item, index) => {
    const q = questions.get(item.questionId); if (!q) return;
    if (index) { doc.addPage(); y = 48; }
    write(`Question ${q.originalNumber ?? index + 1}`, 16); write(q.question);
    q.choices.forEach((c) => write(`${c.key}. ${c.text}`));
    write(`My Answer: ${item.selected.join(', ') || 'Unanswered'}`);
    write(`Correct Answer: ${q.correctAnswers.join(', ')}`);
    if (q.explanation) write(`Explanation: ${q.explanation}`);
  });
  doc.save(`${safe(bank.name)}_${result.kind === 'normal' ? `Cycle-${result.cycleNumber}` : 'Wrong-Notes'}_Wrong-Answers.pdf`);
}
