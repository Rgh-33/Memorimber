"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, Info, RotateCcw, Sparkles } from "lucide-react";
import { useMemories } from "@/lib/memories-context";

export default function MorePage() {
  const { resetDemo } = useMemories();

  return (
    <div className="page-pad">
      <header className="flex items-center justify-between"><Link href="/" className="flex items-center gap-1 text-sm font-bold text-ink/60 hover:text-ink"><ArrowLeft size={17} /> ホーム</Link><span className="text-sm font-black tracking-[0.08em] text-ink">その他</span><span className="w-12" /></header>
      <section className="mt-10"><p className="text-xs font-bold tracking-[0.12em] text-coral">ABOUT MEMORINBER</p><h1 className="mt-3 text-3xl font-black leading-tight text-ink">何もなかった、<br />なんてことはない。</h1><p className="mt-5 text-sm leading-7 text-ink/60">メモリンバーは、日常の小さな出来事を写真1枚と一言で残し、未来の自分が思い出を再発見するためのWebアプリです。</p></section>
      <div className="mt-8 space-y-3">
        <Link href="/post" className="flex items-center justify-between rounded-2xl border border-line bg-white p-4"><span className="flex items-center gap-3 text-sm font-bold"><Sparkles size={18} className="text-coral" /> 新しい思い出を残す</span><ChevronRight size={18} className="text-ink/35" /></Link>
        <div className="flex items-center justify-between rounded-2xl border border-line bg-white p-4"><span className="flex items-center gap-3 text-sm font-bold"><Info size={18} className="text-sunset" /> このプロトタイプについて</span><span className="text-[11px] text-ink/40">デモ版</span></div>
        <button type="button" onClick={resetDemo} className="flex w-full items-center justify-between rounded-2xl border border-line bg-white p-4 text-left"><span className="flex items-center gap-3 text-sm font-bold"><RotateCcw size={18} className="text-ink/55" /> デモデータを初期化</span><span className="text-[11px] text-ink/40">一時状態のみ</span></button>
      </div>
    </div>
  );
}
