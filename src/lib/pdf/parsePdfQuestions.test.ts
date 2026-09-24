import { describe, expect, it } from 'vitest';
import { parsePdfQuestions } from './parsePdfQuestions';

describe('PDF question parser', () => {
  it('Q. 형식에서는 선택지 내부의 번호 목록을 새 문제로 오인하지 않는다', () => {
    const [q] = parsePdfQuestions([{ pageNumber: 1, text: 'Q. 418 DVA-C02\n올바른 단계는?\nA. 1. 빌드한다.\n2. 패키징한다.\n3. 배포한다.\nB. 다른 순서\n정답 및 해설\n정답 A\nA가 올바르다.' }]);
    expect(q.originalNumber).toBe(418); expect(q.choices).toHaveLength(2); expect(q.correctAnswers).toEqual(['A']);
  });
  it('parses a complete question', () => {
    const [q] = parsePdfQuestions([{ pageNumber: 1, text: 'Question 1\nWhat is correct?\nA. One\nB. Two\nCorrect Answer: B\nExplanation: Because.' }]);
    expect(q.question).toBe('What is correct?'); expect(q.choices).toHaveLength(2); expect(q.correctAnswers).toEqual(['B']);
  });
  it('continues choices across page boundaries', () => {
    const [q] = parsePdfQuestions([{ pageNumber: 1, text: 'Question 3\nPick one\nA. A\nB. B' }, { pageNumber: 2, text: 'C. C\nD. D\nCorrect Answer: C' }]);
    expect(q.choices).toHaveLength(4); expect(q.sourcePages).toEqual([1, 2]);
  });
  it('continues explanations across pages', () => {
    const [q] = parsePdfQuestions([{ pageNumber: 1, text: 'Q1\nText\nA) no\nB) yes\nAnswer: B\nExplanation:' }, { pageNumber: 2, text: 'This continues.' }]);
    expect(q.explanation).toBe('This continues.');
  });
  it('supports multiple answers', () => {
    const [q] = parsePdfQuestions([{ pageNumber: 1, text: 'QUESTION 1\nText\nA: a\nB: b\nC: c\nD: d\nCorrect Answers: B, D' }]);
    expect(q.correctAnswers).toEqual(['B', 'D']);
  });
  it('warns when answer is missing', () => {
    const [q] = parsePdfQuestions([{ pageNumber: 1, text: '1. Text\nA. a\nB. b' }]);
    expect(q.warnings).toContain('NO_ANSWER');
  });
  it('ignores page headers and detects duplicate numbers', () => {
    const qs = parsePdfQuestions([{ pageNumber: 1, text: 'Page 1\nQuestion 1\nFirst\nA. a\nB. b\nAnswer: A\nPage 2\nQuestion 1\nSecond\nA. a\nB. b\nAnswer: B' }]);
    expect(qs).toHaveLength(2); expect(qs[0].warnings).toContain('DUPLICATE_NUMBER');
  });
  it('supports Korean answer and explanation labels', () => {
    const [q] = parsePdfQuestions([{ pageNumber: 1, text: 'Question 1\n질문입니다\nA. 보기 1\nB. 보기 2\n정답 및 해설\n정답 B\n정답은 B이다.' }]);
    expect(q.correctAnswers).toEqual(['B']); expect(q.explanation).toBe('정답은 B이다.'); expect(q.choices[1].text).toBe('보기 2');
  });
  it('removes a repeated certification code at the start of a question', () => {
    const [q] = parsePdfQuestions([{ pageNumber: 1, text: 'Question 1\nDVA-C02 개발자는 무엇을 해야 합니까?\nA. 보기 1\nB. 보기 2\n정답: A' }]);
    expect(q.question).toBe('개발자는 무엇을 해야 합니까?');
  });
});
