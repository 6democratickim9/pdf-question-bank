export type ParsingWarning = 'NO_ANSWER' | 'NO_CHOICES' | 'LESS_THAN_TWO_CHOICES' | 'DUPLICATE_NUMBER' | 'EMPTY_QUESTION' | 'UNKNOWN_FORMAT';

export interface Choice { key: string; text: string }
export interface Question {
  id: string; originalNumber?: number; question: string; choices: Choice[];
  correctAnswers: string[]; explanation?: string; sourcePages: number[];
  rawText?: string; warnings?: ParsingWarning[];
}
export interface QuestionBank { id: string; name: string; sourceFileName: string; createdAt: string; questions: Question[] }
export type ExamKind = 'normal' | 'wrong';
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
export interface BankStatistics { bankId: string; completedQuestionIds: string[]; completedCycles: number[] }
export interface PageText { pageNumber: number; text: string }
