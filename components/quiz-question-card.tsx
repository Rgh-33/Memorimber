"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { Check, ImageOff, X } from "lucide-react";
import type { MemoryQuizQuestion } from "@/lib/quiz";
import { getMemoryDisplayUrl } from "@/lib/types";

function MosaicPhoto({ src, alt, revealed = false, compact = false }: {
  src: string;
  alt: string;
  revealed?: boolean;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(src ? "loading" : "error");
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Cached images may finish before hydration attaches the load handler.
    const image = imageRef.current;
    if (image?.complete) setStatus(image.naturalWidth > 0 ? "loaded" : "error");
  }, []);

  return (
    <div className={`quiz-mosaic-photo ${compact ? "quiz-mosaic-photo--compact" : ""}`} data-revealed={revealed || undefined} data-status={status} aria-busy={status === "loading"}>
      {src && <img ref={imageRef} src={src} alt={status === "loaded" ? alt : ""} onLoad={() => setStatus("loaded")} onError={() => setStatus("error")} />}
      {status === "loading" && <span className="quiz-photo-loading" role="status"><span className="quiz-photo-status-label">読み込み中…</span></span>}
      {status === "error" && <span className="quiz-photo-error" role="status"><ImageOff size={22} aria-hidden="true" /><span>写真を読み込めませんでした</span></span>}
    </div>
  );
}

export function QuizQuestionCard({ question, selectedChoiceId, answered, onSelect }: {
  question: MemoryQuizQuestion;
  selectedChoiceId: string | null;
  answered: boolean;
  onSelect: (choiceId: string) => void;
}) {
  const isCorrect = answered && selectedChoiceId === question.correctChoiceId;
  const hasPhotoChoices = question.kind === "caption-to-photo";

  return (
    <div className="quiz-question-card">
      <h2 className="quiz-question-title">{question.prompt}</h2>

      {question.kind !== "caption-to-photo" && (
        <MosaicPhoto
          key={`${question.id}:${getMemoryDisplayUrl(question.memory)}`}
          src={getMemoryDisplayUrl(question.memory)}
          alt={answered ? question.memory.caption : "モザイクのかかったクイズ写真"}
          revealed={answered}
        />
      )}

      <div className={hasPhotoChoices ? "quiz-photo-choices" : "quiz-text-choices"}>
        {question.choices.map((choice, index) => {
          const selected = selectedChoiceId === choice.id;
          const correct = answered && choice.id === question.correctChoiceId;
          const wrong = answered && selected && !correct;
          return (
            <button
              key={choice.id}
              type="button"
              className="quiz-choice"
              data-selected={selected || undefined}
              data-correct={correct || undefined}
              data-wrong={wrong || undefined}
              onClick={() => !answered && onSelect(choice.id)}
              disabled={answered}
              aria-pressed={selected}
            >
              {choice.imageUrl ? (
                <>
                  <MosaicPhoto
                    key={choice.imageUrl}
                    src={choice.imageUrl}
                    alt={answered ? `写真の選択肢${index + 1}` : `モザイク写真の選択肢${index + 1}`}
                    compact
                    revealed={answered}
                  />
                  <span className="quiz-photo-choice-number">{index + 1}</span>
                </>
              ) : (
                <span>{choice.label}</span>
              )}
              {answered && (correct || wrong) && (
                <span className="quiz-choice-result" aria-hidden="true">
                  {correct ? <Check size={17} /> : <X size={17} />}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="quiz-answer-feedback" data-correct={isCorrect || undefined} role="status" aria-live="polite">
          <span className="quiz-answer-feedback-icon">{isCorrect ? <Check /> : <X />}</span>
          <div>
            <p>{isCorrect ? "正解！" : "おしい、不正解"}</p>
            {!isCorrect && <span>正解：{question.correctLabel}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
