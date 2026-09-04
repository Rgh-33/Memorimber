"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, X } from "lucide-react";
import { MemoryPetal } from "@/components/memory-petal";
import { QuizQuestionCard } from "@/components/quiz-question-card";
import { formatJapaneseDate } from "@/lib/data";
import { useHarvest } from "@/lib/harvest-context";
import { FRUIT_QUIZ_KINDS, createMemoryQuizQuestion } from "@/lib/quiz";
import type { Memory } from "@/lib/types";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export function FruitQuizDialog({ memory, memories, onClose }: { memory: Memory; memories: Memory[]; onClose: () => void }) {
  const harvest = useHarvest();
  const closeButton = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [question] = useState(() => {
    const kind = FRUIT_QUIZ_KINDS[Math.floor(Math.random() * FRUIT_QUIZ_KINDS.length)];
    return createMemoryQuizQuestion(memory, memories, kind);
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [word, setWord] = useState("");
  const isCorrect = selected === question.correctChoiceId;
  useBodyScrollLock();

  useEffect(() => {
    closeButton.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !harvest.busy) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [harvest.busy, onClose]);

  const submitWord = async (event: FormEvent) => {
    event.preventDefault();
    input.current?.blur();
    if (await harvest.launch(memory.id, word)) onClose();
  };

  return (
    <div className="fruit-quiz-overlay konoha-petal-colors" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !harvest.busy) onClose();
    }}>
      <div className="fruit-quiz-petal-shower" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => <MemoryPetal key={index} className="fruit-quiz-falling-petal" />)}
      </div>
      <section className="fruit-quiz-dialog" data-step={answered ? "word" : "quiz"} role="dialog" aria-modal="true" aria-labelledby="fruit-quiz-title">
        <button ref={closeButton} type="button" className="fruit-quiz-close" onClick={onClose} disabled={harvest.busy} aria-label="木の実クイズを閉じる"><X size={18} /></button>
        <p className="fruit-quiz-eyebrow">{answered ? "MEMORY FOUND" : "FRUIT QUIZ"}</p>
        <h2 id="fruit-quiz-title">{answered ? "この木の実の思い出" : "思い出を見つけよう"}</h2>
        <p className="fruit-quiz-lead">{answered ? "見つけた思い出に、あなたの言葉を添えてください。" : "三択に答えて、木の実の記憶をひらこう。"}</p>

        {!answered ? (
          <div className="fruit-quiz-question-step">
            <QuizQuestionCard question={question} selectedChoiceId={selected} answered={false} onSelect={setSelected} />
            <button type="button" className="quiz-primary-button" onClick={() => selected && setAnswered(true)} disabled={!selected}>答えを確認</button>
          </div>
        ) : (
          <div className="fruit-quiz-word-step">
            <div className="fruit-quiz-result-badge" data-correct={isCorrect || undefined} role="status" aria-live="polite">
              <span>{isCorrect ? <Check size={16} /> : <X size={16} />}</span>
              <strong>{isCorrect ? "正解。この思い出でした" : "おしい。正解はこちら"}</strong>
            </div>

            <article className="fruit-quiz-memory-focus">
              <p>この木の実から見つかった思い出</p>
              <img src={memory.imageUrl} alt={memory.caption} />
              <div><small>{formatJapaneseDate(memory.date)}</small><strong>{memory.caption}</strong></div>
            </article>

            <div className="fruit-quiz-choice-review" aria-label="さっきの三択">
              <p>さっきの三択</p>
              <div data-kind={question.kind}>
                {question.choices.map((choice, index) => {
                  const correct = choice.id === question.correctChoiceId;
                  const chosenWrong = choice.id === selected && !correct;
                  return (
                    <span key={choice.id} data-correct={correct || undefined} data-wrong={chosenWrong || undefined}>
                      {choice.imageUrl ? <img src={choice.imageUrl} alt={`選択肢${index + 1}`} /> : choice.label}
                      {(correct || chosenWrong) && <i aria-label={correct ? "正解" : "選んだ不正解"}>{correct ? <Check size={12} /> : <X size={12} />}</i>}
                    </span>
                  );
                })}
              </div>
            </div>

            <form className="fruit-quiz-word-form" onSubmit={submitWord}>
              <label htmlFor={`fruit-word-${memory.id}`}>この思い出を一言で残そう</label>
              <div>
                <input
                  ref={input}
                  id={`fruit-word-${memory.id}`}
                  value={word}
                  onChange={(event) => setWord([...event.target.value].slice(0, 12).join(""))}
                  onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }}
                  placeholder="何が写ってる？"
                  maxLength={12}
                  autoComplete="off"
                  disabled={harvest.busy}
                  required
                />
                <button type="submit" disabled={!word.trim() || harvest.busy}><Check size={16} />花びらにする</button>
              </div>
            </form>
          </div>
        )}
        {harvest.error && <p role="alert" className="fruit-quiz-error">{harvest.error}</p>}
      </section>
    </div>
  );
}
