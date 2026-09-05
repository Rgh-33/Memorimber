"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, Grid3X3, HelpCircle, X } from "lucide-react";
import { formatJapaneseDate } from "@/lib/data";
import { useHarvest } from "@/lib/harvest-context";
import { getFruitQuiz } from "@/lib/tree-growth";
import { getMemoryDisplayUrl } from "@/lib/types";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

type FruitQuiz = NonNullable<ReturnType<typeof getFruitQuiz>>;

export function QuizSession({ quiz, variant = "page", onClose, onHarvest }: {
  quiz: FruitQuiz;
  variant?: "page" | "dialog";
  onClose?: () => void;
  onHarvest?: () => void;
}) {
  const harvest = useHarvest();
  const dialog = variant === "dialog";
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [word, setWord] = useState("");
  const { memory, question } = quiz;
  const answered = confirmed;
  useBodyScrollLock(dialog);

  useEffect(() => {
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [dialog]);

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!dialog) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onClose?.();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex='-1'])",
    );
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const content = <>
    <section className={dialog ? "konoha-quiz-heading" : "pt-7 text-center"}>
      <h1 id={dialog ? "konoha-fruit-quiz-title" : undefined} className={dialog
        ? "font-sans text-xl font-medium tracking-[0.08em] text-ink"
        : "font-sans text-[25px] font-medium tracking-[0.1em] text-ink"}>
        思い出クイズ
      </h1>
      {!answered && <>
        <p className={dialog ? "mt-2 text-[10px] font-medium tracking-[0.14em] text-coral" : "mt-4 text-[11px] font-medium tracking-[0.14em] text-coral"}>QUESTION 1 / 1</p>
        <h2 className={dialog ? "mt-1 font-sans text-base font-medium tracking-[0.04em] text-ink" : "mt-2 font-sans text-lg font-medium tracking-[0.05em] text-ink"}>{question.question}</h2>
      </>}
    </section>

    <div className={`relative overflow-hidden rounded-xl border border-dashed border-coral/45 bg-ivory p-2 ${dialog ? "mt-3" : "mt-5"}`}>
      <div className={`${dialog ? "konoha-quiz-photo" : "aspect-[4/3]"} overflow-hidden rounded-lg bg-paper transition duration-500 ${answered ? "" : "blur-[10px]"}`}>
        <img src={getMemoryDisplayUrl(memory)} alt="クイズの写真" className="h-full w-full object-cover" />
      </div>
      {!answered && <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center text-coral/45"><Grid3X3 size={dialog ? 42 : 52} strokeWidth={1.2} /></span>}
    </div>

    {answered && <div className={dialog ? "mt-3 space-y-1.5" : "mt-4 space-y-2"} role="status" aria-atomic="true">
      <p className="text-sm font-semibold text-ink">
        {selected === question.correctChoice ? "正解" : `不正解（正解：${question.correctChoice}）`}
      </p>
      <p className="text-xs text-ink/65">{formatJapaneseDate(memory.date)}</p>
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink">{memory.caption}</p>
    </div>}

    {!answered && <><div className={dialog ? "mt-3 space-y-2" : "mt-4 space-y-2"}>
      {question.choices.map((choice) => {
        const isSelected = selected === choice;
        return (
          <button key={choice} type="button" onClick={() => setSelected(choice)} className={`flex min-h-11 w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left text-sm transition ${isSelected ? "border-coral bg-coral/10 font-medium text-ink" : "border-line bg-ivory text-ink hover:border-coral/60"}`}>
            <span>{choice}</span>
          </button>
        );
      })}
    </div>

    <button type="button" onClick={() => setShowHint((value) => !value)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-ivory px-4 py-2.5 text-xs text-ink hover:bg-paper"><HelpCircle size={17} className="text-coral" /> {showHint ? question.hint : "ヒントを見る"}</button></>}

    {!answered ? (
      <button type="button" onClick={() => selected && setConfirmed(true)} disabled={!selected} className="accent-gradient mt-3 min-h-11 w-full rounded-xl px-4 py-3 text-sm font-medium tracking-[0.08em] text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45">答えを確認</button>
    ) : (
      <form className="konoha-harvest-form" onSubmit={async (event) => {
        event.preventDefault();
        input.current?.blur();
        if (await harvest.launch(memory.id, word)) onHarvest?.();
      }}>
        <input ref={input} value={word} onChange={(event) => setWord([...event.target.value].slice(0, 12).join(""))}
          onKeyDown={event => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }}
          placeholder="写ってるもの" aria-label="花びらに書く単語" required autoComplete="off" disabled={harvest.busy} />
        <button type="submit" disabled={!word.trim() || harvest.busy} aria-label="この言葉で収穫する"><Check size={18} /></button>
      </form>
    )}
    {harvest.error && <p role="alert" className="mt-3 rounded-lg border border-red-400/40 p-3 text-xs leading-6 text-ink">{harvest.error}</p>}
  </>;

  if (!dialog) return <div className="page-pad">{content}</div>;

  return <section
    ref={dialogRef}
    className="konoha-quiz-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="konoha-fruit-quiz-title"
    onClick={(event) => event.stopPropagation()}
    onKeyDown={handleDialogKeyDown}
  >
    <button ref={closeRef} type="button" className="konoha-quiz-close" onClick={onClose} aria-label="クイズを閉じる">
      <X size={18} />
    </button>
    {content}
  </section>;
}
