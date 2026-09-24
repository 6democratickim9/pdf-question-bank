import type { QuestionAnalysis, QuestionBank } from '../types';

interface LocalAnalysisFile { source: string; generatedAt: string; analyses: Record<string, QuestionAnalysis> }

export async function mergeLocalDvaAnalysis(bank: QuestionBank): Promise<QuestionBank> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}local-data/dva-c02-analysis.json`, { cache: 'no-store' });
    if (!response.ok) return bank; const local = await response.json() as LocalAnalysisFile; let changed = false;
    const questions = bank.questions.map((question) => { const analysis = question.originalNumber == null ? undefined : local.analyses[String(question.originalNumber)]; if (!analysis || JSON.stringify(question.analysis) === JSON.stringify(analysis)) return question; changed = true; return { ...question, analysis, analysisStatus: 'completed' as const }; });
    return changed ? { ...bank, questions } : bank;
  } catch { return bank; }
}
