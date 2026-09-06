export type ParsingWarning = 'NO_ANSWER' | 'NO_CHOICES' | 'LESS_THAN_TWO_CHOICES' | 'DUPLICATE_NUMBER' | 'EMPTY_QUESTION' | 'UNKNOWN_FORMAT';

export interface Choice { key: string; text: string }
export type AnalysisStatus = 'pending' | 'analyzing' | 'completed' | 'failed';
export interface DistractorAnalysis { choice: string; concept: string; whyWrong: string }
export interface QuestionAnalysis {
  domain: string; part: string; primaryServices: string[]; secondaryServices: string[]; concept: string;
  problemPattern: string; suggestedPattern?: string; architecturePath: string[]; keyClues: string[];
  decisionPoint: string; reasoningPath: string[]; correctAnswerRule: string; examTrap: string;
  distractorAnalysis: DistractorAnalysis[]; difficulty: 1 | 2 | 3 | 4 | 5;
}
export interface Question {
  id: string; originalNumber?: number; question: string; choices: Choice[];
  correctAnswers: string[]; explanation?: string; sourcePages: number[];
  rawText?: string; warnings?: ParsingWarning[]; analysis?: QuestionAnalysis; analysisStatus?: AnalysisStatus; analysisError?: string;
}
export interface QuestionBank { id: string; name: string; sourceFileName: string; createdAt: string; questions: Question[]; sourcePdf?: Blob }
export type ExamKind = 'normal' | 'wrong' | 'practice';
export interface ExamSession {
  id: string; bankId: string; kind: ExamKind; cycleNumber?: number; questionIds: string[];
  answers: Record<string, string[]>; currentIndex: number; startedAt: string; updatedAt?: string; endAt?: string; status: 'active' | 'submitted';
}
export interface QuestionResult { questionId: string; selected: string[]; correct: boolean; unanswered: boolean }
export interface CycleResult {
  id: string; sessionId: string; bankId: string; kind: ExamKind; cycleNumber?: number;
  completedAt: string; results: QuestionResult[];
}
export interface WrongAnswers { bankId: string; questionIds: string[] }
export interface WrongReviewItem {
  bankId: string; questionId: string; wrongCount: number; retryCount: number; firstWrongAt: string;
  lastAttemptAnswer: string[]; lastAttemptCorrect: boolean; resolved: boolean; lastReviewedAt: string;
  resolvedAt?: string; concept?: string; pattern?: string;
}
export interface MasteryRecord { attempts: number; correct: number; percentage: number }
export interface BankStatistics {
  bankId: string; completedQuestionIds: string[]; completedCycles: number[];
  conceptMastery?: Record<string, MasteryRecord>; patternMastery?: Record<string, MasteryRecord>;
}
export interface PageText { pageNumber: number; text: string }
