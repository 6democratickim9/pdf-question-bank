import { allowedPatterns, DVA_PARTS } from './dvaTaxonomy';
import type { Question, QuestionAnalysis, QuestionBank } from '../types';

export interface AnalysisProgress { completed: number; total: number; failed: number }
export type AnalyzeQuestion = (payload: { question: string; choices: { key: string; text: string }[]; correctAnswers: string[]; originalExplanation: string }) => Promise<unknown>;

const strings = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === 'string');
export function validateDvaAnalysis(value: unknown): QuestionAnalysis {
  if (!value || typeof value !== 'object') throw new Error('분석 결과가 객체가 아닙니다.');
  const a = value as Record<string, unknown>;
  for (const key of ['domain', 'part', 'concept', 'problemPattern', 'decisionPoint', 'correctAnswerRule', 'examTrap']) if (typeof a[key] !== 'string') throw new Error(`${key}가 없습니다.`);
  for (const key of ['primaryServices', 'secondaryServices', 'architecturePath', 'keyClues', 'reasoningPath']) if (!strings(a[key])) throw new Error(`${key} 형식이 잘못되었습니다.`);
  if (!DVA_PARTS.includes(a.part as typeof DVA_PARTS[number])) throw new Error('알 수 없는 DVA PART입니다.');
  if (a.problemPattern !== 'OTHER' && !allowedPatterns.has(a.problemPattern as string)) throw new Error('taxonomy에 없는 pattern입니다.');
  if (a.problemPattern === 'OTHER' && typeof a.suggestedPattern !== 'string') throw new Error('OTHER에는 suggestedPattern이 필요합니다.');
  if (!Number.isInteger(a.difficulty) || Number(a.difficulty) < 1 || Number(a.difficulty) > 5) throw new Error('difficulty는 1~5여야 합니다.');
  if (!Array.isArray(a.distractorAnalysis) || !a.distractorAnalysis.every((d) => d && typeof d === 'object' && typeof d.choice === 'string' && typeof d.concept === 'string' && typeof d.whyWrong === 'string')) throw new Error('distractorAnalysis 형식이 잘못되었습니다.');
  return a as unknown as QuestionAnalysis;
}

export async function analyzeDvaBank(bank: QuestionBank, analyze: AnalyzeQuestion, onProgress: (progress: AnalysisProgress, bank: QuestionBank) => Promise<void> | void, onlyFailed = false): Promise<QuestionBank> {
  let current = { ...bank, questions: [...bank.questions] }; const candidates = current.questions.filter((q) => onlyFailed ? q.analysisStatus === 'failed' : q.analysisStatus !== 'completed'); let completed = 0; let failed = 0;
  for (const candidate of candidates) {
    const index = current.questions.findIndex((q) => q.id === candidate.id);
    current.questions[index] = { ...candidate, analysisStatus: 'analyzing', analysisError: undefined }; await onProgress({ completed, total: candidates.length, failed }, current);
    try {
      const raw = await analyze({ question: candidate.question, choices: candidate.choices, correctAnswers: candidate.correctAnswers, originalExplanation: candidate.explanation ?? '' });
      current.questions[index] = { ...candidate, analysis: validateDvaAnalysis(raw), analysisStatus: 'completed', analysisError: undefined }; completed += 1;
    } catch (error) { current.questions[index] = { ...candidate, analysisStatus: 'failed', analysisError: error instanceof Error ? error.message : '분석 실패' }; failed += 1; }
    await onProgress({ completed, total: candidates.length, failed }, current);
  }
  return current;
}

export function createEndpointAnalyzer(endpoint: string): AnalyzeQuestion {
  return async (payload) => { const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }); if (!response.ok) throw new Error(`분석 API 오류 (${response.status})`); const json = await response.json(); return json.analysis ?? json; };
}
