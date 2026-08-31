"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Tag, Users } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MemoryCard } from "@/components/memory-card";
import { MemoryPhoto } from "@/components/memory-photo";
import { formatJapaneseDate, SAMPLE_MEMORIES } from "@/lib/data";
import { useMemories } from "@/lib/memories-context";

export default function MemoryDetailPage() {
  const params = useParams<{ id: string }>();
  const { memories, getMemory, getRelatedMemories, isLoading, error, warning, refreshMemories } = useMemories();
  const memory = getMemory(params.id);
  const sample = SAMPLE_MEMORIES.some((item) => item.id === params.id);

  if (!sample && (isLoading || error)) return <div className="page-pad"><AppHeader /><div className="mt-16 rounded-2xl border border-line bg-paper p-6 text-center text-sm leading-6">{isLoading ? <p role="status">思い出を読み込んでいます…</p> : <div role="alert">{error}<button type="button" onClick={() => void refreshMemories()} className="mt-3 block w-full text-coral underline">再読み込み</button></div>}</div></div>;

  if (!memory) return <div className="page-pad"><AppHeader /><div className="mt-16 rounded-2xl border border-line bg-paper p-6 text-center"><p className="font-medium">思い出が見つかりません</p><Link href="/post" className="mt-4 inline-block rounded-lg bg-coral px-5 py-3 text-xs font-medium text-white">思い出を残す</Link></div></div>;

  const sorted = [...(sample ? SAMPLE_MEMORIES : memories)].sort((a, b) => a.date.localeCompare(b.date));
  const currentIndex = sorted.findIndex((item) => item.id === memory.id);
  const previous = currentIndex > 0 ? sorted[currentIndex - 1] : undefined;
  const next = currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : undefined;
  const related = getRelatedMemories(memory);

  return (
    <div className="page-pad">
      <AppHeader />
      <h1 className="pt-7 text-center font-sans text-[25px] font-medium tracking-[0.1em] text-ink">思い出詳細</h1>
      {sample && <p className="mt-2 text-center text-xs text-ink/55">サンプルの思い出です</p>}
      {!sample && warning && <p role="status" className="mt-3 text-xs leading-5 text-ink/70">{warning}<button type="button" onClick={() => void refreshMemories()} className="ml-2 text-coral underline">再読み込み</button></p>}

      <article className="mt-4">
        <div className="overflow-hidden rounded-xl border border-dashed border-coral/45 bg-ivory p-2">
          <div className="aspect-[4/3] overflow-hidden rounded-lg"><MemoryPhoto src={memory.imageUrl} alt={memory.caption} detailed className="h-full w-full object-cover" /></div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-ink/65"><CalendarDays size={16} className="text-ink" /> {formatJapaneseDate(memory.date)}</p>
        <h2 className="mt-3 text-[15px] font-medium leading-6 text-ink">{memory.caption}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {memory.people.map((person) => <span key={person} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] text-ink/65"><Users size={12} className="text-coral" /> {person}</span>)}
          {memory.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] text-ink/65"><Tag size={12} className="text-coral" /> {tag}</span>)}
        </div>
      </article>

      <section className="mt-7">
        <h2 className="mb-3 text-sm font-medium text-ink">関連する思い出</h2>
        {related.length > 0 ? <div className="grid grid-cols-3 gap-2.5">{related.map((item) => <MemoryCard key={item.id} memory={item} compact />)}</div> : <div className="rounded-xl border border-dashed border-coral/35 px-4 py-5 text-center text-xs text-ink/45">近い思い出を、これから増やしていこう。</div>}
      </section>

      <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-xs text-ink">
        {previous ? <Link href={`/memory/${previous.id}`} className="flex items-center gap-1"><ChevronLeft size={16} /> 前の思い出</Link> : <span />}
        <span className="h-5 w-px bg-ink/30" />
        {next ? <Link href={`/memory/${next.id}`} className="flex items-center gap-1">次の思い出 <ChevronRight size={16} /></Link> : <span />}
      </div>
    </div>
  );
}
