"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { MemoryPetal } from "@/components/memory-petal";
import { QuizQuestionCard } from "@/components/quiz-question-card";
import { formatJapaneseDate } from "@/lib/data";
import { usePersistedMemoryQuestion } from "@/lib/use-persisted-memory-question";
import { restorePetal } from "@/lib/personal-quiz";
import { getMemoryDisplayUrl, type Memory } from "@/lib/types";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export function MemoryRecallDialog({ memory, memories, word, onClose, onRemembered }: {
  memory: Memory;
  memories: Memory[];
  word: string;
  onClose: () => void;
  onRemembered: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const { question, error: quizError, ready: quizReady, answer, setError } = usePersistedMemoryQuestion("recall", memory, memories);
  const restoring = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const isCorrect = selected === question.correctChoiceId;
  useBodyScrollLock();

  useEffect(() => {
    closeButton.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const releasePetal = async () => {
    if (restoring.current || !answered) return;
    restoring.current = true;
    try { await restorePetal(question.id); onRemembered(); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : "花びらを戻せませんでした。"); }
    finally { restoring.current = false; }
  };
  const confirmAnswer = async () => {
    if (!selected || answered) return;
    if (await answer(selected)) setAnswered(true);
  };

  return (
    <div className="fruit-quiz-overlay konoha-petal-colors" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="fruit-quiz-petal-shower" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => <MemoryPetal key={index} className="fruit-quiz-falling-petal" />)}
      </div>
      <section className="fruit-quiz-dialog memory-recall-dialog" data-step={answered ? "word" : "quiz"} role="dialog" aria-modal="true" aria-labelledby="memory-recall-title">
        <button ref={closeButton} type="button" className="fruit-quiz-close" onClick={onClose} aria-label="思い出しクイズを閉じる"><X size={18} /></button>
        <p className="fruit-quiz-eyebrow">{answered ? "MEMORY RETURNED" : "FADING MEMORY"}</p>
        <h2 id="memory-recall-title">{answered ? (isCorrect ? "覚えてたね" : "失いかけてたね") : "消えかけた思い出"}</h2>
        <p className="fruit-quiz-lead">{quizError ?? (answered ? "前と同じ言葉が花びらに戻ります。" : "クイズに答えて、この思い出をもう一度つなぎとめよう。")}</p>

        {!answered ? (
          <div className="fruit-quiz-question-step">
            <QuizQuestionCard question={quizError ? { ...question, prompt: quizError } : question} selectedChoiceId={selected} answered={false} onSelect={setSelected} />
            <button type="button" className="quiz-primary-button" onClick={confirmAnswer} disabled={!selected || !quizReady}>答えを確認</button>
          </div>
        ) : (
          <div className="fruit-quiz-word-step">
            <div className="fruit-quiz-result-badge" data-correct={isCorrect || undefined} role="status" aria-live="polite">
              <span>{isCorrect ? <Check size={16} /> : <X size={16} />}</span>
              <strong>{isCorrect ? "覚えてたね" : "失いかけてたね"}</strong>
            </div>

            <article className="fruit-quiz-memory-focus">
              <p>もう一度見つけた思い出</p>
              <img src={getMemoryDisplayUrl(memory)} alt={memory.caption} />
              <div><small>{formatJapaneseDate(memory.date)}</small><strong>{memory.caption}</strong></div>
            </article>

            <div className="memory-recall-petal-preview" aria-label={`花びらの言葉：${word}`}>
              <MemoryPetal />
              <strong>{word}</strong>
            </div>
            <button type="button" className="quiz-primary-button" onClick={releasePetal}>花びらをもとに戻す</button>
          </div>
        )}
      </section>
    </div>
  );
}
