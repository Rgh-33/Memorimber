"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Music2, Pause, Play, Printer } from "lucide-react";
import { MemoryCard } from "@/components/memory-card";
import { ALBUM_MONTHS } from "@/lib/data";
import { useMemories } from "@/lib/memories-context";

export default function AlbumPage() {
  const { getMonthMemories } = useMemories();
  const [monthIndex, setMonthIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const month = ALBUM_MONTHS[monthIndex];
  const memories = getMonthMemories(month.key);

  return (
    <div className="page-pad">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1 text-sm font-bold text-ink/60 hover:text-ink"><ArrowLeft size={17} /> ホーム</Link>
        <span className="text-sm font-black tracking-[0.08em] text-ink">月間アルバム</span>
        <CalendarDays size={19} className="text-ink/40" />
      </header>

      <section className="mt-9 text-center">
        <div className="mx-auto flex max-w-[270px] items-center justify-between">
          <button type="button" onClick={() => setMonthIndex((index) => Math.min(index + 1, ALBUM_MONTHS.length - 1))} className="rounded-full p-2 text-ink/45 hover:bg-paper hover:text-ink" aria-label="前の月"><ChevronLeft size={20} /></button>
          <div>
            <p className="text-xs font-bold text-coral">MONTHLY ALBUM</p>
            <h1 className="mt-1 text-2xl font-black text-ink">{month.label}</h1>
          </div>
          <button type="button" onClick={() => setMonthIndex((index) => Math.max(index - 1, 0))} className="rounded-full p-2 text-ink/45 hover:bg-paper hover:text-ink" aria-label="次の月"><ChevronRight size={20} /></button>
        </div>
        <p className="mx-auto mt-4 max-w-[290px] text-sm leading-6 text-ink/60">{month.message}</p>
        <p className="mt-3 text-sm font-black text-coral">{memories.length}個の思い出</p>
      </section>

      <div className="mt-7 grid grid-cols-2 gap-3">
        {memories.length > 0 ? memories.map((memory) => <MemoryCard key={memory.id} memory={memory} />) : <div className="col-span-2 rounded-3xl border border-dashed border-line bg-white/60 px-5 py-12 text-center"><p className="font-bold text-ink">この月の思い出はまだありません</p><Link href="/post" className="mt-4 inline-block text-sm font-bold text-coral underline underline-offset-4">新しい思い出を残す</Link></div>}
      </div>

      <section className="mt-6 space-y-3">
        <button type="button" onClick={() => window.print()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 py-3.5 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:shadow-card print-hide"><Printer size={18} /> {month.label}をプリントする</button>
        <div className="flex items-center justify-between rounded-2xl bg-ink px-4 py-3.5 text-white">
          <div className="flex items-center gap-2"><Music2 size={18} className="text-sunset" /><div><p className="text-xs font-bold">今月のBGM</p><p className="mt-0.5 text-[11px] text-white/55">帰り道のオレンジ</p></div></div>
          <button type="button" onClick={() => setPlaying((value) => !value)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink transition hover:scale-105" aria-label={playing ? "BGMを停止" : "BGMを再生"}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button>
        </div>
      </section>
    </div>
  );
}
