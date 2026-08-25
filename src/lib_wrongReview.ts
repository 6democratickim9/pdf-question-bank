export interface WrongQueueTransition {
  questionIds: string[];
  currentIndex: number;
  finished: boolean;
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
