"use client";

import { MemoryTree } from "@/components/memory-tree";
import { PageHeading } from "@/components/page-heading";
import { TreePreviewControls } from "@/components/tree-preview-controls";
import { useTree } from "@/lib/tree-context";

export default function HomePage() {
  const tree = useTree();
  return (
    <div className="page-pad overflow-visible">
      <PageHeading eyebrow="MEMORIES" title="あなたの思い出" />

      {tree.error ? (
        <div role="alert" className="mt-10 rounded-xl border border-line p-4 text-sm leading-6 text-ink">
          {tree.error}
          <button type="button" onClick={() => void tree.refresh()} className="mt-2 block text-coral underline">再読み込み</button>
        </div>
      ) : tree.ready ? (
        <MemoryTree key={`${tree.preview}-${tree.date.slice(0, 7)}-${tree.treeMode}`} items={tree.visibleItems} petals={tree.petals} memories={tree.memories}
          count={tree.count} totalCount={tree.totalCount} month={tree.date.slice(0, 7)} mode={tree.treeMode}
          preview={tree.preview}
          onUploadAnimationComplete={tree.completeUploadArrival} />
      ) : (
        <p role="status" className="py-12 text-center text-sm text-ink/65">思い出の木を読み込んでいます…</p>
      )}
      <TreePreviewControls />
    </div>
  );
}
