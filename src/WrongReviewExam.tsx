import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from './lib/db';
import { answerIsCorrect } from './lib/exam';
import { advanceWrongReviewQueue } from './lib/wrongReview';
import type { ExamSession, Question, QuestionBank } from './types';

interface WrongReviewExamProps {
  bank: QuestionBank;
  initial: ExamSession;
  onAttachPdf: (file: File) => void;
  onExit: () => void;
}

interface Feedback {
  question: Question;
  selected: string[];
  correct: boolean;
  requeued: boolean;
  finished: boolean;
  remaining: number;
}

export default function WrongReviewExam({ bank, initial, onAttachPdf, onExit }: WrongReviewExamProps) {
  const [current, setCurrent] = useState(initial);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(() => initial.updatedAt ? new Date(initial.updatedAt) : null);
  const [saving, setSaving] = useState(false);
  const currentRef = useRef(initial);
  const writeQueue = useRef(Promise.resolve());

  const questionMap = useMemo(() => new Map(bank.questions.map((q) => [q.id, q])), [bank.questions]);
  const queuedQuestions = useMemo(
    () => current.questionIds.map((id) => questionMap.get(id)).filter((q): q is Question => !!q),
    [current.questionIds, questionMap],
  );

  const liveQuestion = queuedQuestions[current.currentIndex];
  const question = feedback?.question ?? liveQuestion;

  const saveSession = async (next: ExamSession) => {
    const saved = { ...next, updatedAt: new Date().toISOString() };
    currentRef.current = saved;
    setCurrent(saved);
    setSaving(true);

    writeQueue.current = writeQueue.current.then(() => db.saveSession(saved).then(() => undefined));
    await writeQueue.current;

    if (currentRef.current.updatedAt === saved.updatedAt) {
      setSavedAt(new Date(saved.updatedAt));
      setSaving(false);
    }

    return saved;
  };

  const saveCheckpoint = async () => saveSession(currentRef.current);

  const gradeWrongQuestion = async (selected: string[]) => {
    if (!liveQuestion || feedback || !selected.length) return;

    const correct = answerIsCorrect(selected, liveQuestion.correctAnswers);
    const base = currentRef.current;
    const transition = advanceWrongReviewQueue(
      base.questionIds,
      base.currentIndex,
      liveQuestion.id,
      correct,
    );

    const answers = { ...base.answers };
    delete answers[liveQuestion.id];

    const nextSession: ExamSession = {
      ...base,
      questionIds: transition.questionIds,
      currentIndex: transition.currentIndex,
      answers,
      status: transition.finished ? 'submitted' : 'active',
    };

    const storedWrong = new Set((await db.wrong(bank.id))?.questionIds ?? []);
    if (correct) storedWrong.delete(liveQuestion.id);
    else storedWrong.add(liveQuestion.id);

    await Promise.all([
      saveSession(nextSession),
      db.saveWrong({ bankId: bank.id, questionIds: [...storedWrong] }),
    ]);

    setFeedback({
      question: liveQuestion,
      selected,
      correct,
      requeued: !correct,
      finished: transition.finished,
      remaining: transition.questionIds.length,
    });
  };

  const select = (key: string) => {
    if (!liveQuestion || feedback) return;

    const base = currentRef.current;
    const old = base.answers[liveQuestion.id] ?? [];
    const multiple = liveQuestion.correctAnswers.length > 1;
    const selected = multiple
      ? (old.includes(key) ? old.filter((v) => v !== key) : [...old, key])
      : [key];

    if (multiple) {
      void saveSession({ ...base, answers: { ...base.answers, [liveQuestion.id]: selected } });
    } else {
      void gradeWrongQuestion(selected);
    }
  };

  const continueReview = () => {
    if (!feedback) return;
    const finished = feedback.finished;
    setFeedback(null);
    if (finished) onExit();
  };

  if (!question) {
    return (
      <main>
        <div className="result-hero">
          <span>오답노트 완료</span>
          <h1>0 Questions</h1>
          <strong>현재 남아 있는 오답이 없습니다.</strong>
          <div className="result-actions"><button onClick={onExit}>대시보드</button></div>
        </div>
      </main>
    );
  }

  const needsSource = !question.question.trim() || question.choices.length < 2;
  const displayChoices = question.choices.length
    ? question.choices
    : ['A', 'B', 'C', 'D'].map((key) => ({ key, text: '원본 PDF의 선택지를 확인하세요.' }));

  const displaySelected = feedback?.question.id === question.id
    ? feedback.selected
    : (current.answers[question.id] ?? []);

  const multiple = question.correctAnswers.length > 1;
  const canGradeMultiple = multiple && displaySelected.length > 0 && !feedback;

  return (
    <div className="exam-shell">
      <header className="exam-header">
        <div>
          <strong>오답노트</strong>
          <span>
            {feedback
              ? feedback.correct
                ? `정답 · 남은 오답 ${feedback.remaining}개`
                : `오답 · 맨 뒤로 이동 · 현재 큐 ${feedback.remaining}개`
              : `현재 오답 큐 ${current.questionIds.length}개`}
          </span>
        </div>
        <div className="save-controls">
          <span>
            {saving
              ? '저장 중…'
              : savedAt
                ? `${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 저장됨`
                : '자동 저장 켜짐'}
          </span>
          <button className="secondary" disabled={saving} onClick={() => void saveCheckpoint()}>중간 저장</button>
          <button
            className="secondary exit-button"
            onClick={() => {
              if (confirm('현재 오답 큐를 저장하고 대시보드로 나갈까요?')) {
                void saveCheckpoint().then(onExit);
              }
            }}
          >
            나가기
          </button>
        </div>
      </header>

      <div className="progress">
        <span style={{ width: feedback ? '100%' : `${current.questionIds.length ? 100 / current.questionIds.length : 100}%` }} />
      </div>

      <main className="exam-main">
        <aside className="navigator">
          <b>오답 큐</b>
          <div style={{ marginTop: 14, fontSize: 34, fontWeight: 800 }}>{current.questionIds.length}</div>
          <small style={{ display: 'block', marginTop: 8, lineHeight: 1.6 }}>
            맞히면 큐에서 제거<br />
            틀리면 맨 뒤로 이동
          </small>
        </aside>

        <article className="question-panel">
          <span className="question-number">
            Question {question.originalNumber ?? 1}
            {multiple && ' · 복수 선택'}
          </span>
          <h2>{question.question || '원본 PDF에서 문제를 확인하세요.'}</h2>

          {bank.sourcePdf ? (
            <ReviewSourcePages
              key={question.id}
              pdf={bank.sourcePdf}
              pages={question.sourcePages}
              questionNumber={question.originalNumber}
              initialOpen={needsSource}
            />
          ) : (
            <div className="source-unavailable">
              <strong>이 문제의 이미지·코드·선택지가 PDF에만 있습니다.</strong>
              <span>진행 기록을 유지한 채 지금 원본을 연결하세요.</span>
              <label className="button-label">
                원본 PDF 연결
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void onAttachPdf(file);
                  }}
                />
              </label>
            </div>
          )}

          <div className="choices">
            {displayChoices.map((choice) => {
              const checked = displaySelected.includes(choice.key);
              const correctChoice = !!feedback && question.correctAnswers.includes(choice.key);
              const wrongSelected = !!feedback && checked && !question.correctAnswers.includes(choice.key);

              return (
                <label
                  className={checked ? 'selected' : ''}
                  key={choice.key}
                  style={feedback ? {
                    borderColor: correctChoice ? '#2f9e44' : wrongSelected ? '#e03131' : undefined,
                    background: correctChoice ? '#ebfbee' : wrongSelected ? '#fff5f5' : undefined,
                    opacity: !correctChoice && !checked ? 0.68 : 1,
                  } : undefined}
                >
                  <input
                    type={multiple ? 'checkbox' : 'radio'}
                    name={question.id}
                    checked={checked}
                    disabled={!!feedback}
                    onChange={() => select(choice.key)}
                  />
                  <b>{choice.key}</b>
                  <span>{choice.text}</span>
                </label>
              );
            })}
          </div>

          {multiple && !feedback && (
            <div className="exam-actions" style={{ justifyContent: 'flex-end' }}>
              <button
                className="finish"
                disabled={!canGradeMultiple}
                onClick={() => void gradeWrongQuestion(displaySelected)}
              >
                정답 확인
              </button>
            </div>
          )}

          {feedback && (
            <div
              style={{
                marginTop: 24,
                padding: 20,
                borderRadius: 14,
                border: `1px solid ${feedback.correct ? '#8ce99a' : '#ffa8a8'}`,
                background: feedback.correct ? '#ebfbee' : '#fff5f5',
              }}
            >
              <strong style={{ display: 'block', fontSize: 20, color: feedback.correct ? '#2b8a3e' : '#c92a2a' }}>
                {feedback.correct ? '✓ 정답입니다.' : '✕ 오답입니다.'}
              </strong>

              {!feedback.correct && (
                <p style={{ marginBottom: 8, color: '#c92a2a', fontWeight: 700 }}>
                  이 문제는 오답 큐 맨 뒤로 이동했습니다. 한 바퀴 뒤에 다시 풀 수 있습니다.
                </p>
              )}

              <p>
                <b>내 답:</b> {feedback.selected.join(', ') || '—'}<br />
                <b>정답:</b> {question.correctAnswers.join(', ') || '파싱되지 않음'}
              </p>

              {question.explanation && (
                <p>
                  <b>해설</b><br />
                  {question.explanation}
                </p>
              )}

              <div className="exam-actions" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <button onClick={continueReview}>
                  {feedback.finished ? '오답노트 완료 → 대시보드' : '다음 문제'}
                </button>
              </div>
            </div>
          )}
        </article>
      </main>
    </div>
  );
}

function ReviewSourcePages({
  pdf,
  pages,
  questionNumber,
  initialOpen = false,
}: {
  pdf: Blob;
  pages: number[];
  questionNumber?: number;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [images, setImages] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!open || images.length) return;
    let cancelled = false;

    if (questionNumber == null) {
      setLoadError('원본 문제 번호를 찾지 못했습니다.');
      return;
    }

    void import('./lib/pdf/renderPdfPages')
      .then(({ renderQuestionPages }) => renderQuestionPages(pdf, pages, questionNumber))
      .then((rendered) => {
        if (!cancelled) setImages(rendered);
      })
      .catch(() => {
        if (!cancelled) setLoadError('정답을 제외한 문제 영역을 찾지 못했습니다.');
      });

    return () => {
      cancelled = true;
    };
  }, [open, images.length, pages, pdf, questionNumber]);

  return (
    <div className="source-pages">
      <button className="secondary" onClick={() => setOpen((value) => !value)}>
        {open ? '문제 원본 닫기' : `문제 원본 보기 · 정답 제외 (${pages.map((page) => `p.${page}`).join(', ')})`}
      </button>

      {open && (
        <div>
          {loadError ? (
            <p className="error">{loadError}</p>
          ) : images.length ? (
            images.map((src, index) => <img key={pages[index]} src={src} alt={`PDF 문제 영역 ${pages[index]}페이지`} />)
          ) : (
            <p className="muted">정답을 제외한 문제 영역 렌더링 중…</p>
          )}
        </div>
      )}
    </div>
  );
}
