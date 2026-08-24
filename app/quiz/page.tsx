"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, HelpCircle, RotateCcw, Sparkles, X } from "lucide-react";
import { QUIZ_QUESTIONS } from "@/lib/data";
import { useMemories } from "@/lib/memories-context";

export default function QuizPage() {
  const { getMemory } = useMemories();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const question = QUIZ_QUESTIONS[questionIndex];
  const memory = getMemory(question.memoryId);
  const answered = selected !== null;
  const correct = selected === question.correctChoice;

  if (!memory) {
    return <div className="page-pad"><p className="font-bold">クイズの思い出が見つかりません。</p></div>;
  }

  const nextQuestion = () => {
    setQuestionIndex((index) => (index + 1) % QUIZ_QUESTIONS.length);
    setSelected(null);
    setShowHint(false);
  };

  return (
    <div className="page-pad">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1 text-sm font-bold text-ink/60 hover:text-ink"><ArrowLeft size={17} /> ホーム</Link>
        <span className="text-sm font-black tracking-[0.08em] text-ink">思い出クイズ</span>
        <Sparkles size={19} className="text-coral" />
      </header>

      <section className="mt-9">
        <div className="flex items-center justify-between"><p className="text-xs font-bold tracking-[0.12em] text-coral">MEMORY QUIZ · {questionIndex + 1}/{QUIZ_QUESTIONS.length}</p><HelpCircle size={17} className="text-ink/30" /></div>
        <h1 className="mt-4 text-2xl font-black leading-9 text-ink">{question.question}</h1>
        <p className="mt-2 text-sm text-ink/55">少しぼかした写真から、記憶をたどってみよう。</p>
      </section>

      <div className="relative mt-6 overflow-hidden rounded-3xl bg-paper p-3 shadow-card">
        <span className="paper-tape left-5 top-0" />
        <div className={`overflow-hidden rounded-2xl transition ${answered ? "" : "blur-[7px]"}`}><img src={memory.imageUrl} alt="クイズの写真" className="aspect-[4/3] h-full w-full object-cover" /></div>
        {!answered && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 px-4 py-2 text-xs font-black text-ink shadow-sm">思い出を開く</span>}
      </div>

      <div className="mt-5 space-y-2">
        {question.choices.map((choice) => {
          const isSelected = selected === choice;
          const isAnswer = answered && choice === question.correctChoice;
          const isWrong = answered && isSelected && !correct;
          return <button key={choice} type="button" onClick={() => !answered && setSelected(choice)} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-sm font-bold transition ${isAnswer ? "border-sage bg-sage/20 text-ink" : isWrong ? "border-coral bg-coral/10 text-coral" : isSelected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/40"}`}><span>{choice}</span>{isAnswer && <Check size={18} />}{isWrong && <X size={18} />}</button>;
        })}
      </div>

      {answered ? (
        <div className={`mt-4 rounded-2xl p-4 ${correct ? "bg-sage/20" : "bg-coral/10"}`}>
          <p className="font-black text-ink">{correct ? "正解！記憶がつながったね。" : `惜しい！正解は「${question.correctChoice}」です。`}</p>
          <p className="mt-1 text-xs leading-5 text-ink/60">{memory.caption}</p>
          <div className="mt-4 flex gap-2"><Link href={`/memory/${memory.id}`} className="flex-1 rounded-xl bg-ink px-3 py-3 text-center text-xs font-bold text-white">思い出を見返す</Link><button type="button" onClick={nextQuestion} className="flex items-center justify-center gap-1 rounded-xl border border-line bg-white px-3 py-3 text-xs font-bold text-ink"><RotateCcw size={14} /> 次へ</button></div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowHint((value) => !value)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-sunset/40 bg-sunset/10 px-4 py-3 text-xs font-bold text-ink"><HelpCircle size={16} className="text-sunset" /> {showHint ? question.hint : "ヒントを見る"}</button>
      )}
    </div>
  );
}
