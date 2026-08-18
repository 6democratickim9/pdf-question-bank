import { describe, expect, it } from 'vitest';
import { answerIsCorrect } from './exam';

describe('answer grading', () => {
  it('does not mark an unanswered question with a missing parsed answer as correct', () => {
    expect(answerIsCorrect([], [])).toBe(false);
  });

  it('grades single and multiple answers independent of selection order', () => {
    expect(answerIsCorrect(['B'], ['B'])).toBe(true);
    expect(answerIsCorrect(['D', 'B'], ['B', 'D'])).toBe(true);
    expect(answerIsCorrect(['B'], ['B', 'D'])).toBe(false);
  });
});
