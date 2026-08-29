import { describe, expect, it } from 'vitest';
import { advanceWrongReviewQueue } from './lib_wrongReview';

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
