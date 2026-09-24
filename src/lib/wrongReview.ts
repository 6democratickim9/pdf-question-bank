import type { ExamSession } from '../types';

export interface WrongQueueTransition {
  questionIds: string[];
  currentIndex: number;
  finished: boolean;
}

export function continueWrongReviewSession(
  session: ExamSession,
  questionIds: string[],
): ExamSession {
  return {
    ...session,
    questionIds: [...questionIds],
    currentIndex: 0,
    answers: {},
    status: 'active',
  };
}

export function synchronizeWrongReviewSession(
  session: ExamSession,
  bankQuestionIds: string[],
  persistedWrongIds: string[],
): ExamSession {
  const persisted = new Set(persistedWrongIds);
  const currentQuestionId = session.questionIds[session.currentIndex];
  const retained = session.questionIds.filter((id) => persisted.has(id));
  const retainedSet = new Set(retained);
  const missing = bankQuestionIds.filter(
    (id) => persisted.has(id) && !retainedSet.has(id),
  );
  const questionIds = [...retained, ...missing];
  const currentIndex = currentQuestionId
    ? Math.max(0, questionIds.indexOf(currentQuestionId))
    : 0;

  return {
    ...session,
    questionIds,
    currentIndex,
    status: questionIds.length ? 'active' : 'submitted',
  };
}

export function openWrongReviewQuestion(
  session: ExamSession,
  questionId: string,
): ExamSession {
  const questionIds = [...session.questionIds];
  let currentIndex = questionIds.indexOf(questionId);

  if (currentIndex < 0) {
    currentIndex = Math.min(
      Math.max(session.currentIndex, 0),
      questionIds.length,
    );
    questionIds.splice(currentIndex, 0, questionId);
  }

  const answers = { ...session.answers };
  delete answers[questionId];

  return {
    ...session,
    questionIds,
    currentIndex,
    answers,
    status: 'active',
  };
}

export function advanceWrongReviewQueue(
  questionIds: string[],
  currentIndex: number,
  questionId: string,
  correct: boolean,
): WrongQueueTransition {
  const next = [...questionIds];
  let index = next.indexOf(questionId);

  if (index < 0) {
    index = Math.min(Math.max(currentIndex, 0), Math.max(next.length - 1, 0));
  }

  if (next.length) next.splice(index, 1);
  if (!correct) next.push(questionId);

  return {
    questionIds: next,
    currentIndex: next.length ? Math.min(index, next.length - 1) : 0,
    finished: next.length === 0,
  };
}
