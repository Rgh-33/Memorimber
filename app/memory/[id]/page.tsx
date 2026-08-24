"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Music2, Tag, Users } from "lucide-react";
import { formatJapaneseDate } from "@/lib/data";
import { useMemories } from "@/lib/memories-context";
import { MemoryCard } from "@/components/memory-card";

export default function MemoryDetailPage() {
  const params = useParams<{ id: string }>();
  const { memories, getMemory, getRelatedMemories } = useMemories();
  const memory = getMemory(params.id);

  if (!memory) {
    return <div className="page-pad"><Link href="/" className="flex items-center gap-1 text-sm font-bold text-ink/60"><ArrowLeft size={17} /> ホーム</Link><div className="mt-20 rounded-3xl bg-white p-6 text-center shadow-card"><p className="font-bold text-ink">思い出が見つかりません</p><p className="mt-2 text-sm text-ink/55">投稿がまだ保存されていないか、リンクが古くなっています。</p><Link href="/" className="mt-5 inline-block rounded-full bg-coral px-5 py-3 text-xs font-bold text-white">思い出を残す</Link></div></div>;
  }

  const sorted = [...memories].sort((a, b) => a.date.localeCompare(b.date));
  const currentIndex = sorted.findIndex((item) => item.id === memory.id);
  const previous = currentIndex > 0 ? sorted[currentIndex - 1] : undefined;
  const next = currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : undefined;
  const related = getRelatedMemories(memory);

  return (
    <div className="page-pad">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1 text-sm font-bold text-ink/60 hover:text-ink"><ArrowLeft size={17} /> ホーム</Link>
        <span className="text-sm font-black tracking-[0.08em] text-ink">思い出詳細</span>
        <span className="w-12" />
      </header>

      <article className="mt-7">
        <div className="relative rounded-3xl bg-white p-3 shadow-card">
          <span className="paper-tape right-7 top-0 rotate-6" />
          <img src={memory.imageUrl} alt={memory.caption} className="aspect-[4/3] w-full rounded-2xl object-cover" />
        </div>
        <div className="mt-6 flex items-center gap-2 text-xs font-bold text-coral"><CalendarDays size={15} /> {formatJapaneseDate(memory.date)}</div>
        <h1 className="mt-3 text-2xl font-black leading-9 text-ink">{memory.caption}</h1>
        <div className="mt-5 flex flex-wrap gap-2">
          {memory.people.map((person) => <span key={person} className="inline-flex items-center gap-1 rounded-full bg-lavender/70 px-3 py-2 text-xs font-bold text-ink"><Users size={13} /> {person}</span>)}
          {memory.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-sage/30 px-3 py-2 text-xs font-bold text-ink"><Tag size={13} /> {tag}</span>)}
        </div>
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-ink px-4 py-3.5 text-white"><div className="flex items-center gap-2"><Music2 size={18} className="text-sunset" /><div><p className="text-xs font-bold">この月のBGM</p><p className="text-[11px] text-white/55">帰り道のオレンジ</p></div></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/70">試聴のみ</span></div>
      </article>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black text-ink">関連する思い出</h2><span className="text-[11px] text-ink/40">記憶をたどる</span></div>
        {related.length > 0 ? <div className="grid grid-cols-3 gap-2">{related.map((item) => <MemoryCard key={item.id} memory={item} compact />)}</div> : <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-xs text-ink/50">近い思い出を、これから増やしていこう。</div>}
      </section>

      <div className="mt-7 grid grid-cols-2 gap-3">
        {previous ? <Link href={`/memory/${previous.id}`} className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-3 text-xs font-bold text-ink"><ChevronLeft size={17} /> 前の思い出</Link> : <span />}
        {next ? <Link href={`/memory/${next.id}`} className="flex items-center justify-end gap-2 rounded-2xl border border-line bg-white px-3 py-3 text-xs font-bold text-ink">次の思い出 <ChevronRight size={17} /></Link> : <span />}
      </div>
    </div>
  );
}
