import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { CycleResult, QuestionBank, WrongAnswers } from '../src/types';

interface State {
  questionBanks: QuestionBank[];
  cycleResults: CycleResult[];
  wrongAnswers: WrongAnswers[];
}

const statePath = resolve('data/pdf-question-bank-state.json');
const backupPath = `${statePath}.pre-range-wrong-refresh-2026-10-03.json`;
const state = JSON.parse(await readFile(statePath, 'utf8')) as State;

for (const bank of state.questionBanks) {
  const validQuestionIds = new Set(bank.questions.map((question) => question.id));
  const rangeResults = state.cycleResults.filter((result) =>
    result.bankId === bank.id
    && result.rangeStart != null
    && (result.kind === 'normal' || result.reviewOfResultId != null));
  const rangeWrongIds = [...new Set(rangeResults.flatMap((result) =>
    result.results.filter((item) => !item.correct && validQuestionIds.has(item.questionId)).map((item) => item.questionId)))];
  const stored = state.wrongAnswers.find((item) => item.bankId === bank.id);
  if (stored) stored.questionIds = rangeWrongIds;
  else state.wrongAnswers.push({ bankId: bank.id, questionIds: rangeWrongIds });
  console.log(`${bank.name}: 범위시험 ${rangeResults.length}회, 누적 오답 ${rangeWrongIds.length}개`);
}

await copyFile(statePath, backupPath);
const temporaryPath = `${statePath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
await rename(temporaryPath, statePath);
console.log(`백업: ${backupPath}`);
