import type { ParsingWarning, Question } from '../../types';
import { createId } from '../id';
import type { QuestionBlock } from './detectQuestions';
import { ANSWER_START, CHOICE_START, EXPLANATION_START, EXPLICIT_QUESTION_START, NUMBERED_QUESTION_START, PAGE_NOISE } from './parserPatterns';

export function parseQuestionBlock(block: QuestionBlock, duplicate = false): Question {
  const rawLines = block.lines.filter((line) => !PAGE_NOISE.test(line.text));
  const sourcePages = [...new Set(rawLines.map((line) => line.pageNumber))];
  const first = rawLines[0]?.text ?? '';
  const startMatch = first.match(EXPLICIT_QUESTION_START) ?? first.match(NUMBERED_QUESTION_START);
  const body: string[] = [startMatch?.[2] ?? ''];
  const choices: { key: string; text: string }[] = [];
  const answers: string[] = [];
  const explanation: string[] = [];
  let mode: 'body' | 'choice' | 'explanation' = 'body';

  for (const { text } of rawLines.slice(1)) {
    const answer = text.match(ANSWER_START);
    if (answer) {
      answers.push(...(answer[1].toUpperCase().match(/[A-H]/g) ?? []));
      mode = 'body';
      continue;
    }
    const exp = text.match(EXPLANATION_START);
    if (exp) { mode = 'explanation'; if (exp[1]) explanation.push(exp[1]); continue; }
    const choice = text.match(CHOICE_START);
    if (choice && mode !== 'explanation') {
      choices.push({ key: choice[1].toUpperCase(), text: choice[2].trim() }); mode = 'choice'; continue;
    }
    const clean = text.trim();
    if (!clean) continue;
    if (mode === 'explanation') explanation.push(clean);
    else if (mode === 'choice' && choices.length) choices[choices.length - 1].text += ` ${clean}`;
    else body.push(clean);
  }
  const question = body.filter(Boolean).join(' ').trim();
  const warnings: ParsingWarning[] = [];
  if (!question) warnings.push('EMPTY_QUESTION');
  if (!choices.length) warnings.push('NO_CHOICES');
  else if (choices.length < 2) warnings.push('LESS_THAN_TWO_CHOICES');
  if (!answers.length) warnings.push('NO_ANSWER');
  if (duplicate) warnings.push('DUPLICATE_NUMBER');
  if (!startMatch) warnings.push('UNKNOWN_FORMAT');
  return {
    id: createId(), originalNumber: block.number, question, choices,
    correctAnswers: [...new Set(answers)], explanation: explanation.join(' ').trim() || undefined,
    sourcePages, rawText: rawLines.map((line) => line.text).join('\n'), warnings,
  };
}
