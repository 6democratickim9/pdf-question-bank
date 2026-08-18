import type { CycleResult, ExamKind, ExamSession, Question, QuestionResult } from '../types';
import { createId } from './id';

export const CYCLE_SIZE = 90;
export const EXAM_DURATION_MS = 90 * 60 * 1000;
export const answerIsCorrect = (selected: string[], correct: string[]) =>
  selected.length > 0 && correct.length > 0 && selected.length === correct.length && [...selected].sort().every((answer, i) => answer === [...correct].sort()[i]);

export function createSession(bankId: string, kind: ExamKind, questions: Question[], cycleNumber?: number): ExamSession {
  const questionIds = questions.map((q) => q.id);
  for (let i = questionIds.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [questionIds[i], questionIds[j]] = [questionIds[j], questionIds[i]]; }
  const started = Date.now();
  return { id: createId(), bankId, kind, cycleNumber, questionIds, answers: {}, currentIndex: 0,
    startedAt: new Date(started).toISOString(), updatedAt: new Date(started).toISOString(), endAt: kind === 'normal' ? new Date(started + EXAM_DURATION_MS).toISOString() : undefined, status: 'active' };
}

export function gradeSession(session: ExamSession, questions: Question[]): CycleResult {
  const map = new Map(questions.map((q) => [q.id, q]));
  const results: QuestionResult[] = session.questionIds.map((questionId) => {
    const selected = session.answers[questionId] ?? []; const correct = map.get(questionId)?.correctAnswers ?? [];
    return { questionId, selected, correct: answerIsCorrect(selected, correct), unanswered: !selected.length };
  });
  return { id: createId(), sessionId: session.id, bankId: session.bankId, kind: session.kind,
    cycleNumber: session.cycleNumber, completedAt: new Date().toISOString(), results };
}
