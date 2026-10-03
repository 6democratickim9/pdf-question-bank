import { useEffect, useMemo, useRef, useState } from 'react';
import { db, subscribeDatabaseIssue } from './lib/jsonDb';
import { answerIsCorrect, CYCLE_SIZE, createRangeSession, createSession, gradeSession, questionsInRange } from './lib/exam';
import { createId } from './lib/id';
import { exportWrongAnswers } from './lib/exportWrongAnswers';
import { extractPdfText } from './lib/pdf/extractPdfText';
import { parsePdfQuestions } from './lib/pdf/parsePdfQuestions';
import { cleanQuestionText } from './lib/pdf/cleanQuestionText';
import { recordWrongAttempt, updateMastery } from './lib/study';
import { mergeLocalDvaAnalysis } from './lib/localAnalysis';
import WrongReviewExam from './WrongReviewExam';
import { AnalysisControls, BookmarkPage, StatsPage, StudyPage, WrongPage } from './StudyViews';
import type { BankStatistics, CycleResult, ExamSession, Question, QuestionBank, WrongReviewItem } from './types';

type View = 'banks' | 'upload' | 'preview' | 'dashboard' | 'history' | 'bookmarks' | 'study' | 'wrong' | 'stats' | 'exam' | 'result';
const blankStats = (bankId: string): BankStatistics => ({ bankId, completedQuestionIds: [], completedCycles: [] });
const formatTime = (seconds: number) => [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map((v) => String(v).padStart(2, '0')).join(':');
const savedAnswerCount = (session: ExamSession) => Object.values(session.answers).filter((answers) => answers.length).length;
const latestActiveSession = (sessions: ExamSession[]) => sessions.filter((session) => session.status === 'active' && session.kind !== 'wrong').sort((a, b) => {
  const answerDifference = savedAnswerCount(b) - savedAnswerCount(a);
  return answerDifference || (b.updatedAt ?? b.startedAt).localeCompare(a.updatedAt ?? a.startedAt);
})[0];

export default function App() {
  const [view, setView] = useState<View>('banks'); const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [bank, setBank] = useState<QuestionBank>(); const [preview, setPreview] = useState<Question[]>([]);
  const [sourceName, setSourceName] = useState(''); const [sourcePdf, setSourcePdf] = useState<File>(); const [loading, setLoading] = useState(''); const [error, setError] = useState('');
  const [savingBank, setSavingBank] = useState(false); const [saveError, setSaveError] = useState('');
  const [backupBusy, setBackupBusy] = useState(false); const [backupStatus, setBackupStatus] = useState('');
  const [sessions, setSessions] = useState<ExamSession[]>([]); const [results, setResults] = useState<CycleResult[]>([]);
  const [wrongIds, setWrongIds] = useState<string[]>([]); const [stats, setStats] = useState<BankStatistics>();
  const [wrongHistory, setWrongHistory] = useState<WrongReviewItem[]>([]);
  const [bookmarkIds, setBookmarkIds] = useState<string[]>([]);
  const [session, setSession] = useState<ExamSession>(); const [result, setResult] = useState<CycleResult>();

  const refreshBanks = async () => setBanks((await db.banks()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  useEffect(() => { void refreshBanks(); }, []);
  const cleanStoredBank = async (stored: QuestionBank) => {
    const withLocalAnalysis = await mergeLocalDvaAnalysis(stored); let changed = withLocalAnalysis !== stored;
    const questions = withLocalAnalysis.questions.map((question) => {
      const cleaned = cleanQuestionText(question.question);
      if (cleaned === question.question) return question;
      changed = true; return { ...question, question: cleaned };
    });
    if (!changed) return withLocalAnalysis;
    const cleanedBank = { ...withLocalAnalysis, questions }; await db.saveBank(cleanedBank); return cleanedBank;
  };
  const loadDashboard = async (selected: QuestionBank) => {
    const cleaned = await cleanStoredBank(selected);
    const [ss, rr, wrong, storedStats, history, bookmarks] = await Promise.all([db.sessions(cleaned.id), db.results(cleaned.id), db.wrong(cleaned.id), db.stats(cleaned.id), db.wrongHistory(cleaned.id), db.bookmarks(cleaned.id)]);
    setBank(cleaned); setSessions(ss); setResults(rr); setWrongIds(wrong?.questionIds ?? []); setStats(storedStats ?? blankStats(cleaned.id)); setWrongHistory(history); setBookmarkIds(bookmarks.map((item) => item.questionId)); setView('dashboard');
  };
  const openBank = async (selected: QuestionBank) => {
    const cleaned = await cleanStoredBank(selected);
    const [storedSessions, wrong, storedStats, bookmarks] = await Promise.all([db.sessions(cleaned.id), db.wrong(cleaned.id), db.stats(cleaned.id), db.bookmarks(cleaned.id)]);
    setBank(cleaned); setSessions(storedSessions); setWrongIds(wrong?.questionIds ?? []); setStats(storedStats ?? blankStats(cleaned.id)); setBookmarkIds(bookmarks.map((item) => item.questionId));
    await loadDashboard(cleaned);
  };
  const parseFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setError('PDF 파일을 선택해 주세요.'); return; }
    setError(''); setSourceName(file.name); setSourcePdf(file); setLoading('PDF를 여는 중…');
    try { const pages = await extractPdfText(file, (done, total) => setLoading(`텍스트 추출 중… ${done} / ${total} 페이지`)); setPreview(parsePdfQuestions(pages)); setView('preview'); }
    catch (e) { setError(e instanceof Error ? e.message : 'PDF 분석에 실패했습니다.'); } finally { setLoading(''); }
  };
  const savePreview = async () => {
    if (savingBank) return;
    const name = sourceName.replace(/\.pdf$/i, '') || 'Question Bank';
    const created: QuestionBank = { id: createId(), name, sourceFileName: sourceName, createdAt: new Date().toISOString(), questions: preview, sourcePdf };
    setSavingBank(true); setSaveError('');
    try { const verified = await db.saveNewBank(created); await refreshBanks(); await loadDashboard(verified); }
    catch (cause) { setSaveError(cause instanceof Error ? cause.message : '문제은행 저장에 실패했습니다. 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.'); }
    finally { setSavingBank(false); }
  };
  const exportBackup = async () => {
    if (backupBusy) return; setBackupBusy(true); setBackupStatus('');
    try {
      const backup = await db.exportBackup(); const url = URL.createObjectURL(backup);
      const link = document.createElement('a'); link.href = url; link.download = `pdf-question-bank-state-${new Date().toISOString().slice(0, 10)}.json`; document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000); setBackupStatus('전체 JSON 파일을 저장했습니다.');
    } catch (cause) { setBackupStatus(`백업 실패: ${cause instanceof Error ? cause.message : '알 수 없는 오류'}`); }
    finally { setBackupBusy(false); }
  };
  const importBackup = async (file: Blob) => {
    if (backupBusy) return; setBackupBusy(true); setBackupStatus('');
    try {
      const restored = await db.importBackup(file, setBackupStatus); await refreshBanks();
      setBackupStatus(`JSON 가져오기 완료: 문제은행 ${restored.banks}개를 검증했습니다.`);
    } catch (cause) { setBackupStatus(`가져오기 실패: ${cause instanceof Error ? cause.message : '알 수 없는 오류'}`); }
    finally { setBackupBusy(false); }
  };
  const startRange = async (start: number, end: number) => {
    if (!bank) return; const next = createRangeSession(bank.id, bank.questions, start, end);
    if (!next.questionIds.length) return;
    await db.saveSession(next); setSession(next); setView('exam');
  };
  const startTestWrong = async (testResult: CycleResult) => {
    if (!bank || (testResult.kind !== 'normal' && testResult.reviewOfResultId == null)) return;
    const wrongSet = new Set(testResult.results.filter((item) => !item.correct).map((item) => item.questionId));
    const questions = bank.questions.filter((question) => wrongSet.has(question.id)); if (!questions.length) return;
    const next = { ...createSession(bank.id, 'practice', questions), cycleNumber: testResult.cycleNumber, rangeStart: testResult.rangeStart, rangeEnd: testResult.rangeEnd, reviewOfResultId: testResult.id };
    await db.saveSession(next); setSession(next); setView('exam');
  };
  const startWrong = async () => {
    if (!bank) return; const set = new Set(wrongIds); const next = createSession(bank.id, 'wrong', bank.questions.filter((q) => set.has(q.id)));
    await db.saveSession(next); setSession(next); setView('exam');
  };
  const startWrongQuestions = async (questions: Question[]) => { if (!bank || !questions.length) return; const next = createSession(bank.id, 'wrong', questions); await db.saveSession(next); setSession(next); setView('exam'); };
  const startPractice = async () => {
    if (!bank) return; const next = createSession(bank.id, 'practice', bank.questions);
    await db.saveSession(next); setSession(next); setView('exam');
  };
  const startFocused = async (questions: Question[]) => {
    if (!bank || !questions.length) return; const next = createSession(bank.id, 'practice', questions);
    await db.saveSession(next); setSession(next); setView('exam');
  };
  const applyImmediateGrade = async (questionId: string, selected: string[], correct: boolean, kind: ExamSession['kind']) => {
    if (!bank || kind === 'normal') return;
    const question = bank.questions.find((item) => item.id === questionId); if (!question) return;
    const [history, storedStats] = await Promise.all([db.wrongHistory(bank.id), db.stats(bank.id)]);
    const previous = history.find((item) => item.questionId === questionId);
    const historyItem = recordWrongAttempt(previous, bank.id, question, selected, correct);
    const nextStats = updateMastery(storedStats ?? blankStats(bank.id), question, correct);
    const shouldUpdateWrong = !correct || kind === 'wrong';
    const questionIds = shouldUpdateWrong
      ? await db.updateWrongQuestion(bank.id, questionId, correct, historyItem.persistent)
      : (await db.wrong(bank.id))?.questionIds ?? wrongIds;
    await Promise.all([...(correct && !previous ? [] : [db.saveWrongHistory(historyItem)]), db.saveStats(nextStats)]);
    setWrongIds(questionIds); if (!correct || previous) setWrongHistory((items) => [...items.filter((item) => item.questionId !== questionId), historyItem]); setStats(nextStats);
  };
  const attachSourcePdf = async (file: File) => {
    if (!bank) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { alert('PDF 파일을 선택해 주세요.'); return; }
    try { const updated = { ...bank, sourcePdf: file }; await db.saveBank(updated); setBank(updated); await refreshBanks(); alert('원본 PDF가 연결되었습니다. 현재 문제에서 원본 페이지를 확인할 수 있습니다.'); }
    catch { alert('PDF 저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.'); }
  };
  const toggleBookmark = async (questionId: string) => {
    if (!bank) return;
    const bookmarked = !bookmarkIds.includes(questionId);
    await db.setBookmark(bank.id, questionId, bookmarked);
    setBookmarkIds((ids) => bookmarked ? [...new Set([...ids, questionId])] : ids.filter((id) => id !== questionId));
  };
  const submit = async (submitted: ExamSession) => {
    if (!bank) return; const graded = gradeSession(submitted, bank.questions); const closed = { ...submitted, status: 'submitted' as const };
    const updatedWrong = new Set(wrongIds);
    let updatedStats: BankStatistics = { bankId: bank.id,
      completedQuestionIds: [...new Set([...(stats?.completedQuestionIds ?? []), ...(submitted.kind === 'normal' && submitted.cycleNumber ? submitted.questionIds : [])])],
      completedCycles: [...new Set([...(stats?.completedCycles ?? []), ...(submitted.kind === 'normal' && submitted.cycleNumber ? [submitted.cycleNumber] : [])])] };
    const existingHistory = await db.wrongHistory(bank.id); const historyMap = new Map(existingHistory.map((item) => [item.questionId, item])); const historyWrites = [];
    for (const item of graded.results) { const question = bank.questions.find((q) => q.id === item.questionId); if (!question) continue; updatedStats = updateMastery(updatedStats, question, item.correct); const previous = historyMap.get(item.questionId); const historyItem = recordWrongAttempt(previous, bank.id, question, item.selected, item.correct); if (!item.correct || previous) { historyMap.set(item.questionId, historyItem); historyWrites.push(db.saveWrongHistory(historyItem)); } if (!item.correct) updatedWrong.add(item.questionId); else if (submitted.kind === 'wrong' && !historyItem.persistent) updatedWrong.delete(item.questionId); }
    await Promise.all([db.saveSession(closed), db.saveResult(graded), db.saveWrong({ bankId: bank.id, questionIds: [...updatedWrong] }), db.saveStats(updatedStats), ...historyWrites]);
    setSession(closed); setResult(graded); setWrongIds([...updatedWrong]); setWrongHistory([...historyMap.values()]); setStats(updatedStats); setView('result');
  };

  if (view === 'upload') return <Shell><Upload loading={loading} error={error} onFile={parseFile} onBack={() => setView('banks')} /></Shell>;
  if (view === 'preview') return <Shell><Preview questions={preview} fileName={sourceName} saving={savingBank} error={saveError} onSave={savePreview} onBack={() => setView('upload')} /></Shell>;
  const nav = (next: 'dashboard' | 'history' | 'bookmarks' | 'study' | 'wrong' | 'stats') => setView(next);
  if (view === 'dashboard' && bank) return <Shell bank={bank} view={view} onNavigate={nav}><AnalysisControls bank={bank} onUpdated={setBank} /><Dashboard bank={bank} sessions={sessions} results={results} wrongIds={wrongIds} stats={stats ?? blankStats(bank.id)} onAttachPdf={attachSourcePdf} onResume={(active) => { setSession(active); setView('exam'); }} onEndActive={async (active) => { await db.saveSession({ ...active, status: 'submitted', updatedAt: new Date().toISOString() }); await loadDashboard(bank); }} onRange={startRange} onTestWrong={startTestWrong} onHistory={() => setView('history')} onPractice={startPractice} onSearchPractice={startFocused} onWrong={() => setView('wrong')} onBack={() => { void refreshBanks(); setView('banks'); }} onReset={async (kind) => {
    if (kind === 'progress') await db.resetProgress(bank.id); if (kind === 'wrong') await db.saveWrong({ bankId: bank.id, questionIds: [] });
    if (kind === 'delete') { await db.deleteBank(bank.id); await refreshBanks(); setView('banks'); return; } await loadDashboard(bank);
  }} /></Shell>;
  if (view === 'history' && bank) return <Shell bank={bank} view={view} onNavigate={nav}><TestHistory results={results} active={latestActiveSession(sessions)} onOpen={(selected) => { setResult(selected); setView('result'); }} onRetry={startTestWrong} /></Shell>;
  if (view === 'bookmarks' && bank) return <Shell bank={bank} view={view} onNavigate={nav}><BookmarkPage bank={bank} history={wrongHistory} bookmarkIds={bookmarkIds} onToggleBookmark={toggleBookmark} onStart={startFocused} /></Shell>;
  if (view === 'study' && bank) return <Shell bank={bank} view={view} onNavigate={nav}><StudyPage bank={bank} stats={stats ?? blankStats(bank.id)} onStart={startFocused} /></Shell>;
  if (view === 'wrong' && bank) return <Shell bank={bank} view={view} onNavigate={nav}><WrongPage bank={bank} history={wrongHistory} wrongIds={wrongIds} bookmarkIds={bookmarkIds} onToggleBookmark={toggleBookmark} onStart={startWrongQuestions} /></Shell>;
  if (view === 'stats' && bank) return <Shell bank={bank} view={view} onNavigate={nav}><StatsPage bank={bank} stats={stats ?? blankStats(bank.id)} history={wrongHistory} onStart={startFocused} /></Shell>;
  if (view === 'exam' && bank && session?.kind === 'wrong') return <WrongReviewExam bank={bank} initial={session} bookmarkIds={bookmarkIds} onToggleBookmark={toggleBookmark} onAttachPdf={attachSourcePdf} onExit={() => loadDashboard(bank)} />;
  if (view === 'exam' && bank && session) return <Exam bank={bank} initial={session} bookmarkIds={bookmarkIds} onToggleBookmark={toggleBookmark} onAttachPdf={attachSourcePdf} onImmediateGrade={applyImmediateGrade} onSubmit={submit} onExit={() => loadDashboard(bank)} />;
  if (view === 'result' && bank && result) return <Shell><Result bank={bank} result={result} history={wrongHistory} bookmarkIds={bookmarkIds} onToggleBookmark={toggleBookmark} onAttachPdf={attachSourcePdf} onExport={() => exportWrongAnswers(bank, result)} onTestWrong={() => startTestWrong(result)} onDashboard={() => loadDashboard(bank)} /></Shell>;
  return <Shell><BankList banks={banks} backupBusy={backupBusy} backupStatus={backupStatus} onExportBackup={exportBackup} onImportBackup={importBackup} onOpen={openBank} onAdd={() => setView('upload')} /></Shell>;
}

function Shell({ children, bank, view, onNavigate }: { children: React.ReactNode; bank?: QuestionBank; view?: View; onNavigate?: (view: 'dashboard' | 'history' | 'bookmarks' | 'study' | 'wrong' | 'stats') => void }) { const [databaseIssue, setDatabaseIssue] = useState(''); useEffect(() => subscribeDatabaseIssue(setDatabaseIssue), []); return <><header><div className="brand">PDF Question Bank</div>{bank && onNavigate ? <nav className="top-nav"><button className={view === 'dashboard' ? 'active' : ''} onClick={() => onNavigate('dashboard')}>시험</button><button className={view === 'history' ? 'active' : ''} onClick={() => onNavigate('history')}>시험 기록</button><button className={view === 'bookmarks' ? 'active' : ''} onClick={() => onNavigate('bookmarks')}>책갈피</button><button className={view === 'study' ? 'active' : ''} onClick={() => onNavigate('study')}>학습</button><button className={view === 'wrong' ? 'active' : ''} onClick={() => onNavigate('wrong')}>오답</button><button className={view === 'stats' ? 'active' : ''} onClick={() => onNavigate('stats')}>통계</button></nav> : <span className="privacy">🔒 PDF는 브라우저 밖으로 전송되지 않습니다</span>}</header><main>{databaseIssue && <p className="error database-error" role="alert">{databaseIssue}</p>}{children}</main></>; }
function BankList({ banks, backupBusy, backupStatus, onExportBackup, onImportBackup, onOpen, onAdd }: { banks: QuestionBank[]; backupBusy: boolean; backupStatus: string; onExportBackup: () => void; onImportBackup: (file: Blob) => Promise<void>; onOpen: (b: QuestionBank) => void; onAdd: () => void }) {
  return <section><div className="title-row"><div><h1>My Question Banks</h1><p className="muted">로컬에 저장된 문제은행</p></div><button onClick={onAdd}>새 PDF 추가</button></div>
    <div className="backup-panel"><div><strong>공유 로컬 JSON</strong><span>Codex와 Safari가 프로젝트의 같은 JSON 파일을 사용합니다. 기존 데이터는 삭제하지 않고 병합합니다.</span></div><div><button className="secondary" disabled={backupBusy || !banks.length} onClick={() => void onExportBackup()}>{backupBusy ? '처리 중…' : '전체 JSON 내보내기'}</button><label className={`button-label ${backupBusy ? 'disabled' : ''}`}>JSON 가져오기<input type="file" accept=".json,application/json,.pqb-backup" disabled={backupBusy} onClick={(event) => { event.currentTarget.value = ''; }} onChange={(event) => { const input = event.currentTarget; const file = input.files?.[0]; if (!file) return; const stableCopy = file.slice(0, file.size, file.type); input.value = ''; void onImportBackup(stableCopy); }} /></label></div></div>{backupStatus && <p className={backupStatus.includes('실패') ? 'error' : 'backup-success'} role="status">{backupStatus}</p>}
    {!banks.length ? <div className="empty"><h2>첫 문제은행을 만들어 보세요</h2><p>정답과 해설이 포함된 PDF를 분석하거나 기존 브라우저의 전체 백업을 가져오세요.</p><button onClick={onAdd}>PDF 선택</button></div> : <div className="cards">{banks.map((b) => <button className="bank-card" key={b.id} onClick={() => onOpen(b)}><strong>{b.name}</strong><span>{b.questions.length.toLocaleString()} Questions</span><small>{new Date(b.createdAt).toLocaleDateString()}</small></button>)}</div>}
  </section>;
}
function Upload({ loading, error, onFile, onBack }: { loading: string; error: string; onFile: (f: File) => void; onBack: () => void }) {
  const [drag, setDrag] = useState(false); return <section><button className="link" onClick={onBack}>← 문제은행 목록</button><h1>PDF 가져오기</h1><p className="muted">문제, 선택지, 정답, 해설을 브라우저에서 직접 추출합니다.</p>
    <label className={`dropzone ${drag ? 'drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
      <input type="file" accept="application/pdf,.pdf" onClick={(e) => { e.currentTarget.value = ''; }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ''; }} disabled={!!loading} /><span className="upload-icon">PDF</span><strong>{loading || 'PDF를 여기에 끌어다 놓으세요'}</strong><span>{loading ? '파일 크기에 따라 잠시 걸릴 수 있습니다.' : '또는 클릭하여 파일 선택'}</span></label>{error && <p className="error">{error}</p>}
  </section>;
}
function Preview({ questions, fileName, saving, error, onSave, onBack }: { questions: Question[]; fileName: string; saving: boolean; error: string; onSave: () => void; onBack: () => void }) {
  const warningCount = questions.filter((q) => q.warnings?.length).length; return <section><button className="link" onClick={onBack} disabled={saving}>← 다른 PDF 선택</button><div className="title-row"><div><h1>PDF 분석 완료</h1><p className="muted">{fileName}</p></div><button onClick={onSave} disabled={!questions.length || saving}>{saving ? '문제은행 저장 중…' : '문제은행 생성'}</button></div>{error && <p className="error" role="alert">저장 실패: {error}</p>}
    <div className="metrics"><Metric label="Detected Questions" value={questions.length} /><Metric label="Warnings" value={warningCount} warn={warningCount > 0} /><Metric label="Pages" value={new Set(questions.flatMap((q) => q.sourcePages)).size} /></div>
    {!questions.length && <p className="error">문제 시작 패턴을 찾지 못했습니다. 텍스트 선택이 가능한 PDF인지 확인해 주세요.</p>}
    <div className="preview-list">{questions.map((q, i) => <details key={q.id}><summary><span>Question {q.originalNumber ?? i + 1}</span>{q.warnings?.length ? <span className="warning">{q.warnings.join(', ')}</span> : <span className="ok">OK</span>}<small>Pages {q.sourcePages.join('–')}</small></summary><QuestionContent question={q} /><div className="answer-line"><b>정답</b> {q.correctAnswers.join(', ') || '—'}</div>{q.explanation && <p><b>해설</b><br />{q.explanation}</p>}</details>)}</div>
  </section>;
}
function Metric({ label, value, warn }: { label: string; value: number; warn?: boolean }) { return <div className="metric"><span>{label}</span><strong className={warn ? 'warning' : ''}>{value.toLocaleString()}</strong></div>; }
function QuestionContent({ question }: { question: Question }) { return <div className="question-content"><p className="question-text">{question.question || '(빈 문제)'}</p>{question.choices.map((c) => <p key={c.key} className="choice-text"><b>{c.key}.</b> {c.text}</p>)}</div>; }

function Dashboard({ bank, sessions, results, wrongIds, onAttachPdf, onResume, onEndActive, onRange, onTestWrong, onHistory, onPractice, onSearchPractice, onWrong, onBack, onReset }: { bank: QuestionBank; sessions: ExamSession[]; results: CycleResult[]; wrongIds: string[]; stats: BankStatistics; onAttachPdf: (file: File) => void; onResume: (session: ExamSession) => void; onEndActive: (session: ExamSession) => void; onRange: (start: number, end: number) => void; onTestWrong: (result: CycleResult) => void; onHistory: () => void; onPractice: () => void; onSearchPractice: (questions: Question[]) => void; onWrong: () => void; onBack: () => void; onReset: (kind: 'progress' | 'wrong' | 'delete') => void }) {
  const maxQuestionNumber = Math.max(bank.questions.length, ...bank.questions.map((question, index) => question.originalNumber ?? index + 1));
  const [rangeStart, setRangeStart] = useState('1'); const [rangeEnd, setRangeEnd] = useState(String(Math.min(CYCLE_SIZE, maxQuestionNumber)));
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const searchResults = useMemo(() => normalizedQuery ? bank.questions.filter((question) => {
    const correctChoices = question.choices.filter((choice) => question.correctAnswers.includes(choice.key));
    return [question.question, question.explanation, ...question.choices.map((choice) => choice.text), ...correctChoices.map((choice) => choice.text), ...(question.analysis?.primaryServices ?? []), question.analysis?.concept].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
  }) : [], [bank.questions, normalizedQuery]);
  const start = Number(rangeStart); const end = Number(rangeEnd); const validRange = Number.isInteger(start) && Number.isInteger(end) && start >= 1 && start <= end && end <= maxQuestionNumber;
  const rangeCount = validRange ? questionsInRange(bank.questions, start, end).length : 0;
  const latestRangeResult = results.filter((item) => item.rangeStart != null && (item.kind === 'normal' || item.reviewOfResultId != null)).sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  const latestRangeWrongCount = latestRangeResult?.results.filter((item) => !item.correct).length ?? 0;
  const completedTests = results.filter((item) => item.kind === 'normal').length; const active = latestActiveSession(sessions);
  const activeScope = active?.rangeStart != null ? `Q${active.rangeStart}–Q${active.rangeEnd}` : active?.cycleNumber ? `Cycle ${active.cycleNumber}` : '';
  const activeLabel = active?.reviewOfResultId ? `${activeScope} 오답 다시 풀기` : active?.kind === 'practice' ? '전체 연습' : active?.rangeStart != null ? `${activeScope} 모의시험` : '기존 시험';
  return <section><button className="link" onClick={onBack}>← 문제은행 목록</button><div className="title-row"><div><h1>{bank.name}</h1><p className="muted">원하는 문제 범위를 지정해 모의시험을 시작하세요.</p></div>{active && <div className="active-session-actions"><button onClick={() => onResume(active)}>진행 중 {activeLabel} 이어하기 ({savedAnswerCount(active)}개 저장)</button><button className="secondary" onClick={() => confirm('진행 중 세션을 종료할까요? 저장된 답안 기록은 삭제하지 않습니다.') && onEndActive(active)}>진행 중 세션 종료</button></div>}</div>
    {!bank.sourcePdf && <div className="attach-pdf"><div><strong>이미지·코드가 포함된 문제인가요?</strong><span>기존 기록을 유지하면서 원본 PDF만 연결할 수 있습니다.</span></div><label className="button-label">원본 PDF 연결<input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onAttachPdf(file); }} /></label></div>}
    <div className="metrics"><Metric label="총 문제" value={bank.questions.length} /><Metric label="완료한 시험" value={completedTests} /><Metric label="저장된 시험 기록" value={results.length} /><Metric label="현재 오답" value={wrongIds.length} warn={wrongIds.length > 0} /></div>
    <section className="answer-search"><div><h2>답안 키워드 검색</h2><p>문제, 선택지, 정답 선택지와 해설에서 키워드를 찾습니다.</p></div><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="예: SourceArn, BatchGetItem, CloudWatch" aria-label="답안 키워드 검색" />{normalizedQuery && <><div className="answer-search-summary"><strong>{searchResults.length}문제</strong><button disabled={!searchResults.length || !!active} onClick={() => onSearchPractice(searchResults)}>검색 결과 전체 풀기</button></div><div className="answer-search-results">{searchResults.slice(0, 50).map((question) => { const answers = question.choices.filter((choice) => question.correctAnswers.includes(choice.key)); return <article key={question.id}><div><b>Q{question.originalNumber ?? '?'}</b><span>정답 {question.correctAnswers.join(', ')}</span></div><p>{question.question}</p><small>{answers.map((choice) => `${choice.key}. ${choice.text}`).join(' · ')}</small><button disabled={!!active} onClick={() => onSearchPractice([question])}>이 문제 풀기</button></article>; })}{searchResults.length > 50 && <p className="muted">처음 50개만 표시됩니다. 키워드를 더 구체적으로 입력해 주세요.</p>}</div></>}</section>
    <div className="range-exam-card"><div><h2>범위 모의시험</h2><p>원하는 원본 문제 번호 범위를 지정합니다. 선택된 문제당 1분으로 제한시간이 설정됩니다.</p></div><div className="range-fields"><label>시작<input aria-label="범위 시작 문제" type="number" min="1" max={maxQuestionNumber} value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} /></label><span>–</span><label>끝<input aria-label="범위 끝 문제" type="number" min="1" max={maxQuestionNumber} value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} /></label></div><div className="range-summary">{validRange ? rangeCount ? `${rangeCount}문제 · ${rangeCount}분` : '해당 범위에 문제가 없습니다.' : `1부터 ${maxQuestionNumber}까지 올바른 범위를 입력하세요.`}</div><button disabled={!!active || !validRange || !rangeCount} onClick={() => onRange(start, end)}>모의시험 시작</button></div>
    <div className="layout"><div className="history-promo"><h2>시험별 기록과 오답</h2><p>기존 90문제 Cycle과 새 범위시험 결과를 시험별로 분리해 보관합니다. 각 시험의 오답만 따로 다시 풀 수 있습니다.</p><button className="secondary" onClick={onHistory}>시험 기록 전체 보기</button></div>
      <aside>{latestRangeResult && <div className="range-wrong-card"><h2>최근 범위 오답</h2><strong>{latestRangeWrongCount}</strong><span>Q{latestRangeResult.rangeStart}–Q{latestRangeResult.rangeEnd} · 최근 범위 학습</span><p>직전 범위시험 또는 재풀이에서 아직 틀린 문제만 다시 풉니다.</p><button disabled={!latestRangeWrongCount || !!active} onClick={() => onTestWrong(latestRangeResult)}>{latestRangeWrongCount ? '남은 오답 다시 풀기' : '모든 문제 정답'}</button></div>}<div className="practice-card"><h2>전체 문제 연습</h2><span>{bank.questions.length} Questions · 시간 제한 없음</span><p>선택 즉시 정답과 해설을 확인하고, 틀린 문제는 바로 오답노트에 추가합니다.</p><button disabled={!!active} onClick={onPractice}>전체 문제 바로 풀기</button></div><div className="wrong-card"><h2>누적 오답노트</h2><strong>{wrongIds.length}</strong><span>Questions · 즉시 정답 확인</span><button disabled={!wrongIds.length || !!active} onClick={onWrong}>누적 오답노트 시작</button></div><details className="settings"><summary>설정</summary>{bank.sourcePdf && <label className="button-label secondary-label">원본 PDF 교체<input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onAttachPdf(file); }} /></label>}<button className="secondary" onClick={() => confirm('시험 진행상태와 결과를 초기화할까요?') && onReset('progress')}>시험 진행상태 초기화</button><button className="secondary" onClick={() => confirm('오답노트를 모두 지울까요?') && onReset('wrong')}>오답노트 초기화</button><button className="danger" onClick={() => confirm('문제은행과 모든 기록을 영구 삭제할까요?') && onReset('delete')}>문제은행 삭제</button></details></aside></div>
  </section>;
}

function TestHistory({ results, active, onOpen, onRetry }: { results: CycleResult[]; active?: ExamSession; onOpen: (result: CycleResult) => void; onRetry: (result: CycleResult) => void }) {
  const testResults = results.filter((item) => item.kind === 'normal' || item.reviewOfResultId != null).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return <section><div className="title-row"><div><h1>시험 기록</h1><p className="muted">기존 Cycle과 범위시험 결과 및 시험별 오답을 그대로 보관합니다.</p></div></div>{!testResults.length ? <div className="empty"><h2>아직 완료한 시험이 없습니다</h2><p>시험 페이지에서 원하는 범위를 지정해 시작하세요.</p></div> : <div className="test-history-list">{testResults.map((item) => { const correct = item.results.filter((entry) => entry.correct).length; const wrong = item.results.length - correct; const scope = item.rangeStart != null ? `Q${item.rangeStart}–Q${item.rangeEnd}` : item.cycleNumber ? `Cycle ${item.cycleNumber}` : '시험'; const label = item.reviewOfResultId ? `${scope} 오답 재풀이` : item.rangeStart != null ? `${scope} 범위시험` : scope; return <article key={item.id}><div><strong>{label}</strong><span>{new Date(item.completedAt).toLocaleString()} · {item.results.length}문제</span></div><div className="test-score"><b>{correct}/{item.results.length}</b><span className={wrong ? 'warning' : 'ok'}>{wrong ? `오답 ${wrong}` : '전부 정답'}</span></div><div className="test-history-actions"><button className="secondary" onClick={() => onOpen(item)}>결과 보기</button><button disabled={!wrong || !!active} onClick={() => onRetry(item)}>{wrong ? '이 시험 오답 풀기' : '오답 없음'}</button></div></article>; })}</div>}</section>;
}

function Exam({ bank, initial, bookmarkIds, onToggleBookmark, onAttachPdf, onImmediateGrade, onSubmit, onExit }: { bank: QuestionBank; initial: ExamSession; bookmarkIds: string[]; onToggleBookmark: (questionId: string) => void; onAttachPdf: (file: File) => void; onImmediateGrade: (questionId: string, selected: string[], correct: boolean, kind: ExamSession['kind']) => void; onSubmit: (s: ExamSession) => Promise<void>; onExit: () => void }) {
  const [current, setCurrent] = useState(initial); const [remaining, setRemaining] = useState(() => initial.endAt ? Math.max(0, Math.ceil((new Date(initial.endAt).getTime() - Date.now()) / 1000)) : 0);
  const [savedAt, setSavedAt] = useState<Date | null>(() => initial.updatedAt ? new Date(initial.updatedAt) : null); const [saving, setSaving] = useState(false); const [submitting, setSubmitting] = useState(false); const [submitError, setSubmitError] = useState('');
  const currentRef = useRef(initial); const writeQueue = useRef(Promise.resolve()); const submittingRef = useRef(false);
  const questions = useMemo(() => { const map = new Map(bank.questions.map((q) => [q.id, q])); return current.questionIds.map((id) => map.get(id)).filter((q): q is Question => !!q); }, [bank, current.questionIds]);
  const question = questions[current.currentIndex];
  const save = async (next: ExamSession) => {
    const saved = { ...next, updatedAt: new Date().toISOString() }; currentRef.current = saved; setCurrent(saved); setSaving(true);
    writeQueue.current = writeQueue.current.then(() => db.saveSession(saved).then(() => undefined)); await writeQueue.current;
    if (currentRef.current.updatedAt === saved.updatedAt) { setSavedAt(new Date(saved.updatedAt)); setSaving(false); }
  };
  const saveCheckpoint = async () => save(currentRef.current);
  const submitExam = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true; setSubmitting(true); setSubmitError('');
    try { await saveCheckpoint(); await onSubmit(currentRef.current); }
    catch (cause) { setSubmitError(cause instanceof Error ? cause.message : '시험 제출에 실패했습니다. 다시 시도해 주세요.'); submittingRef.current = false; setSubmitting(false); }
  };
  useEffect(() => {
    if (!current.endAt) return; const tick = () => { const left = Math.max(0, Math.ceil((new Date(current.endAt!).getTime() - Date.now()) / 1000)); setRemaining(left); if (!left) void submitExam(); };
    tick(); const timer = window.setInterval(tick, 1000); return () => clearInterval(timer);
  }, [current.endAt]);
  const select = async (key: string) => {
    if (!question) return; const base = currentRef.current; const old = base.answers[question.id] ?? []; const multiple = question.correctAnswers.length > 1;
    if (current.kind !== 'normal' && (multiple ? old.length >= question.correctAnswers.length : old.length > 0)) return;
    const selected = multiple ? (old.includes(key) ? old.filter((v) => v !== key) : [...old, key]) : [key];
    const next = { ...base, answers: { ...base.answers, [question.id]: selected } }; await save(next);
    if (current.kind !== 'normal' && (!multiple || selected.length === question.correctAnswers.length)) await onImmediateGrade(question.id, selected, answerIsCorrect(selected, question.correctAnswers), current.kind);
  };
  if (!question) return <main><p>문제를 찾을 수 없습니다.</p><button onClick={onExit}>대시보드</button></main>;
  const answered = current.questionIds.filter((id) => current.answers[id]?.length).length;
  const bookmarkedInExam = questions.map((item, index) => ({ item, index })).filter(({ item }) => bookmarkIds.includes(item.id));
  const needsSource = !question.question.trim() || question.choices.length < 2;
  const displayChoices = question.choices.length ? question.choices : ['A', 'B', 'C', 'D'].map((key) => ({ key, text: '원본 PDF의 선택지를 확인하세요.' }));
  const selectedNow = current.answers[question.id] ?? []; const revealed = current.kind !== 'normal' && selectedNow.length > 0 && (question.correctAnswers.length <= 1 || selectedNow.length === question.correctAnswers.length); const correctNow = revealed && answerIsCorrect(selectedNow, question.correctAnswers);
  const examTitle = current.reviewOfResultId ? current.rangeStart != null ? `범위 오답 Q${current.rangeStart}–Q${current.rangeEnd}` : `Cycle ${current.cycleNumber} 오답` : current.kind === 'normal' ? current.rangeStart != null ? `모의시험 Q${current.rangeStart}–Q${current.rangeEnd}` : `Cycle ${current.cycleNumber}` : current.kind === 'practice' ? '전체 문제 연습' : '오답노트';
  return <div className="exam-shell"><header className="exam-header"><div><strong>{examTitle}</strong><span>Question {current.currentIndex + 1} / {questions.length}</span></div>{current.endAt && <div className={`timer ${remaining < 300 ? 'warning' : ''}`}><small>남은 시간</small><strong>{formatTime(remaining)}</strong></div>}<div className="save-controls"><span>{submitting ? '제출 중…' : saving ? '저장 중…' : savedAt ? `${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 저장됨` : '자동 저장 켜짐'}</span><button className="finish submit-button" disabled={saving || submitting} onClick={() => void submitExam()}>{submitting ? '제출 중…' : '시험 종료'}</button><button className="secondary" disabled={saving || submitting} onClick={() => void saveCheckpoint()}>중간 저장</button><button className="secondary exit-button" disabled={submitting} onClick={() => { if (confirm('현재 위치와 답안을 저장하고 대시보드로 나갈까요?')) void saveCheckpoint().then(onExit); }}>나가기</button></div></header>
    <div className="progress"><span style={{ width: `${((current.currentIndex + 1) / questions.length) * 100}%` }} /></div>{submitError && <p className="error exam-submit-error" role="alert">시험 종료 실패: {submitError}</p>}<main className="exam-main"><aside className="navigator"><b>문제 번호</b><div>{questions.map((q, i) => <button key={q.id} aria-label={`${i + 1}번${bookmarkIds.includes(q.id) ? ' 책갈피' : ''}`} className={`${i === current.currentIndex ? 'current' : ''} ${current.answers[q.id]?.length ? 'answered' : ''} ${bookmarkIds.includes(q.id) ? 'bookmarked' : ''}`} onClick={() => void save({ ...currentRef.current, currentIndex: i })}>{i + 1}{bookmarkIds.includes(q.id) && <span>★</span>}</button>)}</div><small>{answered}/{questions.length} 응답</small>{bookmarkedInExam.length > 0 && <section className="exam-bookmarks"><b>★ 책갈피 다시 확인</b><div>{bookmarkedInExam.map(({ item, index }) => <button key={item.id} onClick={() => void save({ ...currentRef.current, currentIndex: index })}>Q{item.originalNumber ?? index + 1}</button>)}</div></section>}</aside>
      <article className="question-panel"><div className="question-toolbar"><span className="question-number">Question {question.originalNumber ?? current.currentIndex + 1}{question.correctAnswers.length > 1 && ' · 복수 선택'}</span><button className={`bookmark-button ${bookmarkIds.includes(question.id) ? 'active' : ''}`} onClick={() => void onToggleBookmark(question.id)}>{bookmarkIds.includes(question.id) ? '★ 책갈피 해제' : '☆ 책갈피'}</button></div><h2>{question.question || '원본 PDF에서 문제를 확인하세요.'}</h2>{bank.sourcePdf ? <SourcePages key={question.id} pdf={bank.sourcePdf} pages={question.sourcePages} questionNumber={question.originalNumber} initialOpen={needsSource} /> : needsSource ? <div className="source-unavailable"><strong>이 문제의 이미지·코드·선택지가 PDF에만 있습니다.</strong><span>진행 기록을 유지한 채 지금 원본을 연결하세요.</span><label className="button-label">원본 PDF 연결<input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onAttachPdf(file); }} /></label></div> : null}<div className="choices">{displayChoices.map((choice) => { const checked = selectedNow.includes(choice.key); const stateClass = revealed ? question.correctAnswers.includes(choice.key) ? 'correct-choice' : checked ? 'wrong-choice' : '' : checked ? 'selected' : ''; return <label className={stateClass} key={choice.key}><input disabled={revealed} type={question.correctAnswers.length > 1 ? 'checkbox' : 'radio'} name={question.id} checked={checked} onChange={() => void select(choice.key)} /><b>{choice.key}</b><span>{choice.text}</span></label>; })}</div>{revealed && <div className={`instant-feedback ${correctNow ? 'correct' : 'incorrect'}`}><strong>{correctNow ? '정답입니다.' : `오답입니다. 정답: ${question.correctAnswers.join(', ') || '파싱되지 않음'}`}</strong>{question.explanation && <p>{question.explanation}</p>}</div>}
        <div className="exam-actions"><button className="secondary" disabled={!current.currentIndex || submitting} onClick={() => void save({ ...currentRef.current, currentIndex: currentRef.current.currentIndex - 1 })}>이전</button>{current.currentIndex < questions.length - 1 ? <button disabled={submitting} onClick={() => void save({ ...currentRef.current, currentIndex: currentRef.current.currentIndex + 1 })}>다음</button> : <button className="finish" disabled={saving || submitting} onClick={() => void submitExam()}>{submitting ? '제출 중…' : `시험 종료 (${answered}/${questions.length})`}</button>}</div></article></main>
  </div>;
}

function Result({ bank, result, history, bookmarkIds, onToggleBookmark, onAttachPdf, onExport, onTestWrong, onDashboard }: { bank: QuestionBank; result: CycleResult; history: WrongReviewItem[]; bookmarkIds: string[]; onToggleBookmark: (questionId: string) => void; onAttachPdf: (file: File) => void; onExport: () => void; onTestWrong: () => void; onDashboard: () => void }) {
  const correct = result.results.filter((r) => r.correct).length; const unanswered = result.results.filter((r) => r.unanswered).length; const wrong = result.results.length - correct; const questions = new Map(bank.questions.map((q) => [q.id, q]));
  const bookmarkResults = result.results.filter((item) => bookmarkIds.includes(item.questionId));
  const resultTitle = result.reviewOfResultId ? result.rangeStart != null ? `범위 오답 Q${result.rangeStart}–Q${result.rangeEnd}` : `Cycle ${result.cycleNumber} 오답` : result.kind === 'normal' ? result.rangeStart != null ? `모의시험 Q${result.rangeStart}–Q${result.rangeEnd}` : `Cycle ${result.cycleNumber}` : result.kind === 'practice' ? '전체 문제 연습' : '오답노트';
  const canReviewTestWrong = (result.kind === 'normal' || result.reviewOfResultId != null) && wrong > 0;
  return <section><div className="result-hero"><span>{resultTitle} 완료</span><h1>{correct} / {result.results.length}</h1><strong>정답률 {result.results.length ? (correct / result.results.length * 100).toFixed(1) : '0.0'}%</strong><div><Metric label="정답" value={correct} /><Metric label="오답" value={wrong} warn={wrong > 0} /><Metric label="미응답" value={unanswered} /></div><div className="result-actions"><button onClick={onDashboard}>대시보드</button>{canReviewTestWrong && <button onClick={onTestWrong}>{result.reviewOfResultId ? '남은 오답 다시 풀기' : '이 시험 오답 다시 풀기'}</button>}{wrong > 0 && <button className="secondary" onClick={onExport}>틀린 문제 PDF 다운로드</button>}</div></div>
    {bookmarkResults.length > 0 && <section className="bookmark-result-panel"><div><h2>★ 책갈피 결과</h2><span>{bookmarkResults.filter((item) => item.correct).length}개 정답 · {bookmarkResults.filter((item) => !item.correct).length}개 오답/미응답</span></div><div>{bookmarkResults.map((item, index) => { const question = questions.get(item.questionId); const label = item.correct ? '정답' : item.unanswered ? '미응답' : '오답'; return <button key={item.questionId} className={item.correct ? 'bookmark-result-correct' : 'bookmark-result-wrong'} onClick={() => { const target = document.getElementById(`result-${item.questionId}`) as HTMLDetailsElement | null; if (target) { target.open = true; target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}>Q{question?.originalNumber ?? index + 1}<small>{label}</small></button>; })}</div></section>}
    {!bank.sourcePdf && <div className="attach-pdf"><div><strong>이미지·코드를 보려면 원본 PDF를 연결하세요</strong><span>시험 결과와 진행 기록은 그대로 유지됩니다.</span></div><label className="button-label">원본 PDF 연결<input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onAttachPdf(file); }} /></label></div>}
    <h2>문제별 결과</h2><div className="preview-list results">{result.results.map((item, i) => { const q = questions.get(item.questionId); if (!q) return null; const past = history.find((entry) => entry.questionId === q.id); const bookmarked = bookmarkIds.includes(q.id); return <details id={`result-${item.questionId}`} key={item.questionId}><summary><span>Question {q.originalNumber ?? i + 1}{bookmarked ? ' · ★' : ''}</span><span className={item.correct ? 'ok' : 'warning'}>{item.correct ? '정답' : item.unanswered ? '미응답' : '오답'}</span></summary><div className="result-question-meta"><span>{past ? `누적 오답 ${past.wrongCount}회 · 최근 ${past.lastAttemptCorrect ? '정답' : '오답'}` : '과거 오답 기록 없음'}</span><button className={`bookmark-button ${bookmarked ? 'active' : ''}`} onClick={() => void onToggleBookmark(q.id)}>{bookmarked ? '★ 책갈피 해제' : '☆ 책갈피'}</button></div><QuestionContent question={q} />{bank.sourcePdf && q.originalNumber != null && <SourcePages pdf={bank.sourcePdf} pages={q.sourcePages} questionNumber={q.originalNumber} />}<p><b>내 답:</b> {item.selected.join(', ') || '—'}<br /><b>정답:</b> {q.correctAnswers.join(', ') || '파싱되지 않음'}</p>{q.explanation && <p><b>해설</b><br />{q.explanation}</p>}</details>; })}</div>
  </section>;
}

function SourcePages({ pdf, pages, questionNumber, initialOpen = false }: { pdf: Blob; pages: number[]; questionNumber?: number; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen); const [images, setImages] = useState<string[]>([]); const [loadError, setLoadError] = useState('');
  useEffect(() => {
    if (!open || images.length) return; let cancelled = false;
    if (questionNumber == null) { setLoadError('원본 문제 번호를 찾지 못했습니다.'); return; }
    void import('./lib/pdf/renderPdfPages').then(({ renderQuestionPages }) => renderQuestionPages(pdf, pages, questionNumber)).then((rendered) => { if (!cancelled) setImages(rendered); }).catch(() => { if (!cancelled) setLoadError('정답을 제외한 문제 영역을 찾지 못했습니다.'); });
    return () => { cancelled = true; };
  }, [open, images.length, pages, pdf, questionNumber]);
  return <div className="source-pages"><button className="secondary" onClick={() => setOpen((value) => !value)}>{open ? '문제 원본 닫기' : `문제 원본 보기 · 정답 제외 (${pages.map((page) => `p.${page}`).join(', ')})`}</button>{open && <div>{loadError ? <p className="error">{loadError}</p> : images.length ? images.map((src, index) => <img key={pages[index]} src={src} alt={`PDF 문제 영역 ${pages[index]}페이지`} />) : <p className="muted">정답을 제외한 문제 영역 렌더링 중…</p>}</div>}</div>;
}
