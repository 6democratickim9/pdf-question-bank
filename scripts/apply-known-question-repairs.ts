import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
type Choice = { key: string; text: string }; type Question = { originalNumber?: number; choices: Choice[] };
const repairs = new Map<number, Choice[]>([
  [75, [
    { key: 'A', text: '{ "source": ["aws.codecommit"], "detail": { "event": ["pullRequestMergeStatusUpdated"] } }' },
    { key: 'B', text: '{ "source": ["aws.codecommit"], "detail": { "event": ["pullRequestApprovalRuleCreated"] } }' },
    { key: 'C', text: '{ "source": ["aws.codecommit"], "detail": { "event": ["pullRequestSourceBranchUpdated", "pullRequestCreated"] } }' },
    { key: 'D', text: '{ "source": ["aws.codecommit"], "detail": { "event": ["referenceCreated", "referenceUpdated"] } }' },
  ]],
  [236, [
    { key: 'A', text: '{ "Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::DOC-EXAMPLE-BUCKET" }, { "Effect": "Allow", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::DOC-EXAMPLE-BUCKET/*" }' },
    { key: 'B', text: '{ "Effect": "Allow", "Action": "s3:*", "Resource": ["arn:aws:s3:::DOC-EXAMPLE-BUCKET", "arn:aws:s3:::DOC-EXAMPLE-BUCKET/*"] }' },
    { key: 'C', text: '{ "Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": "*" }' },
    { key: 'D', text: '{ "Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::DOC-EXAMPLE-BUCKET" }, { "Effect": "Deny", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::DOC-EXAMPLE-BUCKET/*" }' },
  ]],
  [543, [
    { key: 'A', text: '"Condition": { "ArnLike": { "aws:SourceArn": "arn:aws:states:ap-south-1:111111111111:stateMachine:myStateMachine" } }' },
    { key: 'B', text: '"Condition": { "StringEquals": { "aws:SourceAccount": "111111111111" } }' },
    { key: 'C', text: '"Condition": { "StringNotEquals": { "aws:SourceArn": "arn:aws:states:ap-south-1:111111111111:stateMachine:myStateMachine" } }' },
    { key: 'D', text: '"Condition": { "ArnLike": { "aws:SourceArn": "arn:aws:states:ap-south-1:*:stateMachine:myStateMachine" } }' },
  ]],
  [551, [
    { key: 'A', text: 'GetItem: { "TableName": "orders", "Key": { "accountId": { "N": "100" } } }' },
    { key: 'B', text: 'BatchGetItem: { "RequestItems": { "orders": { "Keys": [{ "accountId": { "N": "100" } }] } } }' },
    { key: 'C', text: 'Scan: { "TableName": "orders", "IndexName": "accountIndex", "FilterExpression": "accountId = :accountId", "ExpressionAttributeValues": { ":accountId": { "N": "100" } } }' },
    { key: 'D', text: 'Query: { "TableName": "orders", "IndexName": "accountIndex", "KeyConditionExpression": "accountId = :accountId", "ExpressionAttributeValues": { ":accountId": { "N": "100" } } }' },
  ]],
]);
for (const file of ['data/dva-c02-questions.json', 'data/pdf-question-bank-state.json']) {
  const path = resolve(file); const data = JSON.parse(await readFile(path, 'utf8'));
  const questions: Question[] = Array.isArray(data) ? data : data.questionBanks[0].questions;
  for (const question of questions) { const choices = question.originalNumber == null ? undefined : repairs.get(question.originalNumber); if (choices) question.choices = choices; }
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
