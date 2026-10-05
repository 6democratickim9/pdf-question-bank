import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Question } from '../types';

describe('canonical DVA question data', () => {
  it('Q45 이미지형 Lambda 핸들러 코드를 본문에 보존한다', async () => {
    const state = JSON.parse(await readFile(resolve('data/pdf-question-bank-state.json'), 'utf8'));
    const question = (state.questionBanks[0].questions as Question[]).find((item) => item.originalNumber === 45)!;
    expect(question.question).toContain('function handler(event, context)');
    expect(question.choices).toHaveLength(4);
    expect(question.correctAnswers).toEqual(['A']);
  });

  it('Q49 이미지형 IAM 정책을 본문에 보존한다', async () => {
    const state = JSON.parse(await readFile(resolve('data/pdf-question-bank-state.json'), 'utf8'));
    const question = (state.questionBanks[0].questions as Question[]).find((item) => item.originalNumber === 49)!;
    expect(question.question).toContain('"Action": ["s3:GetObject", "s3:PutObject"]');
    expect(question.question).toContain('DOC-EXAMPLE-BUCKET/secrets*');
    expect(question.correctAnswers).toEqual(['D']);
  });

  it.each([
    [75, 'pullRequestSourceBranchUpdated'],
    [236, 's3:ListBucket'],
    [543, 'aws:SourceArn'],
  ])('Q%s 이미지형 선택지를 모두 보존한다', async (number, expected) => {
    const state = JSON.parse(await readFile(resolve('data/pdf-question-bank-state.json'), 'utf8'));
    const question = (state.questionBanks[0].questions as Question[]).find((item) => item.originalNumber === number)!;
    expect(question.choices).toHaveLength(4);
    expect(question.choices.every((choice) => choice.text.trim().length > 20)).toBe(true);
    expect(question.choices.some((choice) => choice.text.includes(expected))).toBe(true);
  });

  it('Q139 IAM 정책 선택지를 모두 보존한다', async () => {
    const state = JSON.parse(await readFile(resolve('data/pdf-question-bank-state.json'), 'utf8'));
    const question = (state.questionBanks[0].questions as Question[]).find((item) => item.originalNumber === 139)!;
    expect(question.choices).toHaveLength(4);
    expect(question.choices.every((choice) => choice.text.trim().length > 20)).toBe(true);
    expect(question.choices[0].text).toContain('s3:GetObject');
    expect(question.choices[0].text).toContain('DOC-EXAMPLE-BUCKET/doc.txt');
  });

  it('Q179 복수 정답과 선택지·해설 경계를 보존한다', async () => {
    const state = JSON.parse(await readFile(resolve('data/pdf-question-bank-state.json'), 'utf8'));
    const question = (state.questionBanks[0].questions as Question[]).find((item) => item.originalNumber === 179)!;
    expect(question.correctAnswers).toEqual(['B', 'E']);
    expect(question.choices).toHaveLength(5);
    expect(question.choices[4].text).toBe('애플리케이션에 AWS X-Ray SDK for Python을 설치하고 구성한다.');
    expect(question.explanation).not.toMatch(/\s183$/);
  });

  it('Q183 선택지와 해설에서 PDF 페이지 번호를 분리한다', async () => {
    const state = JSON.parse(await readFile(resolve('data/pdf-question-bank-state.json'), 'utf8'));
    const question = (state.questionBanks[0].questions as Question[]).find((item) => item.originalNumber === 183)!;
    expect(question.correctAnswers).toEqual(['C', 'D']);
    expect(question.choices.every((choice) => choice.text.trim().length > 0)).toBe(true);
    expect(question.explanation).not.toMatch(/\s187$/);
  });

  it('Q443 이미지형 IAM 정책 선택지를 읽을 수 있는 코드로 보존한다', async () => {
    const state = JSON.parse(await readFile(resolve('data/pdf-question-bank-state.json'), 'utf8'));
    const question = (state.questionBanks[0].questions as Question[]).find((item) => item.originalNumber === 443)!;
    expect(question.correctAnswers).toEqual(['C']);
    expect(question.choices).toHaveLength(4);
    expect(question.choices.every((choice) => choice.text.includes('dynamodb:LeadingKeys') && choice.text.includes('dynamodb:Attributes'))).toBe(true);
    expect(question.choices[2].text).toContain('"user_name", "user_id"');
  });

  it('Q454 이미지형 CloudWatch Logs Insights 쿼리를 보존한다', async () => {
    const state = JSON.parse(await readFile(resolve('data/pdf-question-bank-state.json'), 'utf8'));
    const question = (state.questionBanks[0].questions as Question[]).find((item) => item.originalNumber === 454)!;
    expect(question.correctAnswers).toEqual(['A']);
    expect(question.choices).toHaveLength(4);
    expect(question.choices.every((choice) => choice.text.includes('avg(@duration)') && choice.text.includes('bin(1m)'))).toBe(true);
    expect(question.choices[0].text).toContain('@type = "REPORT"');
  });

  it('Q483 이미지형 API Gateway 매핑 템플릿 선택지를 보존한다', async () => {
    const state = JSON.parse(await readFile(resolve('data/pdf-question-bank-state.json'), 'utf8'));
    const question = (state.questionBanks[0].questions as Question[]).find((item) => item.originalNumber === 483)!;
    expect(question.correctAnswers).toEqual(['B']);
    expect(question.choices).toHaveLength(4);
    expect(question.choices.every((choice) => choice.text.includes('statusCode'))).toBe(true);
    expect(question.choices[1].text).toContain("$input.params('scope')");
    expect(question.choices[1].text).toContain('"statusCode": 200');
  });

  it('Q503 이미지형 DynamoDB 읽기 전용 정책 선택지를 보존한다', async () => {
    const state = JSON.parse(await readFile(resolve('data/pdf-question-bank-state.json'), 'utf8'));
    const question = (state.questionBanks[0].questions as Question[]).find((item) => item.originalNumber === 503)!;
    expect(question.correctAnswers).toEqual(['D']);
    expect(question.choices).toHaveLength(4);
    expect(question.choices.every((choice) => choice.text.includes('DailyOrders'))).toBe(true);
    expect(question.choices[3].text).toContain('dynamodb:BatchGetItem');
    expect(question.choices[3].text).toContain('dynamodb:Scan');
    expect(question.choices[3].text).not.toContain('PutItem');
  });

  it('Q551 이미지형 DynamoDB 요청 매개변수를 보존한다', async () => {
    const state = JSON.parse(await readFile(resolve('data/pdf-question-bank-state.json'), 'utf8'));
    const question = (state.questionBanks[0].questions as Question[]).find((item) => item.originalNumber === 551)!;
    expect(question.correctAnswers).toEqual(['D']);
    expect(question.choices.every((choice) => choice.text.includes('accountId'))).toBe(true);
    expect(question.choices[3].text).toContain('KeyConditionExpression');
    expect(question.choices[3].text).toContain('accountIndex');
  });
});
