"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { QuizSession } from "@/components/quiz-session";
import { useTree } from "@/lib/tree-context";
import { getFruitQuiz } from "@/lib/tree-growth";

export default function QuizPage() {
  return <Suspense fallback={<div className="page-pad"><AppHeader /></div>}><QuizContent /></Suspense>;
}

function QuizContent() {
  const search = useSearchParams();
  const tree = useTree();
  const memoryId = search.get("memory");

  if (!tree.ready) return <div className="page-pad"><AppHeader /></div>;

  if (memoryId === null) {
    const choices = tree.visibleItems.flatMap((item) => {
      if (item.stage !== "quiz-ready") return [];
      const quiz = getFruitQuiz(tree.memories, tree.visibleItems, item.memoryId ?? null);
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

  const quiz = getFruitQuiz(tree.memories, tree.visibleItems, memoryId);
  if (!quiz) return <div className="page-pad"><AppHeader /><p className="mt-10 text-center text-sm">クイズの思い出が見つかりません。</p></div>;
  return <QuizSession key={`${tree.preview}-${quiz.memory.id}`} quiz={quiz} />;
}
