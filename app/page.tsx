"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, ImagePlus, Images, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MemoryCard } from "@/components/memory-card";
import { useMemories } from "@/lib/memories-context";

export default function HomePage() {
  const { memories } = useMemories();
  const recent = [...memories].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  return (
    <div className="page-pad">
      <AppHeader />

      <section className="pt-9 text-center">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-coral">MEMORIES</p>
        <h1 className="mt-3 font-sans text-[26px] font-medium tracking-[0.08em] text-ink">あなたの思い出</h1>
        <p className="mx-auto mt-3 max-w-[300px] text-xs leading-6 text-ink/55">何気ない一日を、未来の自分へ。</p>
      </section>

      <section className="mt-7 overflow-hidden rounded-[24px] border border-line bg-gradient-to-br from-[#f8fbff] to-[#eaf4ff] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-ink/55">これまでに残した思い出</p>
            <p className="mt-1 font-sans text-[30px] font-semibold text-ink"><span className="text-coral">{memories.length}</span><span className="ml-1 text-sm">個</span></p>
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-coral shadow-sm"><Sparkles size={22} strokeWidth={1.7} /></span>
        </div>
        <Link href="/post" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5799e5] to-[#3f83d5] px-4 py-3.5 text-sm font-medium tracking-[0.08em] text-white shadow-sm transition hover:-translate-y-0.5">
          <ImagePlus size={18} /> 今日の思い出を残す
        </Link>
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">最近の思い出</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-ink/45"><CalendarDays size={12} /> あの日の小さな記録</p>
          </div>
          <Link href="/album" className="flex items-center gap-1 text-xs font-medium text-coral">すべて見る <ArrowRight size={14} /></Link>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {recent.map((memory) => <MemoryCard key={memory.id} memory={memory} dateOnly />)}
        </div>
      </section>

      <Link href="/album" className="mt-7 flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3.5 text-sm text-ink shadow-sm">
        <span className="flex items-center gap-2 font-medium"><Images size={18} className="text-coral" /> 月間アルバムを見る</span>
        <ArrowRight size={17} className="text-ink/40" />
      </Link>
    </div>
  );
}
