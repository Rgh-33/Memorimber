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

      {tree.error ? (
        <div role="alert" className="mt-10 rounded-xl border border-line p-4 text-sm leading-6 text-ink">
          {tree.error}
          <button type="button" onClick={() => void tree.refresh()} className="mt-2 block text-coral underline">再読み込み</button>
        </div>
      ) : tree.ready ? (
        <MemoryTree key={`${tree.preview}-${tree.date.slice(0, 7)}-${tree.treeMode}`} items={tree.visibleItems} petals={tree.petals} memories={tree.memories}
          count={tree.count} totalCount={tree.totalCount} month={tree.date.slice(0, 7)} mode={tree.treeMode} />
      ) : (
        <p role="status" className="py-12 text-center text-sm text-ink/65">思い出の木を読み込んでいます…</p>
      )}
      <TreePreviewControls />
    </div>
  );
}
