import { useMemo, useState } from 'react';
import { questionsForWrongQueue, relatedQuestionScores } from './lib/study';
import { analyzeDvaBank, createEndpointAnalyzer, type AnalysisProgress } from './lib/dvaAnalysis';
import { db } from './lib/db';
import { AWS_SERVICE_DESCRIPTIONS } from './lib/awsServiceDescriptions';
import { describeAwsConcept } from './lib/awsConceptDescriptions';
import type { BankStatistics, Question, QuestionBank, WrongReviewItem } from './types';

export function StudyAnalysis({ question, bank, onOpen, candidateQuestionIds }: { question: Question; bank: QuestionBank; onOpen?: (q: Question) => void; candidateQuestionIds?: string[] }) {
  const a = question.analysis;
  if (!a) return <div className="analysis-empty">이 문제에는 아직 Study Analysis 데이터가 없습니다.</div>;
  const candidates = candidateQuestionIds
    ? bank.questions.filter((candidate) => candidateQuestionIds.includes(candidate.id))
    : bank.questions;
  const related = relatedQuestionScores(question, candidates).slice(0, 5);
  return <section className="study-analysis"><div className="analysis-heading"><span>Study Analysis</span><b>난이도 {a.difficulty}/5</b></div>
    <div className="concept-explanation"><b>{a.concept}이란?</b><p>{describeAwsConcept(a.concept, a.primaryServices)}</p></div>
    <div className="service-explanations"><b>Services in this question</b>{[...a.primaryServices, ...a.secondaryServices].map((service) => <div key={service}><strong>{service}</strong><span>{AWS_SERVICE_DESCRIPTIONS[service] ?? a.serviceSummaries?.[service]}</span></div>)}</div>
    <div className="analysis-grid"><AnalysisItem title="Type" text={a.concept} /><AnalysisItem title="Pattern" text={a.problemPattern === 'OTHER' ? `OTHER · ${a.suggestedPattern ?? ''}` : a.problemPattern} /><AnalysisItem title="Part" text={a.part} /><AnalysisItem title="Services" text={[...a.primaryServices, ...a.secondaryServices].join(' · ') || '—'} /></div>
    <AnalysisList title="Architecture" values={a.architecturePath} ordered /><AnalysisList title="Key Clues" values={a.keyClues} /><div className="answer-rule"><b>Decision Point</b><p>{a.decisionPoint || '—'}</p></div><AnalysisList title="How to Think" values={a.reasoningPath} ordered />
    <div className="answer-rule"><b>Answer Rule</b><p>{a.correctAnswerRule || '—'}</p></div><div className="answer-rule"><b>Exam Trap</b><p>{a.examTrap || '—'}</p></div>
    <div><b>왜 이 선택지가 틀렸는가</b><div className="trap-list">{a.distractorAnalysis.length ? a.distractorAnalysis.map((trap, i) => <div key={`${trap.choice}-${i}`}><strong>{trap.choice} · {trap.concept}</strong><span>{trap.whyWrong}</span></div>) : <p className="muted">등록된 distractor 분석이 없습니다.</p>}</div></div>
    <div><b>Related Questions</b><div className="related-list">{related.length ? related.map(({ question: q, score }) => <button className="secondary" key={q.id} onClick={() => onOpen?.(q)}>Q{q.originalNumber ?? q.id} <small>score {score}</small></button>) : <p className="muted">관련 문제를 계산할 분석 데이터가 부족합니다.</p>}</div></div>
  </section>;
}
function AnalysisItem({ title, text }: { title: string; text: string }) { return <div><span>{title}</span><strong>{text || '—'}</strong></div>; }
function AnalysisList({ title, values, ordered }: { title: string; values: string[]; ordered?: boolean }) { const Tag = ordered ? 'ol' : 'ul'; return <div className="analysis-list"><b>{title}</b>{values.length ? <Tag>{values.map((value, i) => <li key={`${value}-${i}`}>{value}</li>)}</Tag> : <p className="muted">—</p>}</div>; }

export function StudyPage({ bank, stats, onStart }: { bank: QuestionBank; stats: BankStatistics; onStart: (questions: Question[]) => void }) {
  const [tab, setTab] = useState<'service' | 'pattern' | 'weak' | 'architecture'>('service'); const [selected, setSelected] = useState<Question>();
  const groups = useMemo(() => { const map = new Map<string, Question[]>(); for (const q of bank.questions) { const keys = tab === 'pattern' ? [q.analysis?.problemPattern] : tab === 'architecture' ? [q.analysis?.architecturePath.join(' → ')] : q.analysis?.primaryServices; for (const key of keys ?? []) if (key) map.set(key, [...(map.get(key) ?? []), q]); } return [...map].sort(([a], [b]) => a.localeCompare(b)); }, [bank.questions, tab]);
  const weak = Object.entries(stats.conceptMastery ?? {}).sort(([, a], [, b]) => a.percentage - b.percentage);
  return <section><div className="title-row"><div><h1>Study</h1><p className="muted">분석 메타데이터를 기반으로 개념과 해결 패턴을 학습합니다.</p></div><span className="analysis-coverage">분석 완료 {bank.questions.filter((q) => q.analysis).length}/{bank.questions.length}</span></div>
    <div className="tabs"><button className={tab === 'service' ? 'active' : ''} onClick={() => setTab('service')}>By AWS Service</button><button className={tab === 'pattern' ? 'active' : ''} onClick={() => setTab('pattern')}>By Exam Pattern</button><button className={tab === 'weak' ? 'active' : ''} onClick={() => setTab('weak')}>Weak Concepts</button><button className={tab === 'architecture' ? 'active' : ''} onClick={() => setTab('architecture')}>Architecture</button></div>
    {tab === 'weak' ? <div className="group-list">{weak.length ? weak.map(([name, value]) => <div className="group-card" key={name}><div><strong>{name}</strong><span>{value.correct}/{value.attempts} correct</span></div><b className={value.percentage < 60 ? 'warning' : 'ok'}>{value.percentage}%</b><button onClick={() => onStart(bank.questions.filter((q) => q.analysis?.concept === name))}>Focus Review</button></div>) : <div className="empty compact"><h2>아직 학습 기록이 없습니다</h2><p>분석된 문제를 풀면 취약 개념이 여기에 표시됩니다.</p></div>}</div> : <div className="group-list">{groups.length ? groups.map(([name, questions]) => <div className="group-card" key={name}><div><strong>{name}</strong><span>{questions.length} questions</span></div><button className="secondary" onClick={() => setSelected(questions[0])}>분석 보기</button><button onClick={() => onStart(questions)}>학습 시작</button></div>) : <div className="empty compact"><h2>분석 데이터가 없습니다</h2><p>기존 문제는 그대로 사용할 수 있으며, analysis가 추가되면 자동 그룹이 생성됩니다.</p></div>}</div>}
    {selected && <div className="study-detail"><button className="link" onClick={() => setSelected(undefined)}>닫기</button><StudyAnalysis question={selected} bank={bank} onOpen={setSelected} /><h2>Question {selected.originalNumber ?? selected.id}</h2><p>{selected.question}</p></div>}
  </section>;
}

export function StatsPage({ bank, stats, history, onStart }: { bank: QuestionBank; stats: BankStatistics; history: WrongReviewItem[]; onStart: (questions: Question[]) => void }) {
  const concepts = Object.entries(stats.conceptMastery ?? {}).sort(([, a], [, b]) => a.percentage - b.percentage); const unresolved = history.filter((x) => !x.resolved).length;
  return <section><div className="title-row"><div><h1>Stats</h1><p className="muted">오답 이력은 해결 후에도 보존됩니다.</p></div></div><div className="metrics"><Metric label="오답 경험 문제" value={history.length} /><Metric label="미해결" value={unresolved} /><Metric label="해결" value={history.length - unresolved} /><Metric label="총 오답 횟수" value={history.reduce((n, x) => n + x.wrongCount, 0)} /></div>
    <h2>Concept Mastery</h2><div className="mastery-list">{concepts.length ? concepts.map(([name, value]) => <div key={name}><div><strong>{name}</strong><span>{value.percentage}% · {value.correct}/{value.attempts}</span></div><progress max="100" value={value.percentage} /><button onClick={() => onStart(bank.questions.filter((q) => q.analysis?.concept === name))}>Start Focus Review</button></div>) : <div className="empty compact"><p>개념별 채점 기록이 아직 없습니다.</p></div>}</div>
    <h2>Wrong History</h2><div className="history-table">{history.map((item) => <div key={item.questionId}><span>Q{bank.questions.find((q) => q.id === item.questionId)?.originalNumber ?? item.questionId}</span><span>{item.concept ?? '분석 없음'}</span><span>오답 {item.wrongCount}회</span><span>시도 {item.retryCount}회</span><b className={item.resolved ? 'ok' : 'warning'}>{item.resolved ? 'Resolved' : 'Unresolved'}</b></div>)}</div>
  </section>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }

export function AnalysisControls({ bank, onUpdated }: { bank: QuestionBank; onUpdated: (bank: QuestionBank) => void }) {
  const [progress, setProgress] = useState<AnalysisProgress>(); const [running, setRunning] = useState(false); const failed = bank.questions.filter((q) => q.analysisStatus === 'failed').length; const endpoint = import.meta.env.VITE_DVA_ANALYSIS_ENDPOINT as string | undefined;
  const run = async (onlyFailed: boolean) => { if (!endpoint) { alert('VITE_DVA_ANALYSIS_ENDPOINT를 설정해 주세요. 분석 API는 { question, choices, correctAnswers, originalExplanation }을 받아 { analysis }을 반환해야 합니다.'); return; } setRunning(true); try { const updated = await analyzeDvaBank(bank, createEndpointAnalyzer(endpoint), async (nextProgress, nextBank) => { setProgress(nextProgress); await db.saveBank(nextBank); onUpdated(nextBank); }, onlyFailed); onUpdated(updated); } finally { setRunning(false); } };
  const complete = bank.questions.filter((q) => q.analysisStatus === 'completed' || q.analysis).length;
  return <div className="analysis-controls"><div><strong>DVA AI Analysis</strong><span>{complete}/{bank.questions.length} analyzed{failed ? ` · ${failed} failed` : ''}</span></div>{progress && <div className="analysis-progress"><progress max={Math.max(progress.total, 1)} value={progress.completed + progress.failed} /><span>{progress.completed + progress.failed} / {progress.total} · 실패 {progress.failed}</span></div>}<button disabled={running || complete === bank.questions.length} onClick={() => void run(false)}>{running ? 'Analyzing…' : 'Analyze DVA Questions'}</button>{failed > 0 && <button className="secondary" disabled={running} onClick={() => void run(true)}>실패 {failed}개 재시도</button>}</div>;
}

export function WrongPage({ bank, history, wrongIds, onStart }: { bank: QuestionBank; history: WrongReviewItem[]; wrongIds: string[]; onStart: (questions: Question[]) => void }) {
  const [tab, setTab] = useState<'unresolved' | 'resolved' | 'history'>('unresolved'); const [filter, setFilter] = useState(''); const rows = history.filter((item) => tab === 'history' || item.resolved === (tab === 'resolved')).filter((item) => !filter || [item.concept, item.pattern, ...((bank.questions.find((q) => q.id === item.questionId)?.analysis?.primaryServices) ?? [])].some((value) => value?.toLowerCase().includes(filter.toLowerCase()))); const allWrongQuestions = questionsForWrongQueue(bank.questions, wrongIds);
  return <section><div className="title-row"><div><h1>Wrong Review</h1><p className="muted">해결된 문제도 기록에서 삭제되지 않습니다.</p></div>{tab === 'unresolved' && <button disabled={!allWrongQuestions.length} onClick={() => onStart(allWrongQuestions)}>전체 오답 {allWrongQuestions.length}개 복습 시작</button>}</div><div className="tabs"><button className={tab === 'unresolved' ? 'active' : ''} onClick={() => setTab('unresolved')}>Unresolved</button><button className={tab === 'resolved' ? 'active' : ''} onClick={() => setTab('resolved')}>Resolved</button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>History</button></div><input className="study-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="AWS service, concept, pattern으로 필터" />
    <div className="wrong-history-cards">{rows.map((item) => { const q = bank.questions.find((candidate) => candidate.id === item.questionId); if (!q) return null; return <article key={item.questionId}><div><span>Q{q.originalNumber ?? q.id}</span><b className={item.resolved ? 'ok' : 'warning'}>{item.resolved ? 'Resolved' : 'Unresolved'}</b></div><h3>{q.question}</h3><p>{item.concept ?? 'Not analyzed'} · {item.pattern ?? 'Not analyzed'}</p><small>오답 {item.wrongCount}회 · 복습 시도 {item.retryCount}회 · 최근 {new Date(item.lastReviewedAt).toLocaleDateString()}</small>{!item.resolved && <button onClick={() => onStart([q])}>이 문제 다시 풀기</button>}</article>; })}{!rows.length && <div className="empty compact"><p>이 조건에 해당하는 오답 기록이 없습니다.</p></div>}</div>
  </section>;
}
