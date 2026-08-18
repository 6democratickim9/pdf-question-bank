import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from './lib/db';
import { CYCLE_SIZE, createSession, gradeSession } from './lib/exam';
import { createId } from './lib/id';
import { exportWrongAnswers } from './lib/exportWrongAnswers';
import { extractPdfText } from './lib/pdf/extractPdfText';
import { parsePdfQuestions } from './lib/pdf/parsePdfQuestions';
import { cleanQuestionText } from './lib/pdf/cleanQuestionText';
import type { BankStatistics, CycleResult, ExamSession, Question, QuestionBank } from './types';

type View = 'banks' | 'upload' | 'preview' | 'dashboard' | 'exam' | 'result';
const blankStats = (bankId: string): BankStatistics => ({ bankId, completedQuestionIds: [], completedCycles: [] });
const formatTime = (seconds: number) => [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map((v) => String(v).padStart(2, '0')).join(':');
const savedAnswerCount = (session: ExamSession) => Object.values(session.answers).filter((answers) => answers.length).length;
const latestActiveSession = (sessions: ExamSession[]) => sessions.filter((session) => session.status === 'active').sort((a, b) => {
  const answerDifference = savedAnswerCount(b) - savedAnswerCount(a);
  return answerDifference || (b.updatedAt ?? b.startedAt).localeCompare(a.updatedAt ?? a.startedAt);
})[0];

export default function App() {
  const [view, setView] = useState<View>('banks'); const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [bank, setBank] = useState<QuestionBank>(); const [preview, setPreview] = useState<Question[]>([]);
  const [sourceName, setSourceName] = useState(''); const [loading, setLoading] = useState(''); const [error, setError] = useState('');
  const [sessions, setSessions] = useState<ExamSession[]>([]); const [results, setResults] = useState<CycleResult[]>([]);
  const [wrongIds, setWrongIds] = useState<string[]>([]); const [stats, setStats] = useState<BankStatistics>();
  const [session, setSession] = useState<ExamSession>(); const [result, setResult] = useState<CycleResult>();

  const refreshBanks = async () => setBanks((await db.banks()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  useEffect(() => { void refreshBanks(); }, []);
  const cleanStoredBank = async (stored: QuestionBank) => {
    let changed = false;
    const questions = stored.questions.map((question) => {
      const cleaned = cleanQuestionText(question.question);
      if (cleaned === question.question) return question;
      changed = true; return { ...question, question: cleaned };
    });
    if (!changed) return stored;
    const cleanedBank = { ...stored, questions }; await db.saveBank(cleanedBank); return cleanedBank;
  };
  const loadDashboard = async (selected: QuestionBank) => {
    const cleaned = await cleanStoredBank(selected);
    const [ss, rr, wrong, storedStats] = await Promise.all([db.sessions(cleaned.id), db.results(cleaned.id), db.wrong(cleaned.id), db.stats(cleaned.id)]);
    setBank(cleaned); setSessions(ss); setResults(rr); setWrongIds(wrong?.questionIds ?? []); setStats(storedStats ?? blankStats(cleaned.id)); setView('dashboard');
  };
  const openBank = async (selected: QuestionBank) => {
    const cleaned = await cleanStoredBank(selected);
    const [storedSessions, wrong, storedStats] = await Promise.all([db.sessions(cleaned.id), db.wrong(cleaned.id), db.stats(cleaned.id)]);
    const active = latestActiveSession(storedSessions);
    if (active) { setBank(cleaned); setSessions(storedSessions); setWrongIds(wrong?.questionIds ?? []); setStats(storedStats ?? blankStats(cleaned.id)); setSession(active); setView('exam'); } else await loadDashboard(cleaned);
  };
  const parseFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setError('PDF 파일을 선택해 주세요.'); return; }
    setError(''); setSourceName(file.name); setLoading('PDF를 여는 중…');
    try { const pages = await extractPdfText(file, (done, total) => setLoading(`텍스트 추출 중… ${done} / ${total} 페이지`)); setPreview(parsePdfQuestions(pages)); setView('preview'); }
    catch (e) { setError(e instanceof Error ? e.message : 'PDF 분석에 실패했습니다.'); } finally { setLoading(''); }
  };
  const savePreview = async () => {
    const name = sourceName.replace(/\.pdf$/i, '') || 'Question Bank';
    const created: QuestionBank = { id: createId(), name, sourceFileName: sourceName, createdAt: new Date().toISOString(), questions: preview };
    await Promise.all([db.saveBank(created), db.saveStats(blankStats(created.id)), db.saveWrong({ bankId: created.id, questionIds: [] })]);
    await refreshBanks(); await loadDashboard(created);
  };
  const startNormal = async (cycle: number) => {
    if (!bank) return; const slice = bank.questions.slice((cycle - 1) * CYCLE_SIZE, cycle * CYCLE_SIZE); const next = createSession(bank.id, 'normal', slice, cycle);
    await db.saveSession(next); setSession(next); setView('exam');
  };
  const startWrong = async () => {
    if (!bank) return; const set = new Set(wrongIds); const next = createSession(bank.id, 'wrong', bank.questions.filter((q) => set.has(q.id)));
    await db.saveSession(next); setSession(next); setView('exam');
  };
  const submit = async (submitted: ExamSession) => {
    if (!bank) return; const graded = gradeSession(submitted, bank.questions); const closed = { ...submitted, status: 'submitted' as const };
    let updatedWrong = new Set(wrongIds);
    if (submitted.kind === 'normal') graded.results.filter((r) => !r.correct).forEach((r) => updatedWrong.add(r.questionId));
    else graded.results.forEach((r) => r.correct ? updatedWrong.delete(r.questionId) : updatedWrong.add(r.questionId));
    const updatedStats: BankStatistics = { bankId: bank.id,
      completedQuestionIds: [...new Set([...(stats?.completedQuestionIds ?? []), ...(submitted.kind === 'normal' ? submitted.questionIds : [])])],
      completedCycles: [...new Set([...(stats?.completedCycles ?? []), ...(submitted.kind === 'normal' && submitted.cycleNumber ? [submitted.cycleNumber] : [])])] };
    await Promise.all([db.saveSession(closed), db.saveResult(graded), db.saveWrong({ bankId: bank.id, questionIds: [...updatedWrong] }), db.saveStats(updatedStats)]);
    setSession(closed); setResult(graded); setWrongIds([...updatedWrong]); setStats(updatedStats); setView('result');
  };

  if (view === 'upload') return <Shell><Upload loading={loading} error={error} onFile={parseFile} onBack={() => setView('banks')} /></Shell>;
  if (view === 'preview') return <Shell><Preview questions={preview} fileName={sourceName} onSave={savePreview} onBack={() => setView('upload')} /></Shell>;
  if (view === 'dashboard' && bank) return <Shell><Dashboard bank={bank} sessions={sessions} results={results} wrongIds={wrongIds} stats={stats ?? blankStats(bank.id)} onResume={(active) => { setSession(active); setView('exam'); }} onCycle={startNormal} onWrong={startWrong} onBack={() => { void refreshBanks(); setView('banks'); }} onReset={async (kind) => {
    if (kind === 'progress') await db.resetProgress(bank.id); if (kind === 'wrong') await db.saveWrong({ bankId: bank.id, questionIds: [] });
    if (kind === 'delete') { await db.deleteBank(bank.id); await refreshBanks(); setView('banks'); return; } await loadDashboard(bank);
  }} /></Shell>;
  if (view === 'exam' && bank && session) return <Exam bank={bank} initial={session} onSubmit={submit} onExit={() => loadDashboard(bank)} />;
  if (view === 'result' && bank && result) return <Shell><Result bank={bank} result={result} onExport={() => exportWrongAnswers(bank, result)} onDashboard={() => loadDashboard(bank)} /></Shell>;
  return <Shell><BankList banks={banks} onOpen={openBank} onAdd={() => setView('upload')} /></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) { return <><header><div className="brand">PDF Question Bank</div><span className="privacy">🔒 PDF는 브라우저 밖으로 전송되지 않습니다</span></header><main>{children}</main></>; }
function BankList({ banks, onOpen, onAdd }: { banks: QuestionBank[]; onOpen: (b: QuestionBank) => void; onAdd: () => void }) {
  return <section><div className="title-row"><div><h1>My Question Banks</h1><p className="muted">로컬에 저장된 문제은행</p></div><button onClick={onAdd}>새 PDF 추가</button></div>
    {!banks.length ? <div className="empty"><h2>첫 문제은행을 만들어 보세요</h2><p>정답과 해설이 포함된 PDF를 분석해 시험을 시작할 수 있습니다.</p><button onClick={onAdd}>PDF 선택</button></div> : <div className="cards">{banks.map((b) => <button className="bank-card" key={b.id} onClick={() => onOpen(b)}><strong>{b.name}</strong><span>{b.questions.length.toLocaleString()} Questions</span><small>{new Date(b.createdAt).toLocaleDateString()}</small></button>)}</div>}
  </section>;
}
function Upload({ loading, error, onFile, onBack }: { loading: string; error: string; onFile: (f: File) => void; onBack: () => void }) {
  const [drag, setDrag] = useState(false); return <section><button className="link" onClick={onBack}>← 문제은행 목록</button><h1>PDF 가져오기</h1><p className="muted">문제, 선택지, 정답, 해설을 브라우저에서 직접 추출합니다.</p>
    <label className={`dropzone ${drag ? 'drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
      <input type="file" accept="application/pdf,.pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} disabled={!!loading} /><span className="upload-icon">PDF</span><strong>{loading || 'PDF를 여기에 끌어다 놓으세요'}</strong><span>{loading ? '파일 크기에 따라 잠시 걸릴 수 있습니다.' : '또는 클릭하여 파일 선택'}</span></label>{error && <p className="error">{error}</p>}
  </section>;
}
function Preview({ questions, fileName, onSave, onBack }: { questions: Question[]; fileName: string; onSave: () => void; onBack: () => void }) {
  const warningCount = questions.filter((q) => q.warnings?.length).length; return <section><button className="link" onClick={onBack}>← 다른 PDF 선택</button><div className="title-row"><div><h1>PDF 분석 완료</h1><p className="muted">{fileName}</p></div><button onClick={onSave} disabled={!questions.length}>문제은행 생성</button></div>
    <div className="metrics"><Metric label="Detected Questions" value={questions.length} /><Metric label="Warnings" value={warningCount} warn={warningCount > 0} /><Metric label="Pages" value={new Set(questions.flatMap((q) => q.sourcePages)).size} /></div>
    {!questions.length && <p className="error">문제 시작 패턴을 찾지 못했습니다. 텍스트 선택이 가능한 PDF인지 확인해 주세요.</p>}
    <div className="preview-list">{questions.map((q, i) => <details key={q.id}><summary><span>Question {q.originalNumber ?? i + 1}</span>{q.warnings?.length ? <span className="warning">{q.warnings.join(', ')}</span> : <span className="ok">OK</span>}<small>Pages {q.sourcePages.join('–')}</small></summary><QuestionContent question={q} /><div className="answer-line"><b>정답</b> {q.correctAnswers.join(', ') || '—'}</div>{q.explanation && <p><b>해설</b><br />{q.explanation}</p>}</details>)}</div>
  </section>;
}
function Metric({ label, value, warn }: { label: string; value: number; warn?: boolean }) { return <div className="metric"><span>{label}</span><strong className={warn ? 'warning' : ''}>{value.toLocaleString()}</strong></div>; }
function QuestionContent({ question }: { question: Question }) { return <div className="question-content"><p className="question-text">{question.question || '(빈 문제)'}</p>{question.choices.map((c) => <p key={c.key} className="choice-text"><b>{c.key}.</b> {c.text}</p>)}</div>; }

function Dashboard({ bank, sessions, results, wrongIds, stats, onResume, onCycle, onWrong, onBack, onReset }: { bank: QuestionBank; sessions: ExamSession[]; results: CycleResult[]; wrongIds: string[]; stats: BankStatistics; onResume: (session: ExamSession) => void; onCycle: (n: number) => void; onWrong: () => void; onBack: () => void; onReset: (kind: 'progress' | 'wrong' | 'delete') => void }) {
  const cycles = Math.ceil(bank.questions.length / CYCLE_SIZE); const completed = new Set(stats.completedCycles); const active = latestActiveSession(sessions);
  return <section><button className="link" onClick={onBack}>← 문제은행 목록</button><div className="title-row"><div><h1>{bank.name}</h1><p className="muted">90 Questions / 90 Minutes</p></div>{active && <button onClick={() => onResume(active)}>진행 중 시험 복구 ({savedAnswerCount(active)}개 저장)</button>}</div>
    <div className="metrics"><Metric label="총 문제" value={bank.questions.length} /><Metric label="완료 문제" value={stats.completedQuestionIds.length} /><Metric label="미응시 문제" value={Math.max(0, bank.questions.length - stats.completedQuestionIds.length)} /><Metric label="현재 오답" value={wrongIds.length} warn={wrongIds.length > 0} /></div>
    <div className="layout"><div><h2>일반 시험 Cycle</h2><div className="cycle-list">{Array.from({ length: cycles }, (_, i) => i + 1).map((n) => { const done = completed.has(n); const unlocked = !active && (n === 1 || completed.has(n - 1)); const oldResult = results.find((r) => r.kind === 'normal' && r.cycleNumber === n); return <div className="cycle" key={n}><div><strong>Cycle {n}</strong><span>{Math.min(CYCLE_SIZE, bank.questions.length - (n - 1) * CYCLE_SIZE)} Questions</span></div><span>{done ? '완료' : active ? '진행 중 시험 있음' : unlocked ? '시작 가능' : '잠김'}</span>{done && oldResult ? <span>{oldResult.results.filter((r) => r.correct).length}/{oldResult.results.length}</span> : <button disabled={!unlocked} onClick={() => onCycle(n)}>시작</button>}</div>; })}</div></div>
      <aside><div className="wrong-card"><h2>오답노트</h2><strong>{wrongIds.length}</strong><span>Questions · 시간 제한 없음</span><button disabled={!wrongIds.length} onClick={onWrong}>오답노트 시작</button></div><details className="settings"><summary>설정</summary><button className="secondary" onClick={() => confirm('시험 진행상태와 결과를 초기화할까요?') && onReset('progress')}>시험 진행상태 초기화</button><button className="secondary" onClick={() => confirm('오답노트를 모두 지울까요?') && onReset('wrong')}>오답노트 초기화</button><button className="danger" onClick={() => confirm('문제은행과 모든 기록을 영구 삭제할까요?') && onReset('delete')}>문제은행 삭제</button></details></aside></div>
  </section>;
}

function Exam({ bank, initial, onSubmit, onExit }: { bank: QuestionBank; initial: ExamSession; onSubmit: (s: ExamSession) => void; onExit: () => void }) {
  const [current, setCurrent] = useState(initial); const [remaining, setRemaining] = useState(() => initial.endAt ? Math.max(0, Math.ceil((new Date(initial.endAt).getTime() - Date.now()) / 1000)) : 0);
  const [savedAt, setSavedAt] = useState<Date | null>(() => initial.updatedAt ? new Date(initial.updatedAt) : null); const [saving, setSaving] = useState(false);
  const currentRef = useRef(initial); const writeQueue = useRef(Promise.resolve());
  const questions = useMemo(() => { const map = new Map(bank.questions.map((q) => [q.id, q])); return current.questionIds.map((id) => map.get(id)).filter((q): q is Question => !!q); }, [bank, current.questionIds]);
  const question = questions[current.currentIndex];
  useEffect(() => {
    if (!current.endAt) return; const tick = () => { const left = Math.max(0, Math.ceil((new Date(current.endAt!).getTime() - Date.now()) / 1000)); setRemaining(left); if (!left) void onSubmit(current); };
    tick(); const timer = window.setInterval(tick, 1000); return () => clearInterval(timer);
  }, [current, onSubmit]);
  const save = async (next: ExamSession) => {
    const saved = { ...next, updatedAt: new Date().toISOString() }; currentRef.current = saved; setCurrent(saved); setSaving(true);
    writeQueue.current = writeQueue.current.then(() => db.saveSession(saved).then(() => undefined)); await writeQueue.current;
    if (currentRef.current.updatedAt === saved.updatedAt) { setSavedAt(new Date(saved.updatedAt)); setSaving(false); }
  };
  const saveCheckpoint = async () => save(currentRef.current);
  const select = (key: string) => {
    if (!question) return; const base = currentRef.current; const old = base.answers[question.id] ?? []; const multiple = question.correctAnswers.length > 1;
    const selected = multiple ? (old.includes(key) ? old.filter((v) => v !== key) : [...old, key]) : [key];
    void save({ ...base, answers: { ...base.answers, [question.id]: selected } });
  };
  if (!question) return <main><p>문제를 찾을 수 없습니다.</p><button onClick={onExit}>대시보드</button></main>;
  const answered = current.questionIds.filter((id) => current.answers[id]?.length).length;
  return <div className="exam-shell"><header className="exam-header"><div><strong>{current.kind === 'normal' ? `Cycle ${current.cycleNumber}` : '오답노트'}</strong><span>Question {current.currentIndex + 1} / {questions.length}</span></div>{current.endAt && <div className={`timer ${remaining < 300 ? 'warning' : ''}`}><small>남은 시간</small><strong>{formatTime(remaining)}</strong></div>}<div className="save-controls"><span>{saving ? '저장 중…' : savedAt ? `${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 저장됨` : '자동 저장 켜짐'}</span><button className="secondary" disabled={saving} onClick={() => void saveCheckpoint()}>중간 저장</button><button className="secondary exit-button" onClick={() => { if (confirm('현재 위치와 답안을 저장하고 대시보드로 나갈까요?')) void saveCheckpoint().then(onExit); }}>나가기</button></div></header>
    <div className="progress"><span style={{ width: `${((current.currentIndex + 1) / questions.length) * 100}%` }} /></div><main className="exam-main"><aside className="navigator"><b>문제 번호</b><div>{questions.map((q, i) => <button key={q.id} className={`${i === current.currentIndex ? 'current' : ''} ${current.answers[q.id]?.length ? 'answered' : ''}`} onClick={() => void save({ ...currentRef.current, currentIndex: i })}>{i + 1}</button>)}</div><small>{answered}/{questions.length} 응답</small></aside>
      <article className="question-panel"><span className="question-number">Question {question.originalNumber ?? current.currentIndex + 1}{question.correctAnswers.length > 1 && ' · 복수 선택'}</span><h2>{question.question}</h2><div className="choices">{question.choices.map((choice) => { const checked = (current.answers[question.id] ?? []).includes(choice.key); return <label className={checked ? 'selected' : ''} key={choice.key}><input type={question.correctAnswers.length > 1 ? 'checkbox' : 'radio'} name={question.id} checked={checked} onChange={() => select(choice.key)} /><b>{choice.key}</b><span>{choice.text}</span></label>; })}</div>
        <div className="exam-actions"><button className="secondary" disabled={!current.currentIndex} onClick={() => void save({ ...currentRef.current, currentIndex: currentRef.current.currentIndex - 1 })}>이전</button>{current.currentIndex < questions.length - 1 ? <button onClick={() => void save({ ...currentRef.current, currentIndex: currentRef.current.currentIndex + 1 })}>다음</button> : <button className="finish" onClick={() => confirm(`응답 ${answered}/${questions.length}. 시험을 제출할까요?`) && void onSubmit(currentRef.current)}>시험 종료</button>}</div></article></main>
  </div>;
}

function Result({ bank, result, onExport, onDashboard }: { bank: QuestionBank; result: CycleResult; onExport: () => void; onDashboard: () => void }) {
  const correct = result.results.filter((r) => r.correct).length; const unanswered = result.results.filter((r) => r.unanswered).length; const wrong = result.results.length - correct; const questions = new Map(bank.questions.map((q) => [q.id, q]));
  return <section><div className="result-hero"><span>{result.kind === 'normal' ? `Cycle ${result.cycleNumber}` : '오답노트'} 완료</span><h1>{correct} / {result.results.length}</h1><strong>정답률 {result.results.length ? (correct / result.results.length * 100).toFixed(1) : '0.0'}%</strong><div><Metric label="정답" value={correct} /><Metric label="오답" value={wrong} warn={wrong > 0} /><Metric label="미응답" value={unanswered} /></div><div className="result-actions"><button onClick={onDashboard}>대시보드</button>{wrong > 0 && <button className="secondary" onClick={onExport}>틀린 문제 PDF 다운로드</button>}</div></div>
    <h2>문제별 결과</h2><div className="preview-list results">{result.results.map((item, i) => { const q = questions.get(item.questionId); if (!q) return null; return <details key={item.questionId}><summary><span>Question {q.originalNumber ?? i + 1}</span><span className={item.correct ? 'ok' : 'warning'}>{item.correct ? '정답' : item.unanswered ? '미응답' : '오답'}</span></summary><QuestionContent question={q} /><p><b>내 답:</b> {item.selected.join(', ') || '—'}<br /><b>정답:</b> {q.correctAnswers.join(', ')}</p>{q.explanation && <p><b>해설</b><br />{q.explanation}</p>}</details>; })}</div>
  </section>;
}
