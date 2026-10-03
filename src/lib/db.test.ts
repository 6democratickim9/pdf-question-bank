import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { bankSaveTimeoutMs, createPortableBackup, DATABASE_VERSION, importPortableBackup, openQuestionBankDatabase, withTimeout } from './db';

const createdDatabases: string[] = [];

afterEach(async () => {
  await Promise.all(createdDatabases.splice(0).map((name) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error(`Database ${name} remained open`));
  })));
});

describe('IndexedDB migration and persistence', () => {
  it('v2에서 v4로 올려도 문제은행, PDF Blob과 기존 학습 기록을 모두 보존한다', async () => {
    const name = `pdf-question-bank-migration-${crypto.randomUUID()}`; createdDatabases.push(name);
    const pdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
    const legacy = await openDB(name, 2, {
      upgrade(database) {
        database.createObjectStore('questionBanks', { keyPath: 'id' });
        const sessions = database.createObjectStore('examSessions', { keyPath: 'id' }); sessions.createIndex('by-bank', 'bankId');
        const results = database.createObjectStore('cycleResults', { keyPath: 'id' }); results.createIndex('by-bank', 'bankId');
        database.createObjectStore('wrongAnswers', { keyPath: 'bankId' });
        database.createObjectStore('statistics', { keyPath: 'bankId' });
        const history = database.createObjectStore('wrongHistory', { keyPath: ['bankId', 'questionId'] }); history.createIndex('by-bank', 'bankId');
      },
    });
    const bank = { id: 'bank-1', name: '기존 문제은행', sourceFileName: 'source.pdf', createdAt: '2026-01-01T00:00:00.000Z', questions: [{ id: 'q-1', question: '기존 문제', choices: [], correctAnswers: ['A'], explanation: '', sourcePages: [1] }], sourcePdf: new Blob([pdfBytes], { type: 'application/pdf' }) };
    const tx = legacy.transaction(['questionBanks', 'examSessions', 'cycleResults', 'wrongAnswers', 'statistics', 'wrongHistory'], 'readwrite');
    await Promise.all([
      tx.objectStore('questionBanks').put(bank),
      tx.objectStore('examSessions').put({ id: 'session-1', bankId: bank.id, kind: 'normal', questionIds: ['q-1'], answers: { 'q-1': ['B'] }, currentIndex: 0, status: 'active', startedAt: '2026-01-01T00:00:00.000Z' }),
      tx.objectStore('cycleResults').put({ id: 'result-1', bankId: bank.id, sessionId: 'session-1', kind: 'normal', completedAt: '2026-01-01T01:00:00.000Z', results: [] }),
      tx.objectStore('wrongAnswers').put({ bankId: bank.id, questionIds: ['q-1'] }),
      tx.objectStore('statistics').put({ bankId: bank.id, completedQuestionIds: ['q-1'], completedCycles: [1] }),
      tx.objectStore('wrongHistory').put({ bankId: bank.id, questionId: 'q-1', wrongCount: 2, retryCount: 2, firstWrongAt: '2026-01-01T00:00:00.000Z', lastAttemptAnswer: ['B'], lastAttemptCorrect: false, resolved: false, lastReviewedAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    await tx.done; legacy.close();

    const migrated = await openQuestionBankDatabase(name);
    expect(migrated.version).toBe(DATABASE_VERSION);
    expect([...migrated.objectStoreNames]).toContain('bookmarks');
    const storedBank = await migrated.get('questionBanks', bank.id);
    expect(storedBank?.questions).toHaveLength(1);
    expect(storedBank?.sourcePdf?.size).toBe(pdfBytes.byteLength);
    expect(new Uint8Array(await storedBank!.sourcePdf!.arrayBuffer())).toEqual(pdfBytes);
    expect(await migrated.getAllFromIndex('examSessions', 'by-bank', bank.id)).toHaveLength(1);
    expect(await migrated.getAllFromIndex('cycleResults', 'by-bank', bank.id)).toHaveLength(1);
    expect(await migrated.get('wrongAnswers', bank.id)).toEqual({ bankId: bank.id, questionIds: ['q-1'] });
    expect(await migrated.get('statistics', bank.id)).toMatchObject({ completedQuestionIds: ['q-1'], completedCycles: [1] });
    expect(await migrated.getAllFromIndex('wrongHistory', 'by-bank', bank.id)).toHaveLength(1);
    expect(await migrated.getAllFromIndex('bookmarks', 'by-bank', bank.id)).toEqual([]);
    migrated.close();
  });

  it('완전한 v3 스키마는 불필요하게 업그레이드하지 않고 모든 데이터를 보존한다', async () => {
    const name = `pdf-question-bank-reopen-${crypto.randomUUID()}`; createdDatabases.push(name);
    const first = await openDB(name, 3, {
      upgrade(database) {
        database.createObjectStore('questionBanks', { keyPath: 'id' });
        const sessions = database.createObjectStore('examSessions', { keyPath: 'id' }); sessions.createIndex('by-bank', 'bankId');
        const results = database.createObjectStore('cycleResults', { keyPath: 'id' }); results.createIndex('by-bank', 'bankId');
        database.createObjectStore('wrongAnswers', { keyPath: 'bankId' });
        database.createObjectStore('statistics', { keyPath: 'bankId' });
        const history = database.createObjectStore('wrongHistory', { keyPath: ['bankId', 'questionId'] }); history.createIndex('by-bank', 'bankId');
        const bookmarks = database.createObjectStore('bookmarks', { keyPath: ['bankId', 'questionId'] }); bookmarks.createIndex('by-bank', 'bankId');
      },
    });
    const bank = { id: 'bank-1', name: '현재 문제은행', sourceFileName: 'source.pdf', createdAt: '2026-01-01T00:00:00.000Z', questions: [], sourcePdf: new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' }) };
    const tx = first.transaction(['questionBanks', 'examSessions', 'cycleResults', 'wrongAnswers', 'statistics', 'wrongHistory', 'bookmarks'], 'readwrite');
    await Promise.all([
      tx.objectStore('questionBanks').put(bank),
      tx.objectStore('examSessions').put({ id: 'session-1', bankId: bank.id, kind: 'practice', questionIds: [], answers: {}, currentIndex: 0, status: 'active', startedAt: '2026-01-01T00:00:00.000Z' }),
      tx.objectStore('cycleResults').put({ id: 'result-1', bankId: bank.id, sessionId: 'session-1', kind: 'practice', completedAt: '2026-01-01T01:00:00.000Z', results: [] }),
      tx.objectStore('wrongAnswers').put({ bankId: bank.id, questionIds: [] }),
      tx.objectStore('statistics').put({ bankId: bank.id, completedQuestionIds: [], completedCycles: [] }),
      tx.objectStore('wrongHistory').put({ bankId: bank.id, questionId: 'q-1', wrongCount: 2, retryCount: 2, firstWrongAt: '2026-01-01T00:00:00.000Z', lastAttemptAnswer: ['B'], lastAttemptCorrect: false, resolved: false, lastReviewedAt: '2026-01-01T00:00:00.000Z' }),
      tx.objectStore('bookmarks').put({ bankId: bank.id, questionId: 'q-1', createdAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    await tx.done; first.close();

    const migrated = await openQuestionBankDatabase(name);
    expect(migrated.version).toBe(3);
    expect(await migrated.get('questionBanks', bank.id)).toMatchObject({ id: bank.id });
    expect(new Uint8Array(await (await migrated.get('questionBanks', bank.id))!.sourcePdf!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(await migrated.getAllFromIndex('examSessions', 'by-bank', bank.id)).toHaveLength(1);
    expect(await migrated.getAllFromIndex('cycleResults', 'by-bank', bank.id)).toHaveLength(1);
    expect(await migrated.get('wrongAnswers', bank.id)).toBeDefined();
    expect(await migrated.get('statistics', bank.id)).toBeDefined();
    expect(await migrated.getAllFromIndex('wrongHistory', 'by-bank', bank.id)).toHaveLength(1);
    expect(await migrated.getAllFromIndex('bookmarks', 'by-bank', bank.id)).toEqual([{ bankId: bank.id, questionId: 'q-1', createdAt: '2026-01-01T00:00:00.000Z' }]);
    migrated.close();
  });

  it('응답하지 않는 저장 작업을 제한 시간 후 오류로 종료한다', async () => {
    await expect(withTimeout(new Promise<never>(() => undefined), 5)).rejects.toThrow('브라우저 저장소가 1초 안에 응답하지 않았습니다');
  });

  it('PDF 크기에 비례해 저장 제한 시간을 늘리고 상한을 둔다', () => {
    expect(bankSaveTimeoutMs(1)).toBe(60_000);
    expect(bankSaveTimeoutMs(100 * 1024 * 1024)).toBe(200_000);
    expect(bankSaveTimeoutMs(1024 * 1024 * 1024)).toBe(300_000);
  });

  it('바이너리 백업을 빈 DB로 가져와 PDF와 전체 기록을 왕복 보존한다', async () => {
    const sourceName = `pdf-question-bank-backup-source-${crypto.randomUUID()}`;
    const targetName = `pdf-question-bank-backup-target-${crypto.randomUUID()}`;
    createdDatabases.push(sourceName, targetName);
    const source = await openQuestionBankDatabase(sourceName);
    const sourcePdf = new Blob([new Uint8Array([37, 80, 68, 70, 10, 1, 2, 3])], { type: 'application/pdf' });
    const bank = { id: 'bank-1', name: '왕복 테스트', sourceFileName: 'source.pdf', createdAt: '2026-01-01T00:00:00.000Z', questions: [{ id: 'q-1', question: '질문', choices: [], correctAnswers: ['A'], sourcePages: [1] }], sourcePdf };
    const sourceTx = source.transaction(['questionBanks', 'examSessions', 'cycleResults', 'wrongAnswers', 'statistics', 'wrongHistory', 'bookmarks'], 'readwrite');
    await Promise.all([
      sourceTx.objectStore('questionBanks').put(bank),
      sourceTx.objectStore('examSessions').put({ id: 'session-1', bankId: bank.id, kind: 'practice', questionIds: ['q-1'], answers: {}, currentIndex: 0, status: 'active', startedAt: '2026-01-01T00:00:00.000Z' }),
      sourceTx.objectStore('cycleResults').put({ id: 'result-1', bankId: bank.id, sessionId: 'session-1', kind: 'practice', completedAt: '2026-01-01T01:00:00.000Z', results: [] }),
      sourceTx.objectStore('wrongAnswers').put({ bankId: bank.id, questionIds: ['q-1'] }),
      sourceTx.objectStore('statistics').put({ bankId: bank.id, completedQuestionIds: ['q-1'], completedCycles: [] }),
      sourceTx.objectStore('wrongHistory').put({ bankId: bank.id, questionId: 'q-1', wrongCount: 1, retryCount: 1, firstWrongAt: '2026-01-01T00:00:00.000Z', lastAttemptAnswer: ['B'], lastAttemptCorrect: false, resolved: false, lastReviewedAt: '2026-01-01T00:00:00.000Z' }),
      sourceTx.objectStore('bookmarks').put({ bankId: bank.id, questionId: 'q-1', createdAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    await sourceTx.done;
    const backup = await createPortableBackup(source); source.close();

    const target = await openQuestionBankDatabase(targetName); const progress: string[] = [];
    const restored = await importPortableBackup(target, backup, (message) => progress.push(message));
    expect(restored).toEqual({ banks: 1, pdfBytes: sourcePdf.size });
    expect(new Uint8Array(await (await target.get('questionBanks', bank.id))!.sourcePdf!.arrayBuffer())).toEqual(new Uint8Array(await sourcePdf.arrayBuffer()));
    expect(await target.getAll('examSessions')).toHaveLength(1);
    expect(await target.getAll('cycleResults')).toHaveLength(1);
    expect(await target.getAll('wrongAnswers')).toHaveLength(1);
    expect(await target.getAll('statistics')).toHaveLength(1);
    expect(await target.getAll('wrongHistory')).toHaveLength(1);
    expect(await target.getAll('bookmarks')).toHaveLength(1);
    expect(progress.at(-1)).toBe('가져오기 검증 완료');
    target.close();
  });
});
