"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Grid3X3, HelpCircle } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useTree } from "@/lib/tree-context";
import { getFruitQuiz } from "@/lib/tree-growth";
import { useHarvest } from "@/lib/harvest-context";
import { formatJapaneseDate } from "@/lib/data";

export default function QuizPage() {
  return <Suspense fallback={<div className="page-pad"><AppHeader /></div>}><QuizContent /></Suspense>;
}

function QuizContent() {
  const search = useSearchParams();
  const tree = useTree();
  const memoryId = search.get("memory");

  if (tree.error) return <div className="page-pad"><AppHeader /><div role="alert" className="mt-10 rounded-xl border border-line p-4 text-sm leading-6 text-ink">{tree.error}<button type="button" onClick={() => void tree.refresh()} className="mt-2 block text-coral underline">再読み込み</button></div></div>;
  if (!tree.ready) return <div className="page-pad"><AppHeader /></div>;

  if (memoryId === null) {
    const choices = tree.items.flatMap((item) => {
      if (item.stage !== "quiz-ready") return [];
      const quiz = getFruitQuiz(tree.memories, tree.items, item.memoryId ?? null);
      return quiz ? [{ href: item.href, memory: quiz.memory }] : [];
    });
    return <div className="page-pad">
      <AppHeader />
      <h1 className="pt-7 text-center font-sans text-[25px] font-medium tracking-[0.1em] text-ink">思い出クイズ</h1>
      {choices.length === 0 ? <p className="mt-10 text-center text-sm">クイズの思い出が見つかりません。</p> :
        <div className="mt-5 space-y-2">
          {choices.map(({ href, memory }) => <Link key={memory.id} href={href} className="flex items-center gap-3 rounded-xl border border-line bg-ivory p-3 text-sm text-ink">
            <img src={memory.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0 break-words">{memory.caption}</span>
          </Link>)}
        </div>}
    </div>;
  }

  const quiz = getFruitQuiz(tree.memories, tree.items, memoryId);
  if (!quiz) return <div className="page-pad"><AppHeader /><p className="mt-10 text-center text-sm">クイズの思い出が見つかりません。</p></div>;
  return <QuizSession key={`${tree.preview}-${quiz.memory.id}`} quiz={quiz} />;
}

function QuizSession({ quiz }: { quiz: NonNullable<ReturnType<typeof getFruitQuiz>> }) {
  const harvest = useHarvest();
  const input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [word, setWord] = useState("");
  const { memory, question } = quiz;
  const answered = confirmed;

  return (
    <div className="page-pad">
      <AppHeader />
      <section className="pt-7 text-center">
        <h1 className="font-sans text-[25px] font-medium tracking-[0.1em] text-ink">思い出クイズ</h1>
        {!answered && <>
          <p className="mt-4 text-[11px] font-medium tracking-[0.14em] text-coral">QUESTION 1 / 1</p>
          <h2 className="mt-2 font-sans text-lg font-medium tracking-[0.05em] text-ink">{question.question}</h2>
        </>}
      </section>

      <div className="relative mt-5 overflow-hidden rounded-xl border border-dashed border-coral/45 bg-ivory p-2">
        <div className={`aspect-[4/3] overflow-hidden rounded-lg bg-paper transition duration-500 ${answered ? "" : "blur-[10px]"}`}>
          <img src={memory.imageUrl} alt="クイズの写真" className="h-full w-full object-cover" />
        </div>
        {!answered && <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center text-coral/45"><Grid3X3 size={52} strokeWidth={1.2} /></span>}
      </div>

      {answered && <div className="mt-4 space-y-2" role="status" aria-atomic="true">
        <p className="text-sm font-semibold text-ink">
          {selected === question.correctChoice ? "正解" : `不正解（正解：${question.correctChoice}）`}
        </p>
        <p className="text-xs text-ink/65">{formatJapaneseDate(memory.date)}</p>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink">{memory.caption}</p>
      </div>}

      {!answered && <><div className="mt-4 space-y-2">
        {question.choices.map((choice) => {
          const isSelected = selected === choice;
          return (
            <button key={choice} type="button" onClick={() => setSelected(choice)} className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition ${isSelected ? "border-coral bg-coral/10 font-medium text-ink" : "border-line bg-ivory text-ink hover:border-coral/60"}`}>
              <span>{choice}</span>
            </button>
          );
        })}
      </div>

      <button type="button" onClick={() => setShowHint((value) => !value)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-ivory px-4 py-3 text-xs text-ink hover:bg-paper"><HelpCircle size={17} className="text-coral" /> {showHint ? question.hint : "ヒントを見る"}</button></>}

      {!answered ? (
        <button type="button" onClick={() => selected && setConfirmed(true)} disabled={!selected} className="accent-gradient mt-3 w-full rounded-xl px-4 py-3.5 text-sm font-medium tracking-[0.08em] text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45">答えを確認</button>
      ) : (
          <form className="konoha-harvest-form" onSubmit={(event) => {
            event.preventDefault();
            input.current?.blur();
            void harvest.launch(memory.id, word);
          }}>
            <input ref={input} value={word} onChange={(event) => setWord([...event.target.value].slice(0, 12).join(""))}
              onKeyDown={event => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }}
              placeholder="写ってるもの" aria-label="花びらに書く単語" required autoComplete="off" disabled={harvest.busy} />
            <button type="submit" disabled={!word.trim() || harvest.busy} aria-label="この言葉で収穫する"><Check size={18} /></button>
          </form>
      )}
      {harvest.error && <p role="alert" className="mt-3 rounded-lg border border-red-400/40 p-3 text-xs leading-6 text-ink">{harvest.error}</p>}
    </div>
  );
}
