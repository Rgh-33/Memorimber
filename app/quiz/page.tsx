"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Camera, ChevronRight, History, Infinity as InfinityIcon, Sparkles, Type } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { QuizQuestionCard } from "@/components/quiz-question-card";
import { useMemories } from "@/lib/memories-context";
import {
  ALL_QUIZ_KINDS,
  QUIZ_KIND_LABELS,
  QUIZ_MODE_LABELS,
  answerLabel,
  createMixedQuizQuestions,
  createQuizQuestions,
  toHistoryQuestion,
  type QuizAnswer,
  type QuizHistoryEntry,
  type QuizMode,
  type MemoryQuizQuestion,
} from "@/lib/quiz";

const HISTORY_KEY = "memorimber-quiz-history-v1";
const PHOTO_TO_CAPTION_COUNT_KEY = "memorimber-quiz-photo-to-caption-count";
const CAPTION_TO_PHOTO_COUNT_KEY = "memorimber-quiz-caption-to-photo-count";
const DEFAULT_DIRECTION_COUNT = 5;
const MAX_DIRECTION_COUNT = 50;

type ActiveQuiz = {
  mode: QuizMode;
  questions: MemoryQuizQuestion[];
  endless: boolean;
};

function readCount(key: string) {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return DEFAULT_DIRECTION_COUNT;
    const value = Number(stored);
    return Number.isInteger(value) && value >= 0 && value <= MAX_DIRECTION_COUNT ? value : DEFAULT_DIRECTION_COUNT;
  } catch {
    return DEFAULT_DIRECTION_COUNT;
  }
}

function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(value) ? value.slice(0, 30) as QuizHistoryEntry[] : [];
  } catch {
    return [];
  }
}

function scoreOf(answers: { correct: boolean }[]) {
  const correct = answers.filter((answer) => answer.correct).length;
  return { correct, rate: answers.length ? Math.round(correct / answers.length * 100) : 0 };
}

function CountPicker({ value, onChange, storageKey }: { value: number; onChange: (value: number) => void; storageKey: string }) {
  const update = (next: number) => {
    const valueToSave = Math.max(0, Math.min(MAX_DIRECTION_COUNT, next));
    onChange(valueToSave);
    try { localStorage.setItem(storageKey, String(valueToSave)); } catch { /* Keep the setting for this visit. */ }
  };
  return (
    <div className="quiz-count-picker" aria-label={`問題数：${value}問`}>
      <button type="button" onClick={() => update(value - 1)} disabled={value <= 0} aria-label="問題数を1問減らす">−</button>
      <span><strong>{value}</strong>問</span>
      <button type="button" onClick={() => update(value + 1)} disabled={value >= MAX_DIRECTION_COUNT} aria-label="問題数を1問増やす">＋</button>
    </div>
  );
}

function ModeMenu({ memoryCount, onStart, onMixedSetup, onHistory }: {
  memoryCount: number;
  onStart: (mode: "quick" | "endless", count: number) => void;
  onMixedSetup: () => void;
  onHistory: () => void;
}) {
  const disabled = memoryCount === 0;
  return (
    <>
      <section className="quiz-page-heading">
        <p>MEMORY QUIZ</p>
        <h1>思い出クイズ</h1>
        <span>写真と一言から、あの日を思い出そう。</span>
      </section>

      <section className="quiz-mode-list" aria-label="クイズモードを選ぶ">
        <button type="button" className="quiz-mode-featured" onClick={() => onStart("quick", 10)} disabled={disabled}>
          <span className="quiz-mode-featured-icon"><Sparkles size={22} /></span>
          <span className="quiz-mode-copy">
            <strong>10問クイズ</strong>
            <span>ランダムで10問出題</span>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>

        <button type="button" className="quiz-mode-mixed" onClick={onMixedSetup} disabled={disabled}>
          <span className="quiz-mode-mixed-icon" aria-hidden="true"><Camera size={17} /><Type size={17} /></span>
          <span>
            <strong>写真と一言クイズ</strong>
            <small>2つの出題数を決めて挑戦</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>

        <button type="button" className="quiz-mode-endless" onClick={() => onStart("endless", 1)} disabled={disabled}>
          <span><InfinityIcon size={21} /></span>
          <span><strong>総集クイズ</strong><small>任意のタイミングで終了できます</small></span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </section>

      {disabled && <p className="quiz-empty-message">思い出を1枚追加すると、クイズに挑戦できます。</p>}

      <button type="button" className="quiz-history-link" onClick={onHistory}>
        <History size={15} /> 過去の成績を見る
      </button>
    </>
  );
}

function MixedQuizSetup({ photoCount, captionCount, onPhotoCount, onCaptionCount, onBack, onStart }: {
  photoCount: number;
  captionCount: number;
  onPhotoCount: (value: number) => void;
  onCaptionCount: (value: number) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const total = photoCount + captionCount;
  return (
    <section className="quiz-mixed-setup">
      <header className="quiz-subpage-header">
        <button type="button" onClick={onBack} aria-label="モード選択に戻る"><ArrowLeft size={19} /></button>
        <h1>写真と一言クイズ</h1>
        <span />
      </header>

      <div className="quiz-setup-heading">
        <p>QUESTION MIX</p>
        <h2>出題の内訳</h2>
        <span>2つの形式をランダムな順番で出題します。</span>
      </div>

      <div className="quiz-setup-card">
        <div className="quiz-setup-row">
          <span className="quiz-setup-icon"><Camera size={18} /></span>
          <span className="quiz-setup-copy"><strong>写真から一言</strong><small>モザイク写真に合う一言を選ぶ</small></span>
          <CountPicker value={photoCount} onChange={onPhotoCount} storageKey={PHOTO_TO_CAPTION_COUNT_KEY} />
        </div>
        <div className="quiz-setup-row">
          <span className="quiz-setup-icon"><Type size={18} /></span>
          <span className="quiz-setup-copy"><strong>一言から写真</strong><small>一言に合うモザイク写真を選ぶ</small></span>
          <CountPicker value={captionCount} onChange={onCaptionCount} storageKey={CAPTION_TO_PHOTO_COUNT_KEY} />
        </div>
      </div>

      <div className="quiz-setup-summary">
        <span>合計</span>
        <strong>{total}問</strong>
      </div>
      <button type="button" className="quiz-primary-button" onClick={onStart} disabled={total === 0}>
        始める
      </button>
    </section>
  );
}

function QuizResults({ mode, answers, onClose }: { mode: QuizMode; answers: QuizAnswer[]; onClose: () => void }) {
  const score = scoreOf(answers);
  return (
    <section className="quiz-results" aria-labelledby="quiz-result-title">
      <p className="quiz-results-eyebrow">RESULT</p>
      <h1 id="quiz-result-title">今回の成績</h1>
      <div className="quiz-score-ring" style={{ "--quiz-score": `${score.rate * 3.6}deg` } as CSSProperties}>
        <div><strong>{score.rate}</strong><span>%</span></div>
      </div>
      <p className="quiz-score-copy">{answers.length}問中 <strong>{score.correct}問</strong> 正解</p>
      <p className="quiz-score-mode">{QUIZ_MODE_LABELS[mode]}</p>

      <ol className="quiz-result-list">
        {answers.map((answer, index) => (
          <li key={answer.question.id} data-correct={answer.correct || undefined}>
            <span className="quiz-result-number">問{index + 1}</span>
            <div>
              <small>{QUIZ_KIND_LABELS[answer.question.kind]}</small>
              <p>{answer.question.memory.caption}</p>
              {!answer.correct && <span>あなたの答え：{answer.selectedLabel}</span>}
            </div>
            <strong aria-label={answer.correct ? "正解" : "不正解"}>{answer.correct ? "○" : "×"}</strong>
          </li>
        ))}
      </ol>

      <button type="button" className="quiz-primary-button" onClick={onClose}>閉じる</button>
    </section>
  );
}

function QuizSession({ initial, memories, onComplete, onClose }: {
  initial: ActiveQuiz;
  memories: ReturnType<typeof useMemories>["memories"];
  onComplete: (mode: QuizMode, answers: QuizAnswer[]) => void;
  onClose: () => void;
}) {
  const [questions, setQuestions] = useState(initial.questions);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [finished, setFinished] = useState(false);
  const saved = useRef(false);
  const question = questions[index];

  const finish = () => {
    if (answers.length === 0) {
      onClose();
      return;
    }
    if (!saved.current) {
      saved.current = true;
      onComplete(initial.mode, answers);
    }
    setFinished(true);
  };

  if (finished) return <QuizResults mode={initial.mode} answers={answers} onClose={onClose} />;
  if (!question) return null;

  const confirm = () => {
    if (!selected || answered) return;
    const nextAnswer: QuizAnswer = {
      question,
      selectedChoiceId: selected,
      selectedLabel: answerLabel(question, selected),
      correct: selected === question.correctChoiceId,
    };
    setAnswers((current) => [...current, nextAnswer]);
    setAnswered(true);
  };

  const advance = () => {
    if (!answered) return;
    if (!initial.endless && index >= questions.length - 1) {
      if (!saved.current) {
        saved.current = true;
        onComplete(initial.mode, answers);
      }
      setFinished(true);
      return;
    }
    if (initial.endless && index >= questions.length - 1) {
      const next = createQuizQuestions(memories, 1, ALL_QUIZ_KINDS, Math.random, questions.slice(-Math.max(3, memories.length)));
      setQuestions((current) => [...current, ...next]);
    }
    setIndex((current) => current + 1);
    setSelected(null);
    setAnswered(false);
  };

  return (
    <section className="quiz-session" aria-label={QUIZ_MODE_LABELS[initial.mode]}>
      <header className="quiz-session-header">
        <button type="button" onClick={finish} aria-label="クイズを終了する"><ArrowLeft size={19} /></button>
        <div>
          <strong>{QUIZ_MODE_LABELS[initial.mode]}</strong>
          <span>{initial.endless ? `${index + 1}問目` : `${index + 1} / ${questions.length}`}</span>
        </div>
        <button type="button" className="quiz-finish-link" onClick={finish}>終了</button>
      </header>

      {!initial.endless && <div className="quiz-progress" aria-hidden="true"><span style={{ width: `${(index + (answered ? 1 : 0)) / questions.length * 100}%` }} /></div>}

      <QuizQuestionCard question={question} selectedChoiceId={selected} answered={answered} onSelect={setSelected} />

      {!answered ? (
        <button type="button" className="quiz-primary-button" onClick={confirm} disabled={!selected}>答えを確認</button>
      ) : (
        <button type="button" className="quiz-primary-button" onClick={advance}>
          {!initial.endless && index >= questions.length - 1 ? "結果を見る" : "次の問題へ"}
        </button>
      )}
    </section>
  );
}

function QuizHistory({ entries, onBack }: { entries: QuizHistoryEntry[]; onBack: () => void }) {
  return (
    <section className="quiz-history-page">
      <header className="quiz-subpage-header">
        <button type="button" onClick={onBack} aria-label="モード選択に戻る"><ArrowLeft size={19} /></button>
        <h1>過去の成績</h1>
        <span />
      </header>
      {entries.length === 0 ? (
        <div className="quiz-history-empty"><History size={26} /><p>まだ成績はありません。<br />クイズに挑戦すると、ここに残ります。</p></div>
      ) : (
        <div className="quiz-history-list">
          {entries.map((entry) => {
            const score = scoreOf(entry.answers);
            return (
              <details key={entry.id}>
                <summary>
                  <span><strong>{QUIZ_MODE_LABELS[entry.mode]}</strong><small>{new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.completedAt))}</small></span>
                  <span className="quiz-history-score"><strong>{score.rate}%</strong><small>{score.correct}/{entry.answers.length}問</small></span>
                </summary>
                <ol>
                  {entry.answers.map((answer, index) => (
                    <li key={`${entry.id}-${index}`} data-correct={answer.correct || undefined}>
                      <span>{index + 1}</span>
                      <div><small>{QUIZ_KIND_LABELS[answer.kind]}</small><p>{answer.memoryCaption}</p></div>
                      <strong>{answer.correct ? "○" : "×"}</strong>
                    </li>
                  ))}
                </ol>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function QuizPage() {
  const { memories, isLoading, error, refreshMemories } = useMemories();
  const [photoCount, setPhotoCount] = useState(DEFAULT_DIRECTION_COUNT);
  const [captionCount, setCaptionCount] = useState(DEFAULT_DIRECTION_COUNT);
  const [active, setActive] = useState<ActiveQuiz | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showMixedSetup, setShowMixedSetup] = useState(false);
  const [history, setHistory] = useState<QuizHistoryEntry[]>([]);

  useEffect(() => {
    setPhotoCount(readCount(PHOTO_TO_CAPTION_COUNT_KEY));
    setCaptionCount(readCount(CAPTION_TO_PHOTO_COUNT_KEY));
    setHistory(readHistory());
  }, []);

  const start = (mode: "quick" | "endless", count: number) => {
    const questionCount = mode === "endless" ? 1 : count;
    const questions = createQuizQuestions(memories, questionCount, ALL_QUIZ_KINDS);
    if (questions.length) setActive({ mode, questions, endless: mode === "endless" });
  };

  const startMixed = () => {
    const questions = createMixedQuizQuestions(memories, photoCount, captionCount);
    if (questions.length) {
      setShowMixedSetup(false);
      setActive({ mode: "mixed", questions, endless: false });
    }
  };

  const saveResult = useCallback((mode: QuizMode, answers: QuizAnswer[]) => {
    const entry: QuizHistoryEntry = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
      mode,
      completedAt: new Date().toISOString(),
      answers: answers.map(toHistoryQuestion),
    };
    setHistory((current) => {
      const next = [entry, ...current].slice(0, 30);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* Keep history for this visit. */ }
      return next;
    });
  }, []);

  if (isLoading) return <div className="page-pad"><AppHeader /><p role="status" className="quiz-loading">思い出を読み込んでいます…</p></div>;
  if (error) return <div className="page-pad"><AppHeader /><div role="alert" className="quiz-load-error">{error}<button type="button" onClick={() => void refreshMemories()}>再読み込み</button></div></div>;

  return (
    <div className="page-pad quiz-page">
      {!active && !showHistory && !showMixedSetup && <AppHeader />}
      {active ? (
        <QuizSession initial={active} memories={memories} onComplete={saveResult} onClose={() => setActive(null)} />
      ) : showHistory ? (
        <QuizHistory entries={history} onBack={() => setShowHistory(false)} />
      ) : showMixedSetup ? (
        <MixedQuizSetup
          photoCount={photoCount}
          captionCount={captionCount}
          onPhotoCount={setPhotoCount}
          onCaptionCount={setCaptionCount}
          onBack={() => setShowMixedSetup(false)}
          onStart={startMixed}
        />
      ) : (
        <ModeMenu
          memoryCount={memories.length}
          onStart={start}
          onMixedSetup={() => setShowMixedSetup(true)}
          onHistory={() => setShowHistory(true)}
        />
      )}
    </div>
  );
}
