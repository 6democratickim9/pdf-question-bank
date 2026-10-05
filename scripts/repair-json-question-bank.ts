import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Question } from '../src/types';

const statePath = resolve('data/pdf-question-bank-state.json');
const canonicalPath = resolve('data/dva-c02-questions.json');
const state = JSON.parse(await readFile(statePath, 'utf8'));
const canonical = JSON.parse(await readFile(canonicalPath, 'utf8')) as Question[];
const bank = state.questionBanks.find((item: { name: string }) => item.name.includes('dva-c02'));
if (!bank) throw new Error('DVA 문제은행을 찾을 수 없습니다.');

const oldQuestions = bank.questions as Question[];
const firstOldByNumber = new Map<number, Question>();
for (const question of oldQuestions) if (question.originalNumber != null && !firstOldByNumber.has(question.originalNumber)) firstOldByNumber.set(question.originalNumber, question);
const idMap = new Map<string, string>();
const repairedQuestions = canonical.map((question) => {
  const previous = question.originalNumber == null ? undefined : firstOldByNumber.get(question.originalNumber);
  const id = previous?.id ?? question.id;
  if (previous) idMap.set(previous.id, id);
  const stripPageMarker = (value = '') => value.replace(/\s+(\d{1,4})\s*$/, (match, page) => question.sourcePages.includes(Number(page)) ? '' : match).trim();
  const repaired = { ...question, id, choices: question.choices.map((choice) => ({ ...choice, text: stripPageMarker(choice.text) })), explanation: stripPageMarker(question.explanation), ...(previous?.analysis ? { analysis: previous.analysis, analysisStatus: previous.analysisStatus } : {}) };
  if (question.originalNumber === 45) repaired.question = '개발자가 AWS Lambda 함수를 작성하고 있다. 개발자는 Lambda 함수가 실행되는 동안 발생하는 주요 이벤트를 로깅하려 한다. 개발자는 이벤트를 특정 함수 호출과 연관 짓기 위해 고유한 식별자를 포함하길 원한다. 개발자는 Lambda 함수에 다음 코드를 추가했다: `function handler(event, context) { }` 어떤 솔루션이 이 요구 사항을 충족하는가?';
  if (question.originalNumber === 49) repaired.question = '개발자가 Amazon S3 버킷에 대한 액세스를 제공하기 위해 다음 IAM 정책을 작성했다. `{ "Version": "2012-10-17", "Statement": [{ "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject"], "Resource": "arn:aws:s3:::DOC-EXAMPLE-BUCKET/*" }, { "Effect": "Deny", "Action": "s3:*", "Resource": "arn:aws:s3:::DOC-EXAMPLE-BUCKET/secrets*" }] }` 이 정책은 s3:GetObject 및 s3:PutObject 작업과 관련하여 어떤 액세스를 허용하는가?';
  if (question.originalNumber === 75) repaired.choices = [
    { key: 'A', text: '{ "source": ["aws.codecommit"], "detail": { "event": ["pullRequestMergeStatusUpdated"] } }' },
    { key: 'B', text: '{ "source": ["aws.codecommit"], "detail": { "event": ["pullRequestApprovalRuleCreated"] } }' },
    { key: 'C', text: '{ "source": ["aws.codecommit"], "detail": { "event": ["pullRequestSourceBranchUpdated", "pullRequestCreated"] } }' },
    { key: 'D', text: '{ "source": ["aws.codecommit"], "detail": { "event": ["referenceCreated", "referenceUpdated"] } }' },
  ];
  if (question.originalNumber === 139) repaired.choices = [
    { key: 'A', text: '{ "Action": ["s3:GetObject"], "Effect": "Allow", "Resource": "arn:aws:s3:::DOC-EXAMPLE-BUCKET/doc.txt" }' },
    { key: 'B', text: '{ "Action": ["s3:*"], "Effect": "Allow", "Resource": "*" }' },
    { key: 'C', text: '{ "Action": ["s3:GetObject"], "Effect": "Allow", "Resource": "arn:aws:s3:::DOC-EXAMPLE-BUCKET/*" }' },
    { key: 'D', text: '{ "Action": ["s3:*"], "Effect": "Allow", "Resource": "arn:aws:s3:::DOC-EXAMPLE-BUCKET/doc.txt" }' },
  ];
  if (question.originalNumber === 443) repaired.choices = [
    { key: 'A', text: '{ "Condition": { "ForAllValues:StringEquals": { "dynamodb:LeadingKeys": ["${www.amazon.com:user_id}"], "dynamodb:Attributes": ["user_name"] } } }' },
    { key: 'B', text: '{ "Condition": { "ForAllValues:StringEquals": { "dynamodb:LeadingKeys": ["${www.amazon.com:user_name}"], "dynamodb:Attributes": ["user_id"] } } }' },
    { key: 'C', text: '{ "Condition": { "ForAllValues:StringEquals": { "dynamodb:LeadingKeys": ["${www.amazon.com:user_id}"], "dynamodb:Attributes": ["user_name", "user_id"] } } }' },
    { key: 'D', text: '{ "Condition": { "ForAllValues:StringEquals": { "dynamodb:LeadingKeys": ["${www.amazon.com:user_name}"], "dynamodb:Attributes": ["username", "userid"] } } }' },
  ];
  if (question.originalNumber === 454) repaired.choices = ['REPORT', 'DISPLAY', 'STATS', 'PATTERN'].map((type, index) => ({
    key: String.fromCharCode(65 + index),
    text: `filter @type = "${type}" | stats avg(@duration), max(@duration), min(@duration) by bin(1m)`,
  }));
  if (question.originalNumber === 236) repaired.choices = [
    { key: 'A', text: '{ "Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::DOC-EXAMPLE-BUCKET" }, { "Effect": "Allow", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::DOC-EXAMPLE-BUCKET/*" }' },
    { key: 'B', text: '{ "Effect": "Allow", "Action": "s3:*", "Resource": ["arn:aws:s3:::DOC-EXAMPLE-BUCKET", "arn:aws:s3:::DOC-EXAMPLE-BUCKET/*"] }' },
    { key: 'C', text: '{ "Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": "*" }' },
    { key: 'D', text: '{ "Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::DOC-EXAMPLE-BUCKET" }, { "Effect": "Deny", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::DOC-EXAMPLE-BUCKET/*" }' },
  ];
  if (question.originalNumber === 483) repaired.choices = [
    { key: 'A', text: '{ #if( $input.params(\'integration\') == "mock" ) "statusCode": 404 #else "statusCode": 500 #end }' },
    { key: 'B', text: '{ #if( $input.params(\'scope\') == "internal" ) "statusCode": 200 #else "statusCode": 500 #end }' },
    { key: 'C', text: '{ #if( $input.path("integration") ) "statusCode": 200 #else "statusCode": 404 #end }' },
    { key: 'D', text: '{ #if( $context.integration.status ) "statusCode": 200 #else "statusCode": 500 #end }' },
  ];
  if (question.originalNumber === 503) repaired.choices = [
    { key: 'A', text: '{ "Effect": "Allow", "Action": "dynamodb:*", "Resource": "arn:aws:dynamodb:*:*:table/DailyOrders" }' },
    { key: 'B', text: '{ "Effect": "Allow", "Action": ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:BatchWriteItem"], "Resource": "arn:aws:dynamodb:*:*:table/DailyOrders" }' },
    { key: 'C', text: '{ "Effect": "Deny", "Action": ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:BatchWriteItem"], "Resource": "arn:aws:dynamodb:*:*:table/DailyOrders" }' },
    { key: 'D', text: '{ "Effect": "Allow", "Action": ["dynamodb:BatchGetItem", "dynamodb:GetItem", "dynamodb:Query", "dynamodb:Scan"], "Resource": "arn:aws:dynamodb:*:*:table/DailyOrders" }' },
  ];
  if (question.originalNumber === 543) repaired.choices = [
    { key: 'A', text: '"Condition": { "ArnLike": { "aws:SourceArn": "arn:aws:states:ap-south-1:111111111111:stateMachine:myStateMachine" } }' },
    { key: 'B', text: '"Condition": { "StringEquals": { "aws:SourceAccount": "111111111111" } }' },
    { key: 'C', text: '"Condition": { "StringNotEquals": { "aws:SourceArn": "arn:aws:states:ap-south-1:111111111111:stateMachine:myStateMachine" } }' },
    { key: 'D', text: '"Condition": { "ArnLike": { "aws:SourceArn": "arn:aws:states:ap-south-1:*:stateMachine:myStateMachine" } }' },
  ];
  if (question.originalNumber === 551) repaired.choices = [
    { key: 'A', text: 'GetItem: { "TableName": "orders", "Key": { "accountId": { "N": "100" } } }' },
    { key: 'B', text: 'BatchGetItem: { "RequestItems": { "orders": { "Keys": [{ "accountId": { "N": "100" } }] } } }' },
    { key: 'C', text: 'Scan: { "TableName": "orders", "IndexName": "accountIndex", "FilterExpression": "accountId = :accountId", "ExpressionAttributeValues": { ":accountId": { "N": "100" } } }' },
    { key: 'D', text: 'Query: { "TableName": "orders", "IndexName": "accountIndex", "KeyConditionExpression": "accountId = :accountId", "ExpressionAttributeValues": { ":accountId": { "N": "100" } } }' },
  ];
  return repaired;
});
for (const previous of oldQuestions) {
  const replacement = previous.originalNumber == null ? undefined : repairedQuestions.find((item) => item.originalNumber === previous.originalNumber);
  if (replacement) idMap.set(previous.id, replacement.id);
}
const mapId = (id: string) => idMap.get(id);
const mapIds = (ids: string[]) => [...new Set(ids.map(mapId).filter((id): id is string => !!id))];
for (const session of state.examSessions) {
  session.questionIds = mapIds(session.questionIds);
  session.answers = Object.fromEntries(Object.entries(session.answers ?? {}).flatMap(([id, answers]) => { const mapped = mapId(id); return mapped ? [[mapped, answers]] : []; }));
  session.currentIndex = Math.min(session.currentIndex ?? 0, Math.max(0, session.questionIds.length - 1));
}
const invalidResult = (result: { results: Array<{ unanswered: boolean; correct: boolean }> }) => result.results.length > 0 && result.results.every((item) => item.unanswered && item.correct);
state.cycleResults = state.cycleResults.filter((result: { results: Array<{ unanswered: boolean; correct: boolean }> }) => !invalidResult(result)).map((result: { results: Array<{ questionId: string }> }) => ({ ...result, results: result.results.flatMap((item) => { const questionId = mapId(item.questionId); return questionId ? [{ ...item, questionId }] : []; }) }));
const validCompletedCycles = [...new Set(state.cycleResults.filter((result: { kind: string; cycleNumber?: number }) => result.kind === 'normal' && result.cycleNumber).map((result: { cycleNumber: number }) => result.cycleNumber))];
const completedResultIds = new Set<string>(state.cycleResults.flatMap((result: { results: Array<{ questionId: string }> }) => result.results.map((item) => item.questionId)));
for (const stats of state.statistics) if (stats.bankId === bank.id) { stats.completedQuestionIds = mapIds(stats.completedQuestionIds).filter((id) => completedResultIds.has(id)); stats.completedCycles = validCompletedCycles; }
for (const wrong of state.wrongAnswers) if (wrong.bankId === bank.id) wrong.questionIds = mapIds(wrong.questionIds);
state.wrongHistory = state.wrongHistory.flatMap((item: { questionId: string }) => { const questionId = mapId(item.questionId); return questionId ? [{ ...item, questionId }] : []; });
state.bookmarks = state.bookmarks.flatMap((item: { questionId: string }) => { const questionId = mapId(item.questionId); return questionId ? [{ ...item, questionId }] : []; });
bank.questions = repairedQuestions;

const repairedByNumber = new Map(repairedQuestions.map((question) => [question.originalNumber, question]));
const canonicalRepaired = canonical.map((question) => {
  const repaired = repairedByNumber.get(question.originalNumber);
  return repaired ? { ...question, question: repaired.question, choices: repaired.choices, explanation: repaired.explanation } : question;
});

const backupPath = `${statePath}.pre-content-repair-2026-09-29.json`;
await copyFile(statePath, backupPath);
const temporary = `${statePath}.tmp`;
await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
await rename(temporary, statePath);
await writeFile(canonicalPath, `${JSON.stringify(canonicalRepaired, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ backupPath, questions: repairedQuestions.length, validCompletedCycles, wrongCount: state.wrongAnswers.find((item: { bankId: string }) => item.bankId === bank.id)?.questionIds.length ?? 0 }, null, 2));
