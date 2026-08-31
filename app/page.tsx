"use client";

import { AppHeader } from "@/components/app-header";
import { MemoryTree } from "@/components/memory-tree";
import { TreePreviewControls } from "@/components/tree-preview-controls";
import { useTree } from "@/lib/tree-context";

export default function HomePage() {
  const tree = useTree();
  return (
    <div className="page-pad overflow-visible">
      <AppHeader />

      <section className="pt-8 text-center">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-coral">MEMORIES</p>
        <h1 className="mt-2 text-[25px] font-semibold tracking-[0.08em] text-ink">あなたの思い出</h1>
        <p className="mt-2 text-xs leading-6 text-ink/52">何気ない一日を、未来の自分へ。</p>
      </section>

      <MemoryTree key={`${tree.preview}-${tree.date.slice(0, 7)}`} items={tree.items} petals={tree.petals} memories={tree.memories} count={tree.count} month={tree.date.slice(0, 7)} />
      <TreePreviewControls />
    </div>
  );
}
