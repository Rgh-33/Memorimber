"use client";

import Link from "next/link";
import { ChevronRight, Info, RotateCcw, Settings, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useMemories } from "@/lib/memories-context";
import { useTea } from "@/lib/tea-context";

export default function MorePage() {
  const { resetDemo } = useMemories();
  const tea = useTea();

  return (
    <div className="page-pad">
      <AppHeader />
      <section className="pt-8 text-center">
        <h1 className="font-sans text-[25px] font-medium tracking-[0.1em] text-ink">その他</h1>
        <p className="mt-3 text-xs leading-6 text-ink/50">Memorimberについて</p>
      </section>
      <section id="about" className="mt-7 scroll-mt-6 rounded-2xl border border-line bg-paper p-5">
        <p className="text-[11px] font-medium tracking-[0.13em] text-coral">ABOUT MEMORINBER</p>
        <h2 className="mt-3 font-sans text-xl font-medium leading-8 text-ink">何もなかった、<br />なんてことはない。</h2>
        <p className="mt-3 text-xs leading-6 text-ink/55">日常の小さな出来事を写真1枚と一言で残し、未来の自分が思い出を再発見するためのアプリです。</p>
        <p className="mt-3 text-xs leading-6 text-ink/55">一枚の写真が、ミルクティーの中のひと粒に。古い思い出からゆっくり味わうと、言葉がカップの上に漂います。月が変わっても、まだ味わっていない思い出は、次の一杯へ。</p>
      </section>
      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-ivory">
        <Link href="/post" className="flex items-center justify-between border-b border-line p-4"><span className="flex items-center gap-3 text-sm font-medium"><Sparkles size={18} className="text-coral" /> 新しい思い出を残す</span><ChevronRight size={17} className="text-ink/35" /></Link>
        <div className="flex items-center justify-between border-b border-line p-4"><span className="flex items-center gap-3 text-sm font-medium"><Info size={18} className="text-coral" /> このプロトタイプについて</span><span className="text-[11px] text-ink/40">デモ版</span></div>
        <button type="button" onClick={() => { resetDemo(); tea.resetPreview(); }} className="flex w-full items-center justify-between border-b border-line p-4 text-left"><span className="flex items-center gap-3 text-sm font-medium"><RotateCcw size={18} className="text-coral" /> デモデータを初期化</span><span className="text-[11px] text-ink/40">実データは保持</span></button>
        <Link href="/settings" className="flex items-center justify-between p-4"><span className="flex items-center gap-3 text-sm font-medium"><Settings size={18} className="text-coral" /> 設定</span><ChevronRight size={17} className="text-ink/35" /></Link>
      </div>
    </div>
  );
}
