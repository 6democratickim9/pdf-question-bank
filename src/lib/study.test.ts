import { describe, expect, it } from 'vitest';
import { questionsForWrongQueue, recordWrongAttempt, relatedQuestionScores, updateMastery } from './study';
import type { Question, QuestionAnalysis } from '../types';

const analysis = (overrides: Partial<QuestionAnalysis> = {}): QuestionAnalysis => ({ domain: 'Development with AWS Services', part: 'PART 1 Lambda', primaryServices: ['AWS Lambda'], secondaryServices: [], concept: 'Lambda Concurrency', problemPattern: 'Concurrency Control', architecturePath: ['Amazon SQS', 'AWS Lambda'], keyClues: ['maximum concurrent requests'], decisionPoint: 'What is limited?', reasoningPath: ['Find clue', 'Eliminate distractors'], correctAnswerRule: 'Use maximum concurrency', examTrap: 'Reserved vs provisioned', distractorAnalysis: [], difficulty: 3, ...overrides });
const question = (id: string, overrides: Partial<QuestionAnalysis> = {}): Question => ({ id, question: id, choices: [], correctAnswers: ['A'], sourcePages: [], analysis: analysis(overrides) });

describe('DVA study data', () => {
  it('concept와 pattern이 같은 문제를 우선 추천한다', () => { const source = question('a'); const close = question('b'); const far = question('c', { concept: 'DynamoDB GSI', problemPattern: 'GSI', primaryServices: ['Amazon DynamoDB'], architecturePath: ['DynamoDB'], keyClues: ['index'] }); expect(relatedQuestionScores(source, [source, far, close])[0].question.id).toBe('b'); });
  it('concept mastery에 시도와 정답을 누적한다', () => { const first = updateMastery({ bankId: 'b', completedQuestionIds: [], completedCycles: [] }, question('a'), false); const second = updateMastery(first, question('a'), true); expect(second.conceptMastery?.['Lambda Concurrency']).toEqual({ attempts: 2, correct: 1, percentage: 50 }); });
  it('해결해도 오답 횟수는 보존한다', () => { const wrong = recordWrongAttempt(undefined, 'b', question('a'), ['B'], false, '2026-01-01'); const resolved = recordWrongAttempt(wrong, 'b', question('a'), ['A'], true, '2026-01-02'); expect(resolved).toMatchObject({ wrongCount: 1, retryCount: 2, resolved: true, resolvedAt: '2026-01-02' }); });
  it('화면 필터와 무관하게 저장된 전체 오답으로 큐를 만든다', () => {
    const questions = [question('a'), question('b'), question('c')];
    expect(questionsForWrongQueue(questions, ['c', 'a', 'missing']).map((item) => item.id)).toEqual(['a', 'c']);
  });
});
