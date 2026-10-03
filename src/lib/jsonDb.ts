import type { BankStatistics, CycleResult, ExamSession, QuestionBank, QuestionBookmark, WrongAnswers, WrongReviewItem } from '../types';

interface JsonState {
  version: 1;
  questionBanks: QuestionBank[];
  examSessions: ExamSession[];
  cycleResults: CycleResult[];
  wrongAnswers: WrongAnswers[];
  statistics: BankStatistics[];
  wrongHistory: WrongReviewItem[];
  bookmarks: QuestionBookmark[];
}

const endpoint = `${import.meta.env.BASE_URL}api/state`;
let cached: JsonState | undefined;
let writeQueue = Promise.resolve();

async function load(force = false) {
  if (cached && !force) return cached;
  const response = await fetch(endpoint, { cache: 'no-store' });
  if (!response.ok) throw new Error(`로컬 JSON 읽기 실패 (${response.status})`);
  cached = await response.json() as JsonState;
  return cached;
}

async function persist(state: JsonState) {
  const response = await fetch(endpoint, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state) });
  if (!response.ok) throw new Error(await response.text() || `로컬 JSON 저장 실패 (${response.status})`);
  cached = state;
}

function mutate(change: (state: JsonState) => void) {
  const operation = writeQueue.then(async () => { const state = structuredClone(await load(true)); change(state); await persist(state); });
  writeQueue = operation.catch(() => undefined);
  return operation;
}

function putByKey<T>(items: T[], value: T, key: (item: T) => string) {
  const index = items.findIndex((item) => key(item) === key(value));
  if (index >= 0) items[index] = value; else items.push(value);
}

function withoutPdf(bank: QuestionBank): QuestionBank {
  const { sourcePdf: _sourcePdf, ...portable } = bank;
  return portable;
}

export const db = {
  banks: async () => (await load()).questionBanks,
  bank: async (id: string) => (await load()).questionBanks.find((item) => item.id === id),
  saveBank: async (bank: QuestionBank) => mutate((state) => putByKey(state.questionBanks, withoutPdf(bank), (item) => item.id)),
  saveNewBank: async (bank: QuestionBank) => {
    const portable = withoutPdf(bank);
    await mutate((state) => {
      putByKey(state.questionBanks, portable, (item) => item.id);
      putByKey(state.statistics, { bankId: bank.id, completedQuestionIds: [], completedCycles: [] }, (item) => item.bankId);
      putByKey(state.wrongAnswers, { bankId: bank.id, questionIds: [] }, (item) => item.bankId);
    });
    const stored = await db.bank(bank.id);
    if (!stored || stored.questions.length !== bank.questions.length) throw new Error('로컬 JSON 저장 후 문제 수 검증에 실패했습니다.');
    return stored;
  },
  deleteBank: async (id: string) => mutate((state) => {
    state.questionBanks = state.questionBanks.filter((item) => item.id !== id); state.examSessions = state.examSessions.filter((item) => item.bankId !== id);
    state.cycleResults = state.cycleResults.filter((item) => item.bankId !== id); state.wrongAnswers = state.wrongAnswers.filter((item) => item.bankId !== id);
    state.statistics = state.statistics.filter((item) => item.bankId !== id); state.wrongHistory = state.wrongHistory.filter((item) => item.bankId !== id); state.bookmarks = state.bookmarks.filter((item) => item.bankId !== id);
  }),
  sessions: async (bankId: string) => (await load()).examSessions.filter((item) => item.bankId === bankId),
  saveSession: async (value: ExamSession) => mutate((state) => putByKey(state.examSessions, value, (item) => item.id)),
  results: async (bankId: string) => (await load()).cycleResults.filter((item) => item.bankId === bankId),
  saveResult: async (value: CycleResult) => mutate((state) => putByKey(state.cycleResults, value, (item) => item.id)),
  wrong: async (bankId: string) => (await load()).wrongAnswers.find((item) => item.bankId === bankId),
  saveWrong: async (value: WrongAnswers) => mutate((state) => putByKey(state.wrongAnswers, value, (item) => item.bankId)),
  updateWrongQuestion: async (bankId: string, questionId: string, correct: boolean, keepOnCorrect = false) => {
    let updated: string[] = [];
    await mutate((state) => { const stored = state.wrongAnswers.find((item) => item.bankId === bankId); const ids = new Set(stored?.questionIds ?? []); if (correct && !keepOnCorrect) ids.delete(questionId); else ids.add(questionId); updated = [...ids]; putByKey(state.wrongAnswers, { bankId, questionIds: updated }, (item) => item.bankId); });
    return updated;
  },
  stats: async (bankId: string) => (await load()).statistics.find((item) => item.bankId === bankId),
  saveStats: async (value: BankStatistics) => mutate((state) => putByKey(state.statistics, value, (item) => item.bankId)),
  wrongHistory: async (bankId: string) => (await load()).wrongHistory.filter((item) => item.bankId === bankId),
  saveWrongHistory: async (value: WrongReviewItem) => mutate((state) => putByKey(state.wrongHistory, value, (item) => `${item.bankId}:${item.questionId}`)),
  bookmarks: async (bankId: string) => (await load()).bookmarks.filter((item) => item.bankId === bankId),
  setBookmark: async (bankId: string, questionId: string, bookmarked: boolean) => mutate((state) => {
    const key = `${bankId}:${questionId}`; if (bookmarked) putByKey(state.bookmarks, { bankId, questionId, createdAt: new Date().toISOString() }, (item) => `${item.bankId}:${item.questionId}`); else state.bookmarks = state.bookmarks.filter((item) => `${item.bankId}:${item.questionId}` !== key);
  }),
  resetProgress: async (bankId: string) => mutate((state) => { state.examSessions = state.examSessions.filter((item) => item.bankId !== bankId); state.cycleResults = state.cycleResults.filter((item) => item.bankId !== bankId); state.statistics = state.statistics.filter((item) => item.bankId !== bankId); }),
  exportBackup: async () => new Blob([JSON.stringify(await load(), null, 2)], { type: 'application/json' }),
  importBackup: async (file: Blob, onProgress?: (message: string) => void) => {
    onProgress?.('로컬 JSON 백업 검사 중…');
    const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer()); let imported: Partial<JsonState>;
    if (new TextDecoder().decode(bytes.subarray(0, 4)) === 'PQB1') {
      const headerLength = new DataView(bytes.buffer).getUint32(4, true); const legacy = JSON.parse(await file.slice(8, 8 + headerLength).text()); imported = legacy.data;
    } else {
      const parsed = JSON.parse(await file.text()); imported = parsed.format === 'pdf-question-bank-backup' ? parsed.data : parsed;
    }
    const arrays = ['questionBanks', 'examSessions', 'cycleResults', 'wrongAnswers', 'statistics', 'wrongHistory', 'bookmarks'] as const;
    if (!arrays.every((key) => Array.isArray(imported[key]))) throw new Error('지원하는 문제은행 JSON 파일이 아닙니다.');
    onProgress?.('프로젝트 JSON 파일에 병합 중…');
    await mutate((state) => {
      for (const value of imported.questionBanks!) putByKey(state.questionBanks, withoutPdf(value), (item) => item.id);
      for (const value of imported.examSessions!) putByKey(state.examSessions, value, (item) => item.id);
      for (const value of imported.cycleResults!) putByKey(state.cycleResults, value, (item) => item.id);
      for (const value of imported.wrongAnswers!) putByKey(state.wrongAnswers, value, (item) => item.bankId);
      for (const value of imported.statistics!) putByKey(state.statistics, value, (item) => item.bankId);
      for (const value of imported.wrongHistory!) putByKey(state.wrongHistory, value, (item) => `${item.bankId}:${item.questionId}`);
      for (const value of imported.bookmarks!) putByKey(state.bookmarks, value, (item) => `${item.bankId}:${item.questionId}`);
    });
    const reloaded = await load(true); const ids = new Set(imported.questionBanks!.map((bank) => bank.id)); const count = reloaded.questionBanks.filter((bank) => ids.has(bank.id)).length;
    if (count !== imported.questionBanks!.length) throw new Error('로컬 JSON 병합 후 문제은행 수 검증에 실패했습니다.');
    onProgress?.('JSON 가져오기 검증 완료'); return { banks: count, pdfBytes: 0 };
  },
};

export function subscribeDatabaseIssue(listener: (message: string) => void) { listener(''); return () => undefined; }
