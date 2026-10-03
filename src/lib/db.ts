import { openDB, wrap, type DBSchema, type IDBPDatabase } from 'idb';
import type { BankStatistics, CycleResult, ExamSession, QuestionBank, QuestionBookmark, WrongAnswers, WrongReviewItem } from '../types';

export interface QuestionBankDB extends DBSchema {
  questionBanks: { key: string; value: QuestionBank };
  examSessions: { key: string; value: ExamSession; indexes: { 'by-bank': string } };
  cycleResults: { key: string; value: CycleResult; indexes: { 'by-bank': string } };
  wrongAnswers: { key: string; value: WrongAnswers };
  statistics: { key: string; value: BankStatistics };
  wrongHistory: { key: [string, string]; value: WrongReviewItem; indexes: { 'by-bank': string } };
  bookmarks: { key: [string, string]; value: QuestionBookmark; indexes: { 'by-bank': string } };
}

// IndexedDB versions are monotonic. Version 4 was already exposed to browsers and must never be lowered.
export const DATABASE_VERSION = 4;
export const SAVE_TIMEOUT_MS = 15_000;
const MIN_BLOB_SAVE_TIMEOUT_MS = 60_000;
const MAX_BLOB_SAVE_TIMEOUT_MS = 5 * 60_000;
let databaseIssue = '';
const databaseIssueListeners = new Set<(message: string) => void>();

function reportDatabaseIssue(message: string) {
  databaseIssue = message;
  databaseIssueListeners.forEach((listener) => listener(message));
}

export function subscribeDatabaseIssue(listener: (message: string) => void) {
  databaseIssueListeners.add(listener);
  listener(databaseIssue);
  return () => { databaseIssueListeners.delete(listener); };
}

export function openQuestionBankDatabase(name = 'pdf-question-bank') {
  return openCompatibleDatabase(name);
}

const requiredStores = ['questionBanks', 'examSessions', 'cycleResults', 'wrongAnswers', 'statistics', 'wrongHistory', 'bookmarks'] as const;

async function openCompatibleDatabase(name: string) {
  let openedDatabase: IDBPDatabase<QuestionBankDB> | undefined;
  const callbacks = {
    blocked(currentVersion: number, blockedVersion: number | null) {
      reportDatabaseIssue(`IndexedDB 업그레이드 차단: 현재 v${currentVersion}, 요청 v${blockedVersion ?? DATABASE_VERSION}. 같은 브라우저의 이전 앱 연결이 아직 열려 있습니다.`);
    },
    blocking() { openedDatabase?.close(); reportDatabaseIssue('다른 탭의 데이터베이스 업그레이드를 위해 현재 연결을 닫았습니다. 페이지를 새로고침해 주세요.'); },
    terminated() { reportDatabaseIssue('브라우저 저장소 연결이 예기치 않게 종료되었습니다. 페이지를 새로고침해 주세요.'); },
  };
  // Safari can mishandle indexedDB.open(name, undefined). Use the one-argument native overload.
  const existing = await new Promise<IDBPDatabase<QuestionBankDB>>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB 연결을 열 수 없습니다.')));
    request.addEventListener('blocked', (event) => callbacks.blocked(event.oldVersion, event.newVersion));
    request.addEventListener('success', () => {
      const nativeDatabase = request.result;
      const wrappedDatabase = wrap(nativeDatabase) as IDBPDatabase<QuestionBankDB>;
      nativeDatabase.addEventListener('versionchange', () => { wrappedDatabase.close(); reportDatabaseIssue('다른 탭의 데이터베이스 변경 요청으로 현재 연결을 닫았습니다. 페이지를 새로고침해 주세요.'); });
      nativeDatabase.addEventListener('close', () => reportDatabaseIssue('브라우저 저장소 연결이 종료되었습니다. 페이지를 새로고침해 주세요.'));
      resolve(wrappedDatabase);
    });
  });
  openedDatabase = existing;
  if (requiredStores.every((store) => existing.objectStoreNames.contains(store))) {
    reportDatabaseIssue('');
    return existing;
  }
  const currentVersion = existing.version;
  existing.close();
  openedDatabase = undefined;
  const targetVersion = Math.max(DATABASE_VERSION, currentVersion + 1);
  const opening = openDB<QuestionBankDB>(name, targetVersion, {
    upgrade(database, oldVersion) {
      if (!database.objectStoreNames.contains('questionBanks')) {
        database.createObjectStore('questionBanks', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('examSessions')) {
        const sessions = database.createObjectStore('examSessions', { keyPath: 'id' });
        sessions.createIndex('by-bank', 'bankId');
      }
      if (!database.objectStoreNames.contains('cycleResults')) {
        const results = database.createObjectStore('cycleResults', { keyPath: 'id' });
        results.createIndex('by-bank', 'bankId');
      }
      if (!database.objectStoreNames.contains('wrongAnswers')) {
        database.createObjectStore('wrongAnswers', { keyPath: 'bankId' });
      }
      if (!database.objectStoreNames.contains('statistics')) {
        database.createObjectStore('statistics', { keyPath: 'bankId' });
      }
      if (!database.objectStoreNames.contains('wrongHistory')) {
        const history = database.createObjectStore('wrongHistory', { keyPath: ['bankId', 'questionId'] });
        history.createIndex('by-bank', 'bankId');
      }
      if (!database.objectStoreNames.contains('bookmarks')) {
        const bookmarks = database.createObjectStore('bookmarks', { keyPath: ['bankId', 'questionId'] });
        bookmarks.createIndex('by-bank', 'bankId');
      }
    },
    ...callbacks,
  });
  const upgraded = await opening;
  openedDatabase = upgraded;
  reportDatabaseIssue('');
  return upgraded;
}

export function withTimeout<T>(operation: Promise<T>, timeoutMs = SAVE_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`브라우저 저장소가 ${Math.ceil(timeoutMs / 1000)}초 안에 응답하지 않았습니다. 다른 탭을 닫고 다시 시도해 주세요.`)), timeoutMs);
    operation.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

const database = openQuestionBankDatabase();
const allStoreNames = ['questionBanks', 'examSessions', 'cycleResults', 'wrongAnswers', 'statistics', 'wrongHistory', 'bookmarks'] as const;

interface PortableBank extends Omit<QuestionBank, 'sourcePdf'> {
  sourcePdf?: { type: string; size: number; offset: number };
}

interface PortableBackup {
  format: 'pdf-question-bank-backup'; version: 1; exportedAt: string;
  data: {
    questionBanks: PortableBank[]; examSessions: ExamSession[]; cycleResults: CycleResult[];
    wrongAnswers: WrongAnswers[]; statistics: BankStatistics[]; wrongHistory: WrongReviewItem[]; bookmarks: QuestionBookmark[];
  };
}

export async function createPortableBackup(d: IDBPDatabase<QuestionBankDB>) {
  const tx = d.transaction(allStoreNames, 'readonly');
  const [questionBanks, examSessions, cycleResults, wrongAnswers, statistics, wrongHistory, bookmarks] = await Promise.all([
    tx.objectStore('questionBanks').getAll(), tx.objectStore('examSessions').getAll(), tx.objectStore('cycleResults').getAll(),
    tx.objectStore('wrongAnswers').getAll(), tx.objectStore('statistics').getAll(), tx.objectStore('wrongHistory').getAll(), tx.objectStore('bookmarks').getAll(),
  ]);
  await tx.done;
  let offset = 0; const pdfParts: Blob[] = [];
  const portableBanks: PortableBank[] = questionBanks.map(({ sourcePdf, ...bank }) => {
    if (!sourcePdf) return bank;
    const descriptor = { type: sourcePdf.type || 'application/pdf', size: sourcePdf.size, offset };
    offset += sourcePdf.size; pdfParts.push(sourcePdf); return { ...bank, sourcePdf: descriptor };
  });
  const metadata: PortableBackup = { format: 'pdf-question-bank-backup', version: 1, exportedAt: new Date().toISOString(), data: { questionBanks: portableBanks, examSessions, cycleResults, wrongAnswers, statistics, wrongHistory, bookmarks } };
  const header = new TextEncoder().encode(JSON.stringify(metadata));
  const prefix = new Uint8Array(8); prefix.set(new TextEncoder().encode('PQB1'), 0); new DataView(prefix.buffer).setUint32(4, header.byteLength, true);
  return new Blob([prefix, header, ...pdfParts], { type: 'application/x-pdf-question-bank-backup' });
}

async function parsePortableBackup(file: Blob) {
  const prefix = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (new TextDecoder().decode(prefix.subarray(0, 4)) !== 'PQB1') throw new Error('PDF Question Bank 백업 파일이 아닙니다.');
  const headerLength = new DataView(prefix.buffer).getUint32(4, true);
  if (!headerLength || headerLength > file.size - 8) throw new Error('백업 파일 헤더가 손상되었습니다.');
  const backup: unknown = JSON.parse(await file.slice(8, 8 + headerLength).text());
  if (!backup || typeof backup !== 'object' || (backup as PortableBackup).format !== 'pdf-question-bank-backup' || (backup as PortableBackup).version !== 1) throw new Error('PDF Question Bank 백업 파일이 아닙니다.');
  const data = (backup as PortableBackup).data;
  if (!data || !allStoreNames.every((store) => Array.isArray(data[store]))) throw new Error('백업 파일에 필요한 데이터가 모두 들어 있지 않습니다.');
  const payloadOffset = 8 + headerLength;
  const questionBanks: QuestionBank[] = data.questionBanks.map(({ sourcePdf, ...bank }) => ({
    ...bank,
    ...(sourcePdf ? { sourcePdf: file.slice(payloadOffset + sourcePdf.offset, payloadOffset + sourcePdf.offset + sourcePdf.size, sourcePdf.type) } : {}),
  }));
  if (data.questionBanks.some((bank) => bank.sourcePdf && payloadOffset + bank.sourcePdf.offset + bank.sourcePdf.size > file.size)) throw new Error('백업 파일의 원본 PDF 데이터가 손상되었습니다.');
  return { ...data, questionBanks };
}

async function putImportedBank(d: IDBPDatabase<QuestionBankDB>, bank: QuestionBank) {
  const tx = d.transaction('questionBanks', 'readwrite'); let timedOut = false;
  const timeoutMs = bankSaveTimeoutMs(bank.sourcePdf?.size);
  const timer = setTimeout(() => { timedOut = true; try { tx.abort(); } catch { /* already complete */ } }, timeoutMs);
  try { await tx.store.put(bank); await tx.done; }
  catch (cause) { if (timedOut) throw new Error(`문제은행 “${bank.name}” 저장이 제한 시간을 초과해 중단되었습니다.`); throw cause; }
  finally { clearTimeout(timer); }
  const stored = await withTimeout(d.get('questionBanks', bank.id), SAVE_TIMEOUT_MS);
  if (!stored || stored.questions.length !== bank.questions.length || (stored.sourcePdf?.size ?? 0) !== (bank.sourcePdf?.size ?? 0)) throw new Error(`문제은행 “${bank.name}” 저장 후 재검증에 실패했습니다.`);
}

export async function importPortableBackup(d: IDBPDatabase<QuestionBankDB>, file: Blob, onProgress?: (message: string) => void) {
  onProgress?.('백업 파일 검사 중…');
  const data = await parsePortableBackup(file);
  for (let index = 0; index < data.questionBanks.length; index += 1) {
    const bank = data.questionBanks[index]; onProgress?.(`문제은행 저장 중… ${index + 1} / ${data.questionBanks.length} · ${bank.name}`);
    await putImportedBank(d, bank);
  }
  onProgress?.('세션·오답·통계·책갈피 저장 중…');
  const recordStores = ['examSessions', 'cycleResults', 'wrongAnswers', 'statistics', 'wrongHistory', 'bookmarks'] as const;
  const tx = d.transaction(recordStores, 'readwrite');
  try {
    await Promise.all([
      ...data.examSessions.map((value) => tx.objectStore('examSessions').put(value)),
      ...data.cycleResults.map((value) => tx.objectStore('cycleResults').put(value)),
      ...data.wrongAnswers.map((value) => tx.objectStore('wrongAnswers').put(value)),
      ...data.statistics.map((value) => tx.objectStore('statistics').put(value)),
      ...data.wrongHistory.map((value) => tx.objectStore('wrongHistory').put(value)),
      ...data.bookmarks.map((value) => tx.objectStore('bookmarks').put(value)),
    ]);
    await tx.done;
  } catch (cause) {
    try { tx.abort(); } catch { /* The transaction may already be aborted. */ }
    throw cause;
  }
  const importedIds = new Set(data.questionBanks.map((bank) => bank.id));
  const storedBanks = (await d.getAll('questionBanks')).filter((bank) => importedIds.has(bank.id));
  const expectedPdfBytes = data.questionBanks.reduce((sum, bank) => sum + (bank.sourcePdf?.size ?? 0), 0);
  const storedPdfBytes = storedBanks.reduce((sum, bank) => sum + (bank.sourcePdf?.size ?? 0), 0);
  if (storedBanks.length !== data.questionBanks.length || storedPdfBytes !== expectedPdfBytes) throw new Error('가져오기 후 문제은행 또는 원본 PDF Blob 재검증에 실패했습니다. 기존 데이터는 삭제하지 않았습니다.');
  onProgress?.('가져오기 검증 완료');
  return { banks: storedBanks.length, pdfBytes: storedPdfBytes };
}

export function bankSaveTimeoutMs(pdfSize = 0) {
  const sizeAllowance = Math.ceil(pdfSize / (1024 * 1024)) * 2_000;
  return Math.min(MAX_BLOB_SAVE_TIMEOUT_MS, Math.max(MIN_BLOB_SAVE_TIMEOUT_MS, sizeAllowance));
}

async function saveNewBankAndVerify(d: IDBPDatabase<QuestionBankDB>, bank: QuestionBank) {
  const tx = d.transaction(['questionBanks', 'statistics', 'wrongAnswers'], 'readwrite');
  const timeoutMs = bankSaveTimeoutMs(bank.sourcePdf?.size);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try { tx.abort(); } catch { /* The transaction may already be complete. */ }
  }, timeoutMs);
  try {
    await Promise.all([
      tx.objectStore('questionBanks').put(bank),
      tx.objectStore('statistics').put({ bankId: bank.id, completedQuestionIds: [], completedCycles: [] }),
      tx.objectStore('wrongAnswers').put({ bankId: bank.id, questionIds: [] }),
    ]);
    await tx.done;
  } catch (cause) {
    if (timedOut) throw new Error(`원본 PDF 저장이 ${Math.ceil(timeoutMs / 1000)}초 안에 끝나지 않아 안전하게 중단했습니다. 브라우저 저장 공간을 확인해 주세요.`);
    throw cause;
  } finally { clearTimeout(timer); }
  const stored = await withTimeout(d.get('questionBanks', bank.id), SAVE_TIMEOUT_MS);
  if (!stored) throw new Error('저장 후 문제은행을 다시 찾을 수 없습니다.');
  if (stored.questions.length !== bank.questions.length) throw new Error(`저장 검증에 실패했습니다. 문제 수가 ${bank.questions.length}개가 아니라 ${stored.questions.length}개로 저장되었습니다.`);
  const expectedPdfSize = bank.sourcePdf?.size ?? 0;
  const storedPdfSize = stored.sourcePdf?.size ?? 0;
  if (storedPdfSize !== expectedPdfSize) throw new Error(`저장 검증에 실패했습니다. 원본 PDF 크기가 ${expectedPdfSize}바이트가 아니라 ${storedPdfSize}바이트로 저장되었습니다.`);
  return stored;
}

export const db = {
  banks: async () => (await database).getAll('questionBanks'), bank: async (id: string) => (await database).get('questionBanks', id),
  saveBank: async (bank: QuestionBank) => (await database).put('questionBanks', bank),
  saveNewBank: async (bank: QuestionBank) => {
    const d = await withTimeout(database, SAVE_TIMEOUT_MS);
    return saveNewBankAndVerify(d, bank);
  },
  exportBackup: async () => createPortableBackup(await withTimeout(database, SAVE_TIMEOUT_MS)),
  importBackup: async (file: Blob, onProgress?: (message: string) => void) => {
    onProgress?.('Safari IndexedDB 연결 확인 중…');
    const d = await withTimeout(database, SAVE_TIMEOUT_MS);
    return importPortableBackup(d, file, onProgress);
  },
  deleteBank: async (id: string) => {
    const d = await database; const tx = d.transaction(['questionBanks', 'examSessions', 'cycleResults', 'wrongAnswers', 'statistics', 'wrongHistory', 'bookmarks'], 'readwrite');
    await tx.objectStore('questionBanks').delete(id);
    for (const session of await tx.objectStore('examSessions').index('by-bank').getAll(id)) await tx.objectStore('examSessions').delete(session.id);
    for (const result of await tx.objectStore('cycleResults').index('by-bank').getAll(id)) await tx.objectStore('cycleResults').delete(result.id);
    await tx.objectStore('wrongAnswers').delete(id); await tx.objectStore('statistics').delete(id);
    for (const item of await tx.objectStore('wrongHistory').index('by-bank').getAll(id)) await tx.objectStore('wrongHistory').delete([item.bankId, item.questionId]);
    for (const item of await tx.objectStore('bookmarks').index('by-bank').getAll(id)) await tx.objectStore('bookmarks').delete([item.bankId, item.questionId]);
    await tx.done;
  },
  sessions: async (bankId: string) => (await database).getAllFromIndex('examSessions', 'by-bank', bankId), saveSession: async (value: ExamSession) => (await database).put('examSessions', value),
  results: async (bankId: string) => (await database).getAllFromIndex('cycleResults', 'by-bank', bankId), saveResult: async (value: CycleResult) => (await database).put('cycleResults', value),
  wrong: async (bankId: string) => (await database).get('wrongAnswers', bankId), saveWrong: async (value: WrongAnswers) => (await database).put('wrongAnswers', value),
  updateWrongQuestion: async (bankId: string, questionId: string, correct: boolean, keepOnCorrect = false) => {
    const d = await database; const tx = d.transaction('wrongAnswers', 'readwrite'); const store = tx.objectStore('wrongAnswers'); const stored = await store.get(bankId); const questionIds = new Set(stored?.questionIds ?? []);
    if (correct && !keepOnCorrect) questionIds.delete(questionId); else questionIds.add(questionId);
    const updated = [...questionIds]; await store.put({ bankId, questionIds: updated }); await tx.done; return updated;
  },
  stats: async (bankId: string) => (await database).get('statistics', bankId), saveStats: async (value: BankStatistics) => (await database).put('statistics', value),
  wrongHistory: async (bankId: string) => (await database).getAllFromIndex('wrongHistory', 'by-bank', bankId), saveWrongHistory: async (value: WrongReviewItem) => (await database).put('wrongHistory', value),
  bookmarks: async (bankId: string) => (await database).getAllFromIndex('bookmarks', 'by-bank', bankId),
  setBookmark: async (bankId: string, questionId: string, bookmarked: boolean) => { const d = await database; if (bookmarked) await d.put('bookmarks', { bankId, questionId, createdAt: new Date().toISOString() }); else await d.delete('bookmarks', [bankId, questionId]); },
  resetProgress: async (bankId: string) => {
    const d = await database; const tx = d.transaction(['examSessions', 'cycleResults', 'statistics'], 'readwrite');
    for (const item of await tx.objectStore('examSessions').index('by-bank').getAll(bankId)) await tx.objectStore('examSessions').delete(item.id);
    for (const item of await tx.objectStore('cycleResults').index('by-bank').getAll(bankId)) await tx.objectStore('cycleResults').delete(item.id);
    await tx.objectStore('statistics').delete(bankId); await tx.done;
  },
};
