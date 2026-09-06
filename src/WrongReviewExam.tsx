import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from './lib/db';
import { answerIsCorrect } from './lib/exam';
import { advanceWrongReviewQueue } from './lib/wrongReview';
import { recordWrongAttempt, relatedQuestionScores, updateMastery } from './lib/study';
import { StudyAnalysis } from './StudyViews';
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
  finished: boolean;
  remaining: number;
}

export default function WrongReviewExam({
  bank,
  initial,
  onAttachPdf,
  onExit,
}: WrongReviewExamProps) {
  const [current, setCurrent] = useState(initial);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(
    () => initial.updatedAt ? new Date(initial.updatedAt) : null,
  );
  const [saving, setSaving] = useState(false);
  const [adaptive, setAdaptive] = useState(true);

  const currentRef = useRef(initial);
  const writeQueue = useRef(Promise.resolve());

  const questionMap = useMemo(
    () => new Map(bank.questions.map((q) => [q.id, q])),
    [bank.questions],
  );

  const queuedQuestions = useMemo(
    () =>
      current.questionIds
        .map((id) => questionMap.get(id))
        .filter((q): q is Question => !!q),
    [current.questionIds, questionMap],
  );

  const liveQuestion = queuedQuestions[current.currentIndex];

  // 채점 직후 큐에서 문제가 빠져도 결과/해설 화면을 유지하기 위해
  // feedback에 당시 문제를 보관합니다.
  const question = feedback?.question ?? liveQuestion;

  const saveSession = async (next: ExamSession) => {
    const saved = {
      ...next,
      updatedAt: new Date().toISOString(),
    };

    currentRef.current = saved;
    setCurrent(saved);
    setSaving(true);

    writeQueue.current = writeQueue.current.then(() =>
      db.saveSession(saved).then(() => undefined),
    );

    await writeQueue.current;

    if (currentRef.current.updatedAt === saved.updatedAt) {
      setSavedAt(new Date(saved.updatedAt));
      setSaving(false);
    }

    return saved;
  };

  const saveCheckpoint = async () => saveSession(currentRef.current);

  const toggleAnswer = (key: string) => {
    if (!liveQuestion || feedback) return;

    const base = currentRef.current;
    const previous = base.answers[liveQuestion.id] ?? [];
    const multiple = liveQuestion.correctAnswers.length > 1;

    const selected = multiple
      ? previous.includes(key)
        ? previous.filter((value) => value !== key)
        : [...previous, key]
      : [key];

    void saveSession({
      ...base,
      answers: {
        ...base.answers,
        [liveQuestion.id]: selected,
      },
    });
  };

  const checkAnswer = async () => {
    if (!liveQuestion || feedback) return;

    const base = currentRef.current;
    const selected = base.answers[liveQuestion.id] ?? [];

    if (!selected.length) {
      alert('답을 선택한 뒤 정답 확인을 눌러 주세요.');
      return;
    }

    const correct = answerIsCorrect(
      selected,
      liveQuestion.correctAnswers,
    );

    // 맞으면 큐에서 제거
    // 틀리면 현재 자리에서 제거한 뒤 맨 뒤에 다시 추가
    let transition = advanceWrongReviewQueue(
      base.questionIds,
      base.currentIndex,
      liveQuestion.id,
      correct,
    );
    if (!correct && adaptive) {
      const relatedIds = relatedQuestionScores(liveQuestion, bank.questions).slice(0, 2).map(({ question: related }) => related.id).filter((id) => !transition.questionIds.includes(id));
      if (relatedIds.length) { const originalIndex = transition.questionIds.lastIndexOf(liveQuestion.id); const questionIds = [...transition.questionIds]; questionIds.splice(Math.max(0, originalIndex), 0, ...relatedIds); transition = { ...transition, questionIds }; }
    }

    // 다음에 재출제될 때는 답을 새로 고르도록 기존 답안 제거
    const answers = { ...base.answers };
    delete answers[liveQuestion.id];

    const nextSession: ExamSession = {
      ...base,
      questionIds: transition.questionIds,
      currentIndex: transition.currentIndex,
      answers,
      status: transition.finished ? 'submitted' : 'active',
    };

    const storedWrong = new Set(
      (await db.wrong(bank.id))?.questionIds ?? [],
    );
    const [history, storedStats] = await Promise.all([db.wrongHistory(bank.id), db.stats(bank.id)]);
    const historyItem = recordWrongAttempt(history.find((item) => item.questionId === liveQuestion.id), bank.id, liveQuestion, selected, correct);
    const nextStats = updateMastery(storedStats ?? { bankId: bank.id, completedQuestionIds: [], completedCycles: [] }, liveQuestion, correct);

    if (correct) storedWrong.delete(liveQuestion.id);
    else storedWrong.add(liveQuestion.id);

    await Promise.all([
      saveSession(nextSession),
      db.saveWrong({
        bankId: bank.id,
        questionIds: [...storedWrong],
      }),
      db.saveWrongHistory(historyItem),
      db.saveStats(nextStats),
    ]);

    // 여기서 다음 문제로 자동 이동하지 않습니다.
    // 반드시 결과 + 해설을 먼저 보여줍니다.
    setFeedback({
      question: liveQuestion,
      selected,
      correct,
      finished: transition.finished,
      remaining: transition.questionIds.length,
    });
  };

  const nextQuestion = () => {
    if (!feedback) return;

    const finished = feedback.finished;
    setFeedback(null);

    if (finished) {
      onExit();
    }
  };

  if (!question) {
    return (
      <main>
        <div className="result-hero">
          <span>오답노트 완료</span>
          <h1>모든 오답 해결</h1>
          <strong>현재 남아 있는 오답이 없습니다.</strong>
          <div className="result-actions">
            <button onClick={onExit}>대시보드</button>
          </div>
        </div>
      </main>
    );
  }

  const selected = feedback
    ? feedback.selected
    : (current.answers[question.id] ?? []);

  const multiple = question.correctAnswers.length > 1;
  const needsSource =
    !question.question.trim() || question.choices.length < 2;

  const displayChoices = question.choices.length
    ? question.choices
    : ['A', 'B', 'C', 'D'].map((key) => ({
        key,
        text: '원본 PDF의 선택지를 확인하세요.',
      }));

  return (
    <div className="exam-shell">
      <header className="exam-header">
        <div>
          <strong>오답노트</strong>
          <span>
            {feedback
              ? feedback.correct
                ? `정답 · 남은 오답 ${feedback.remaining}개`
                : `오답 · 맨 뒤로 이동 · 남은 큐 ${feedback.remaining}개`
              : `현재 오답 큐 ${current.questionIds.length}개`}
          </span>
        </div>

        <div className="save-controls">
          <span>
            {saving
              ? '저장 중…'
              : savedAt
                ? `${savedAt.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} 저장됨`
                : '자동 저장 켜짐'}
          </span>

          <button
            className="secondary"
            disabled={saving}
            onClick={() => void saveCheckpoint()}
          >
            중간 저장
          </button>

          <button
            className="secondary exit-button"
            onClick={() => {
              if (
                confirm(
                  '현재 오답 큐를 저장하고 대시보드로 나갈까요?',
                )
              ) {
                void saveCheckpoint().then(onExit);
              }
            }}
          >
            나가기
          </button>
        </div>
      </header>

      <div className="progress">
        <span
          style={{
            width: feedback ? '100%' : '50%',
          }}
        />
      </div>

      <main className="exam-main">
        <aside className="navigator">
          <b>오답 큐</b>

          <div className="wrong-queue-count">
            {current.questionIds.length}
          </div>

          <small className="wrong-queue-help">
            답 선택
            <br />
            ↓
            <br />
            정답 확인
            <br />
            ↓
            <br />
            해설 확인
            <br />
            ↓
            <br />
            다음 문제
          </small>
          <label className="adaptive-toggle"><input type="checkbox" checked={adaptive} onChange={(event) => setAdaptive(event.target.checked)} /> Adaptive Review</label><small>{adaptive ? '관련 문제 후 원래 문제 재출제' : 'Same Question Only'}</small>
        </aside>

        <article className="question-panel">
          <span className="question-number">
            Question {question.originalNumber ?? 1}
            {multiple && ' · 복수 선택'}
          </span>

          <h2>
            {question.question ||
              '원본 PDF에서 문제를 확인하세요.'}
          </h2>

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
              <strong>
                이 문제의 이미지·코드·선택지가 PDF에만 있습니다.
              </strong>
              <span>
                진행 기록을 유지한 채 지금 원본을 연결하세요.
              </span>

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
              const checked = selected.includes(choice.key);

              const isCorrectChoice =
                !!feedback &&
                question.correctAnswers.includes(choice.key);

              const isWrongSelected =
                !!feedback &&
                checked &&
                !question.correctAnswers.includes(choice.key);

              return (
                <label
                  key={choice.key}
                  className={[
                    checked ? 'selected' : '',
                    isCorrectChoice ? 'answer-correct' : '',
                    isWrongSelected ? 'answer-wrong' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <input
                    type={multiple ? 'checkbox' : 'radio'}
                    name={question.id}
                    checked={checked}
                    disabled={!!feedback}
                    onChange={() => toggleAnswer(choice.key)}
                  />

                  <b>{choice.key}</b>
                  <span>{choice.text}</span>
                </label>
              );
            })}
          </div>

          {!feedback && (
            <div className="exam-actions wrong-check-actions">
              <button
                className="finish wrong-check-button"
                disabled={!selected.length}
                onClick={() => void checkAnswer()}
              >
                정답 확인
              </button>
            </div>
          )}

          {feedback && (
            <section
              className={`instant-feedback ${
                feedback.correct
                  ? 'instant-feedback-correct'
                  : 'instant-feedback-wrong'
              }`}
            >
              <div className="instant-feedback-title">
                {feedback.correct
                  ? '✓ 정답입니다'
                  : '✕ 오답입니다'}
              </div>

              <div className="instant-answer-grid">
                <div>
                  <span>내 답</span>
                  <strong>
                    {feedback.selected.join(', ') || '—'}
                  </strong>
                </div>

                <div>
                  <span>정답</span>
                  <strong>
                    {question.correctAnswers.join(', ') ||
                      '정답 파싱 안 됨'}
                  </strong>
                </div>
              </div>

              <div className="instant-explanation">
                <span>해설</span>

                {question.explanation?.trim() ? (
                  <p>{question.explanation}</p>
                ) : (
                  <p className="muted">
                    이 문제에는 저장된 해설이 없습니다.
                  </p>
                )}
              </div>

              <StudyAnalysis question={question} bank={bank} />

              {!feedback.correct && (
                <div className="requeue-notice">
                  ↻ 이 문제는 오답 큐 맨 뒤로 이동했습니다.
                  한 바퀴 뒤에 다시 출제됩니다.
                </div>
              )}

              {!feedback.correct && relatedQuestionScores(question, bank.questions).length > 0 && <div className="requeue-notice">같은 개념의 관련 문제 {relatedQuestionScores(question, bank.questions).slice(0, 3).map(({ question: q }) => `Q${q.originalNumber ?? q.id}`).join(', ')}를 Study에서 함께 복습할 수 있습니다.</div>}

              <div className="exam-actions wrong-next-actions">
                <button
                  className="finish"
                  onClick={nextQuestion}
                >
                  {feedback.finished
                    ? '오답노트 완료 → 대시보드'
                    : '다음 문제'}
                </button>
              </div>
            </section>
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
      .then(({ renderQuestionPages }) =>
        renderQuestionPages(pdf, pages, questionNumber),
      )
      .then((rendered) => {
        if (!cancelled) setImages(rendered);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            '정답을 제외한 문제 영역을 찾지 못했습니다.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, images.length, pages, pdf, questionNumber]);

  return (
    <div className="source-pages">
      <button
        className="secondary"
        onClick={() => setOpen((value) => !value)}
      >
        {open
          ? '문제 원본 닫기'
          : `문제 원본 보기 · 정답 제외 (${pages
              .map((page) => `p.${page}`)
              .join(', ')})`}
      </button>

      {open && (
        <div>
          {loadError ? (
            <p className="error">{loadError}</p>
          ) : images.length ? (
            images.map((src, index) => (
              <img
                key={pages[index]}
                src={src}
                alt={`PDF 문제 영역 ${pages[index]}페이지`}
              />
            ))
          ) : (
            <p className="muted">
              정답을 제외한 문제 영역 렌더링 중…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
