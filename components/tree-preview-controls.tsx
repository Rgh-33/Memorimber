"use client";

import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useTree } from "@/lib/tree-context";

export function TreePreviewControls() {
  const tree = useTree();
  return (
    <div className="konoha-preview print-hide" aria-label="木のプレビュー操作">
      <label className="konoha-preview-toggle"><input type="checkbox" checked={tree.preview} disabled={!tree.ready} onChange={(event) => tree.setPreview(event.target.checked)} />プレビュー</label>
      {tree.preview && <fieldset disabled={!tree.ready}>
        <div className="konoha-preview-date">
          <button type="button" onClick={() => tree.advance(0, -1)} aria-label="前の月"><ChevronLeft size={15} /></button>
          <input type="date" value={tree.date} onChange={(event) => tree.setDate(event.target.value)} aria-label="プレビューの日付" />
          <button type="button" onClick={() => tree.advance(0, 1)} aria-label="次の月"><ChevronRight size={15} /></button>
        </div>
        <div className="konoha-preview-actions">
          <button type="button" onClick={() => tree.advance(1)}>1日進める</button>
          <button type="button" onClick={tree.upload}>1枚アップロード</button>
          <button type="button" onClick={tree.reset} aria-label="プレビューを初期化"><RotateCcw size={14} /></button>
        </div>
      </fieldset>}
    </div>
  );
}
