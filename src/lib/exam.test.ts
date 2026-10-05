import { describe, expect, it } from 'vitest';
import { answerIsCorrect, createRangeSession, gradeSession, questionsInRange, shuffledBySeed } from './exam';
import type { Question } from '../types';

const question = (id: string, originalNumber?: number): Question => ({ id, originalNumber, question: id, choices: [], correctAnswers: ['A'], sourcePages: [] });

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

describe('wrong-note answer order', () => {
  it('keeps a shuffled order stable inside one session and preserves every original answer key', () => {
    const choices = ['A', 'B', 'C', 'D'];
    const first = shuffledBySeed(choices, 'session-1:question-1');
    expect(shuffledBySeed(choices, 'session-1:question-1')).toEqual(first);
    expect([...first].sort()).toEqual(choices);
  });

  it('uses a different order for a new wrong-note session', () => {
    const choices = ['A', 'B', 'C', 'D'];
    expect(shuffledBySeed(choices, 'session-1:question-1')).not.toEqual(shuffledBySeed(choices, 'session-2:question-1'));
  });
});

describe('range mock exam', () => {
  it('selects only questions whose original number is inside the requested range', () => {
    const questions = [question('q10', 10), question('q11', 11), question('q13', 13), question('fallback')];
    expect(questionsInRange(questions, 11, 13).map((item) => item.id)).toEqual(['q11', 'q13']);
  });

  it('stores the range and gives one minute per selected question', () => {
    const session = createRangeSession('bank', [question('q1', 1), question('q2', 2), question('q3', 3)], 2, 3);
    expect(session.questionIds).toHaveLength(2);
    expect(session).toMatchObject({ kind: 'normal', rangeStart: 2, rangeEnd: 3, cycleNumber: undefined });
    expect(new Date(session.endAt!).getTime() - new Date(session.startedAt).getTime()).toBe(2 * 60 * 1000);
  });

  it('keeps the source range result on a dedicated retry result', () => {
    const session = { ...createRangeSession('bank', [question('q1', 1)], 1, 1), kind: 'practice' as const, reviewOfResultId: 'range-result' };
    const result = gradeSession(session, [question('q1', 1)]);
    expect(result).toMatchObject({ rangeStart: 1, rangeEnd: 1, reviewOfResultId: 'range-result' });
  });
});
