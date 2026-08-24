"use client";

import Link from "next/link";
import { ArrowUpRight, BookImage, CircleHelp, Menu, Sparkles } from "lucide-react";
import { MemoryForm } from "@/components/memory-form";

const today = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Tokyo",
}).format(new Date());

export default function HomePage() {
  return (
    <div className="page-pad">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="メモリンバー ホーム">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-ink text-sm font-black text-white">M</span>
          <span className="text-sm font-black tracking-[0.08em] text-ink">メモリンバー</span>
        </Link>
        <Link href="/more" className="rounded-full p-2 text-ink/45 transition hover:bg-paper hover:text-ink" aria-label="その他">
          <Menu size={21} />
        </Link>
      </header>

      <section className="pb-5 pt-9">
        <p className="text-xs font-bold tracking-wide text-coral">{today} · 今日もおつかれさま</p>
        <h1 className="mt-4 text-[30px] font-black leading-[1.3] tracking-tight text-ink">
          今日は、<span className="scribble-line">何を残す？</span>
        </h1>
        <p className="mt-4 max-w-[330px] text-sm leading-6 text-ink/60">
          写真1枚と一言だけで、何気ない日を未来の自分へ届けよう。
        </p>
      </section>

      <MemoryForm />

      <section className="mt-7 border-t border-line/70 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold text-ink/45">あとから、思い出す</p>
          <CircleHelp size={16} className="text-ink/25" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/album" className="group flex items-center justify-between rounded-2xl border border-line bg-white/70 p-3 transition hover:-translate-y-0.5 hover:shadow-card">
            <span className="flex items-center gap-2 text-xs font-bold text-ink"><BookImage size={16} className="text-sunset" /> アルバムを見る</span>
            <ArrowUpRight size={15} className="text-ink/35 transition group-hover:text-coral" />
          </Link>
          <Link href="/quiz" className="group flex items-center justify-between rounded-2xl border border-line bg-white/70 p-3 transition hover:-translate-y-0.5 hover:shadow-card">
            <span className="flex items-center gap-2 text-xs font-bold text-ink"><Sparkles size={16} className="text-coral" /> クイズをする</span>
            <ArrowUpRight size={15} className="text-ink/35 transition group-hover:text-coral" />
          </Link>
        </div>
      </section>
    </div>
  );
}
