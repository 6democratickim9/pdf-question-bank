import type { BankStatistics, MasteryRecord, Question, WrongReviewItem } from '../types';

const tokens = (values: string[]) => new Set(values.flatMap((value) => value.toLowerCase().split(/[^\p{L}\p{N}]+/u)).filter(Boolean));
const overlap = (a: string[], b: string[]) => { const left = tokens(a); const right = tokens(b); return [...left].filter((x) => right.has(x)).length; };

export function relatedQuestionScores(source: Question, questions: Question[]) {
  const analysis = source.analysis;
  if (!analysis) return [];
  return questions.filter((q) => q.id !== source.id && q.analysis).map((question) => {
    const other = question.analysis!;
    let score = 0;
    if (analysis.concept === other.concept) score += 5;
    if (analysis.problemPattern === other.problemPattern) score += 4;
    score += Math.min(3, overlap(analysis.primaryServices, other.primaryServices) * 3);
    score += Math.min(3, overlap(analysis.architecturePath, other.architecturePath));
    if (analysis.examTrap && analysis.examTrap === other.examTrap) score += 2;
    score += Math.min(1, overlap(analysis.keyClues, other.keyClues));
    return { question, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || a.question.id.localeCompare(b.question.id));
}

export function questionsForWrongQueue(questions: Question[], wrongIds: string[]) {
  const wrongIdSet = new Set(wrongIds);
  return questions.filter((question) => wrongIdSet.has(question.id));
}

export function updateMastery(stats: BankStatistics, question: Question, correct: boolean): BankStatistics {
  const update = (records: Record<string, MasteryRecord> | undefined, key?: string) => {
    if (!key) return records ?? {};
    const prior = records?.[key] ?? { attempts: 0, correct: 0, percentage: 0 };
    const attempts = prior.attempts + 1; const right = prior.correct + (correct ? 1 : 0);
    return { ...(records ?? {}), [key]: { attempts, correct: right, percentage: Math.round(right / attempts * 100) } };
  };
  return { ...stats, conceptMastery: update(stats.conceptMastery, question.analysis?.concept), patternMastery: update(stats.patternMastery, question.analysis?.problemPattern) };
}

export function recordWrongAttempt(previous: WrongReviewItem | undefined, bankId: string, question: Question, selected: string[], correct: boolean, now = new Date().toISOString()): WrongReviewItem {
  return { bankId, questionId: question.id, wrongCount: (previous?.wrongCount ?? 0) + (correct ? 0 : 1), retryCount: (previous?.retryCount ?? 0) + 1,
    firstWrongAt: previous?.firstWrongAt ?? now, lastAttemptAnswer: selected, lastAttemptCorrect: correct, resolved: correct, lastReviewedAt: now,
    resolvedAt: correct ? now : undefined, concept: question.analysis?.concept, pattern: question.analysis?.problemPattern };
}
