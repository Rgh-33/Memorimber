"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MemoryCard } from "@/components/memory-card";
import { ALBUM_MONTHS } from "@/lib/data";
import { useMemories } from "@/lib/memories-context";

export default function AlbumPage() {
  const { getMonthMemories } = useMemories();
  const [monthIndex, setMonthIndex] = useState(0);
  const month = ALBUM_MONTHS[monthIndex];
  const memories = getMonthMemories(month.key);

  return (
    <div className="page-pad">
      <AppHeader />
      <section className="pt-7 text-center">
        <h1 className="font-sans text-[25px] font-medium tracking-[0.1em] text-ink">月間アルバム</h1>
        <div className="mx-auto mt-3 flex max-w-[270px] items-center justify-between">
          <button type="button" onClick={() => setMonthIndex((index) => Math.min(index + 1, ALBUM_MONTHS.length - 1))} className="rounded-full p-2 text-ink hover:bg-paper disabled:opacity-20" disabled={monthIndex === ALBUM_MONTHS.length - 1} aria-label="前の月"><ChevronLeft size={19} /></button>
          <p className="text-lg font-medium tracking-[0.05em] text-ink">{month.label}</p>
          <button type="button" onClick={() => setMonthIndex((index) => Math.max(index - 1, 0))} className="rounded-full p-2 text-ink hover:bg-paper disabled:opacity-20" disabled={monthIndex === 0} aria-label="次の月"><ChevronRight size={19} /></button>
        </div>
        <p className="mt-1 text-xs text-ink/65">今月は <span className="text-xl font-semibold text-coral">{memories.length}</span> の思い出</p>
      </section>

      <section className="mt-5">
        {memories.length > 0 ? (
          <div className="grid grid-cols-3 gap-2.5">
            {memories.map((memory) => <MemoryCard key={memory.id} memory={memory} dateOnly />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-coral/45 bg-paper px-5 py-12 text-center text-sm text-ink/55">この月の思い出はまだありません</div>
        )}
      </section>

      <button type="button" onClick={() => window.print()} className="mt-5 flex w-full items-center justify-center gap-3 rounded-lg border border-coral/65 bg-ivory px-4 py-3 text-sm font-medium tracking-[0.04em] text-ink transition hover:bg-paper print-hide"><Printer size={18} /> {month.label.replace("2026年", "")}をプリントする</button>
    </div>
  );
}
