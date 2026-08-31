"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Grid3X3, HelpCircle, RotateCcw, X } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { QUIZ_QUESTIONS } from "@/lib/data";
import { useMemories } from "@/lib/memories-context";
import { useTree } from "@/lib/tree-context";
import { memoryQuestion } from "@/lib/tree-growth";

export default function QuizPage() {
  return <Suspense fallback={<div className="page-pad"><AppHeader /></div>}><QuizContent /></Suspense>;
}

function QuizContent() {
  const search = useSearchParams();
  return <QuizSession key={search.get("memory") ?? "quiz"} memoryId={search.get("memory")} />;
}

function QuizSession({ memoryId }: { memoryId: string | null }) {
  const { getMemory } = useMemories();
  const tree = useTree();
  const router = useRouter();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [word, setWord] = useState("");
  const ripe = tree.items.filter((item) => item.stage === "quiz-ready");
  const selectedId = memoryId ?? ripe[questionIndex % Math.max(1, ripe.length)]?.memoryId;
  const fruit = ripe.find((item) => item.memoryId === selectedId);
  const memory = selectedId ? tree.memories.find((item) => item.id === selectedId) : getMemory(QUIZ_QUESTIONS[questionIndex % QUIZ_QUESTIONS.length].memoryId);
  const question = selectedId && memory ? memoryQuestion(memory) : QUIZ_QUESTIONS[questionIndex % QUIZ_QUESTIONS.length];
  const questionCount = memoryId ? 1 : ripe.length || QUIZ_QUESTIONS.length;
  const answered = confirmed;
  const correct = selected === question.correctChoice;

  if (!tree.ready) return <div className="page-pad"><AppHeader /></div>;
  if (!memory || (memoryId && !fruit)) return <div className="page-pad"><AppHeader /><p className="mt-10 text-center text-sm">クイズの思い出が見つかりません。</p></div>;

  const nextQuestion = () => {
    if (memoryId) router.push("/quiz");
    setQuestionIndex((index) => (index + 1) % questionCount);
    setSelected(null);
    setConfirmed(false);
    setShowHint(false);
    setWord("");
  };

  return (
    <div className="page-pad">
      <AppHeader />
      <section className="pt-7 text-center">
        <h1 className="font-sans text-[25px] font-medium tracking-[0.1em] text-ink">思い出クイズ</h1>
        <p className="mt-4 text-[11px] font-medium tracking-[0.14em] text-coral">QUESTION {questionIndex + 1} / {questionCount}</p>
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
        <button type="button" onClick={() => selected && setConfirmed(true)} disabled={!selected} className="accent-gradient mt-3 w-full rounded-xl px-4 py-3.5 text-sm font-medium tracking-[0.08em] text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45">答えを確認</button>
      ) : (
        <div className="mt-3 rounded-xl border border-line bg-paper p-4">
          <p className="font-medium text-ink">{correct ? "正解！ 記憶がつながったね。" : `正解は「${question.correctChoice}」です。`}</p>
          <p className="mt-1 text-xs leading-5 text-ink/55">{memory.caption}</p>
          {fruit && <form className="konoha-harvest-form" onSubmit={(event) => {
            event.preventDefault();
            if (tree.harvest(memory.id, word)) router.push("/");
          }}>
            <input value={word} onChange={(event) => setWord([...event.target.value].slice(0, 12).join(""))} placeholder="一言を残す" aria-label="花びらに書く単語" required autoComplete="off" />
            <button type="submit" disabled={!word.trim()} aria-label="この言葉で収穫する"><Check size={18} /></button>
          </form>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={`/memory/${memory.id}`} className="rounded-lg bg-coral px-3 py-3 text-center text-xs font-medium text-white">思い出を見る</Link>
            <button type="button" onClick={nextQuestion} className="flex items-center justify-center gap-1 rounded-lg border border-line bg-ivory px-3 py-3 text-xs font-medium text-ink"><RotateCcw size={14} /> 次の問題</button>
          </div>
        </div>
      )}
    </div>
  );
}
