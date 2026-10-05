import type { CycleResult, ExamKind, ExamSession, Question, QuestionResult } from '../types';
import { createId } from './id';

export const CYCLE_SIZE = 90;
export const EXAM_DURATION_MS = 90 * 60 * 1000;
export const EXAM_MINUTES_PER_QUESTION = 1;
export const answerIsCorrect = (selected: string[], correct: string[]) =>
  selected.length > 0 && correct.length > 0 && selected.length === correct.length && [...selected].sort().every((answer, i) => answer === [...correct].sort()[i]);

export function shuffledBySeed<T>(values: T[], seed: string): T[] {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const target = (state >>> 0) % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function createSession(bankId: string, kind: ExamKind, questions: Question[], cycleNumber?: number): ExamSession {
  const questionIds = questions.map((q) => q.id);
  for (let i = questionIds.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [questionIds[i], questionIds[j]] = [questionIds[j], questionIds[i]]; }
  const started = Date.now();
  return { id: createId(), bankId, kind, cycleNumber, questionIds, answers: {}, currentIndex: 0,
    startedAt: new Date(started).toISOString(), updatedAt: new Date(started).toISOString(), endAt: kind === 'normal' ? new Date(started + EXAM_DURATION_MS).toISOString() : undefined, status: 'active' };
}

export function questionsInRange(questions: Question[], start: number, end: number): Question[] {
  return questions.filter((question, index) => {
    const number = question.originalNumber ?? index + 1;
    return number >= start && number <= end;
  });
}

export function createRangeSession(bankId: string, questions: Question[], start: number, end: number): ExamSession {
  const selected = questionsInRange(questions, start, end);
  const session = createSession(bankId, 'normal', selected);
  const duration = Math.max(1, selected.length) * EXAM_MINUTES_PER_QUESTION * 60 * 1000;
  return { ...session, rangeStart: start, rangeEnd: end, endAt: new Date(new Date(session.startedAt).getTime() + duration).toISOString() };
}

export function gradeSession(session: ExamSession, questions: Question[]): CycleResult {
  const map = new Map(questions.map((q) => [q.id, q]));
  const results: QuestionResult[] = session.questionIds.map((questionId) => {
    const selected = session.answers[questionId] ?? []; const correct = map.get(questionId)?.correctAnswers ?? [];
    return { questionId, selected, correct: answerIsCorrect(selected, correct), unanswered: !selected.length };
  });
  return { id: createId(), sessionId: session.id, bankId: session.bankId, kind: session.kind,
    cycleNumber: session.cycleNumber, rangeStart: session.rangeStart, rangeEnd: session.rangeEnd, reviewOfResultId: session.reviewOfResultId, completedAt: new Date().toISOString(), results };
}
