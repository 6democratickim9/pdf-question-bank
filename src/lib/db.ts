import { openDB, type DBSchema } from 'idb';
import type { BankStatistics, CycleResult, ExamSession, QuestionBank, WrongAnswers } from '../types';

interface QuestionBankDB extends DBSchema {
  questionBanks: { key: string; value: QuestionBank };
  examSessions: { key: string; value: ExamSession; indexes: { 'by-bank': string } };
  cycleResults: { key: string; value: CycleResult; indexes: { 'by-bank': string } };
  wrongAnswers: { key: string; value: WrongAnswers };
  statistics: { key: string; value: BankStatistics };
}

const database = openDB<QuestionBankDB>('pdf-question-bank', 1, {
  upgrade(db) {
    db.createObjectStore('questionBanks', { keyPath: 'id' });
    const sessions = db.createObjectStore('examSessions', { keyPath: 'id' });
    sessions.createIndex('by-bank', 'bankId');
    const results = db.createObjectStore('cycleResults', { keyPath: 'id' });
    results.createIndex('by-bank', 'bankId');
    db.createObjectStore('wrongAnswers', { keyPath: 'bankId' });
    db.createObjectStore('statistics', { keyPath: 'bankId' });
  },
});

export const db = {
  banks: async () => (await database).getAll('questionBanks'),
  bank: async (id: string) => (await database).get('questionBanks', id),
  saveBank: async (bank: QuestionBank) => (await database).put('questionBanks', bank),
  deleteBank: async (id: string) => {
    const d = await database; const tx = d.transaction(['questionBanks', 'examSessions', 'cycleResults', 'wrongAnswers', 'statistics'], 'readwrite');
    await tx.objectStore('questionBanks').delete(id);
    for (const session of await tx.objectStore('examSessions').index('by-bank').getAll(id)) await tx.objectStore('examSessions').delete(session.id);
    for (const result of await tx.objectStore('cycleResults').index('by-bank').getAll(id)) await tx.objectStore('cycleResults').delete(result.id);
    await tx.objectStore('wrongAnswers').delete(id); await tx.objectStore('statistics').delete(id); await tx.done;
  },
  sessions: async (bankId: string) => (await database).getAllFromIndex('examSessions', 'by-bank', bankId),
  saveSession: async (value: ExamSession) => (await database).put('examSessions', value),
  results: async (bankId: string) => (await database).getAllFromIndex('cycleResults', 'by-bank', bankId),
  saveResult: async (value: CycleResult) => (await database).put('cycleResults', value),
  wrong: async (bankId: string) => (await database).get('wrongAnswers', bankId),
  saveWrong: async (value: WrongAnswers) => (await database).put('wrongAnswers', value),
  stats: async (bankId: string) => (await database).get('statistics', bankId),
  saveStats: async (value: BankStatistics) => (await database).put('statistics', value),
  resetProgress: async (bankId: string) => {
    const d = await database; const tx = d.transaction(['examSessions', 'cycleResults', 'statistics'], 'readwrite');
    for (const item of await tx.objectStore('examSessions').index('by-bank').getAll(bankId)) await tx.objectStore('examSessions').delete(item.id);
    for (const item of await tx.objectStore('cycleResults').index('by-bank').getAll(bankId)) await tx.objectStore('cycleResults').delete(item.id);
    await tx.objectStore('statistics').delete(bankId); await tx.done;
  },
};
