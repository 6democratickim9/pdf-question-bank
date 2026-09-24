import { describe, expect, it } from 'vitest';
import {
  advanceWrongReviewQueue,
  continueWrongReviewSession,
  openWrongReviewQuestion,
  synchronizeWrongReviewSession,
} from './wrongReview';
import type { ExamSession } from '../types';

describe('advanceWrongReviewQueue', () => {
  it('틀린 문제를 현재 위치에서 제거하고 맨 뒤로 보낸다', () => {
    expect(advanceWrongReviewQueue(['a', 'b', 'c'], 1, 'b', false)).toEqual({
      questionIds: ['a', 'c', 'b'],
      currentIndex: 1,
      finished: false,
    });
  });

  it('맞힌 문제는 큐에서 제거한다', () => {
    expect(advanceWrongReviewQueue(['a', 'b', 'c'], 1, 'b', true)).toEqual({
      questionIds: ['a', 'c'],
      currentIndex: 1,
      finished: false,
    });
  });

  it('마지막 문제를 맞히면 이전 인덱스로 안전하게 이동한다', () => {
    expect(advanceWrongReviewQueue(['a', 'b', 'c'], 2, 'c', true)).toEqual({
      questionIds: ['a', 'b'],
      currentIndex: 1,
      finished: false,
    });
  });

  it('문제 하나를 틀리면 같은 문제가 다시 큐에 남는다', () => {
    expect(advanceWrongReviewQueue(['a'], 0, 'a', false)).toEqual({
      questionIds: ['a'],
      currentIndex: 0,
      finished: false,
    });
  });

  it('마지막 남은 문제를 맞히면 오답노트가 끝난다', () => {
    expect(advanceWrongReviewQueue(['a'], 0, 'a', true)).toEqual({
      questionIds: [],
      currentIndex: 0,
      finished: true,
    });
  });
});

describe('synchronizeWrongReviewSession', () => {
  it('기존의 일부 큐를 저장된 전체 오답 큐로 확장한다', () => {
    const session: ExamSession = {
      id: 'session-1', bankId: 'bank-1', kind: 'wrong',
      questionIds: ['c'], answers: {}, currentIndex: 0,
      startedAt: '2026-09-24T00:00:00.000Z', status: 'active',
    };
    expect(synchronizeWrongReviewSession(session, ['a', 'b', 'c', 'd'], ['a', 'c', 'd'])).toMatchObject({
      questionIds: ['c', 'a', 'd'], currentIndex: 0, status: 'active',
    });
  });

  it('더 이상 오답이 아닌 문제는 복구 큐에서 제거한다', () => {
    const session: ExamSession = {
      id: 'session-1', bankId: 'bank-1', kind: 'wrong',
      questionIds: ['a', 'b'], answers: {}, currentIndex: 1,
      startedAt: '2026-09-24T00:00:00.000Z', status: 'active',
    };
    expect(synchronizeWrongReviewSession(session, ['a', 'b', 'c'], ['a', 'c'])).toMatchObject({
      questionIds: ['a', 'c'], currentIndex: 0, status: 'active',
    });
  });
});

describe('continueWrongReviewSession', () => {
  it('메인 화면으로 나가지 않고 현재 세션의 큐를 다시 순환한다', () => {
    const completed: ExamSession = {
      id: 'session-1',
      bankId: 'bank-1',
      kind: 'wrong',
      questionIds: [],
      answers: { a: ['A'] },
      currentIndex: 2,
      startedAt: '2026-09-24T00:00:00.000Z',
      status: 'submitted',
    };

    expect(continueWrongReviewSession(completed, ['a', 'b'])).toEqual({
      ...completed,
      questionIds: ['a', 'b'],
      answers: {},
      currentIndex: 0,
      status: 'active',
    });
  });
});

describe('openWrongReviewQuestion', () => {
  const session: ExamSession = {
    id: 'session-1',
    bankId: 'bank-1',
    kind: 'wrong',
    questionIds: ['a', 'b'],
    answers: { a: ['A'], c: ['C'] },
    currentIndex: 1,
    startedAt: '2026-09-24T00:00:00.000Z',
    status: 'active',
  };

  it('현재 큐에 있는 관련 문제 위치로 이동한다', () => {
    expect(openWrongReviewQuestion(session, 'a')).toEqual({
      ...session,
      currentIndex: 0,
      answers: { c: ['C'] },
    });
  });

  it('현재 큐에 없는 관련 문제를 현재 위치에 넣고 이동한다', () => {
    expect(openWrongReviewQuestion(session, 'c')).toEqual({
      ...session,
      questionIds: ['a', 'c', 'b'],
      currentIndex: 1,
      answers: { a: ['A'] },
    });
  });
});
