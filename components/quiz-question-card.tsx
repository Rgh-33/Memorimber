"use client";

/* eslint-disable @next/next/no-img-element */

import { Check, Grid3X3, X } from "lucide-react";
import type { MemoryQuizQuestion } from "@/lib/quiz";

function MosaicPhoto({ src, alt, revealed = false, compact = false }: {
  src: string;
  alt: string;
  revealed?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`quiz-mosaic-photo ${compact ? "quiz-mosaic-photo--compact" : ""}`} data-revealed={revealed || undefined}>
      <img src={src} alt={alt} />
      {!revealed && <span className="quiz-mosaic-mark" aria-hidden="true"><Grid3X3 /></span>}
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
          src={question.memory.imageUrl}
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
