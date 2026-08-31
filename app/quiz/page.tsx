"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Grid3X3, HelpCircle, RotateCcw, X } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { QUIZ_QUESTIONS } from "@/lib/data";
import { useTea } from "@/lib/tea-context";
import { memoryWord, readyPearls, teaQuestion } from "@/lib/tea-state";
import type { Memory } from "@/lib/types";

export default function QuizPage() {
  const tea = useTea();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [answerError, setAnswerError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const oldestId = readyPearls(tea.state)[0];
  useEffect(() => {
    if (!memory && oldestId && tea.loaded) setMemory(tea.memories.find((item) => item.id === oldestId) ?? null);
  }, [memory, oldestId, tea.loaded, tea.memories]);
  const question = memory ? QUIZ_QUESTIONS.find((item) => item.memoryId === (memory.sourceMemoryId ?? memory.id)) ?? teaQuestion(memory) : null;
  const answered = confirmed;
  const correct = selected === question?.correctChoice;

  if (!memory || !question || tea.state.rollover) return <div className="page-pad"><AppHeader /><section className="tea-quiz-empty"><p className="tea-eyebrow">SLOWLY, ONE MEMORY AT A TIME</p><h1>{tea.state.rollover ? "新しい一杯が、待っています。" : !tea.loaded ? "カップを用意しています…" : oldestId ? "思い出を読み込めませんでした。" : "飲みごろまで、あと少し。"}</h1><p>{tea.state.rollover ? "まずはホームで、思い出を次の月へ。" : "最近の7粒はカップの中でひと休み。新しい写真を残すたび、古い思い出からクイズになります。"}</p><Link href="/" className="tea-primary">カップに戻る</Link></section></div>;

  const nextQuestion = () => {
    setMemory(tea.memories.find((item) => item.id === oldestId) ?? null);
    setSelected(null);
    setConfirmed(false);
    setShowHint(false);
    setAnswerError(false);
  };

  return (
    <div className="page-pad">
      <AppHeader />
      <section className="pt-7 text-center">
        <h1 className="font-sans text-[25px] font-medium tracking-[0.1em] text-ink">ひと粒、思い出す</h1>
        <p className="mt-4 text-[11px] font-medium tracking-[0.14em] text-coral">ONE SIP, ONE MEMORY</p>
        <h2 className="mt-2 font-sans text-lg font-medium tracking-[0.05em] text-ink">{question.question}</h2>
      </section>

      <div className="relative mt-5 overflow-hidden rounded-xl border border-dashed border-coral/45 bg-ivory p-2">
        <div className={`aspect-[4/3] overflow-hidden rounded-lg bg-paper transition duration-500 ${answered ? "" : "blur-[10px]"}`}>
          <img src={memory.imageUrl} alt="クイズの写真" className="h-full w-full object-cover" />
        </div>
        {!answered && <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center text-coral/45"><Grid3X3 size={52} strokeWidth={1.2} /></span>}
      </div>

      <div className="mt-4 space-y-2">
        {question.choices.map((choice) => {
          const isSelected = selected === choice;
          const isAnswer = answered && choice === question.correctChoice;
          const isWrong = answered && isSelected && !correct;
          return (
            <button key={choice} type="button" onClick={() => !answered && setSelected(choice)} className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition ${isAnswer ? "border-coral bg-paper font-medium text-ink" : isWrong ? "border-red-300 bg-red-50 text-red-600" : isSelected ? "border-coral bg-coral/10 font-medium text-ink" : "border-line bg-ivory text-ink hover:border-coral/60"}`}>
              <span>{choice}</span>{isAnswer && <Check size={17} className="text-coral" />}{isWrong && <X size={17} />}
            </button>
          );
        })}
      </div>

      <button type="button" onClick={() => setShowHint((value) => !value)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-ivory px-4 py-3 text-xs text-ink hover:bg-paper"><HelpCircle size={17} className="text-coral" /> {showHint ? question.hint : "ヒントを見る"}</button>

      {!answered ? (
        <button type="button" onClick={() => { if (!selected) return; if (tea.completeQuiz(memory.id, correct)) setConfirmed(true); else setAnswerError(true); }} disabled={!selected || !tea.loaded} className="tea-primary mt-3">答えて、ひと口味わう</button>
      ) : (
        <div className="mt-3 rounded-xl border border-line bg-paper p-4">
          <p className="font-medium text-ink">{correct ? "正解！ 記憶がつながったね。" : `正解は「${question.correctChoice}」です。`}</p>
          <p className="mt-1 text-xs leading-5 text-ink/55">{memory.caption}</p>
          <p className="tea-answer-word">{memoryWord(memory)}</p>
          <p className="text-center text-xs leading-6 text-ink/60">ひと粒の思い出が、言葉になりました。</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={`/memory/${memory.sourceMemoryId ?? memory.id}`} className="rounded-lg bg-coral px-3 py-3 text-center text-xs font-medium text-white">思い出を見る</Link>
            {oldestId ? <button type="button" onClick={nextQuestion} className="flex items-center justify-center gap-1 rounded-lg border border-line bg-ivory px-3 py-3 text-xs font-medium text-ink"><RotateCcw size={14} /> 次のひと粒</button> : <Link href="/" className="rounded-lg border border-line bg-ivory px-3 py-3 text-center text-xs font-medium text-ink">カップに戻る</Link>}
          </div>
        </div>
      )}
      {answerError && <p role="alert" className="mt-3 text-xs leading-6 text-ink/70">カップの状態が変わりました。<Link href="/" className="underline">カップに戻って</Link>確認してください。</p>}
      {answered && oldestId && <Link href="/" className="mt-5 block text-center text-xs text-coral underline">カップに戻って、浮かぶ言葉を見る</Link>}
    </div>
  );
}
