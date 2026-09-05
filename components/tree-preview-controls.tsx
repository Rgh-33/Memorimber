"use client";

import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useTree } from "@/lib/tree-context";

export function TreePreviewControls() {
  const tree = useTree();
  const toggle = (
    <label className="konoha-preview-toggle">
      <input type="checkbox" checked={tree.preview} disabled={!tree.ready} onChange={(event) => tree.setPreview(event.target.checked)} />
      プレビュー
    </label>
  );

  return (
    <div className={`konoha-preview-slot print-hide${tree.preview ? " konoha-preview-slot--fixed" : ""}`}>
      <div className={`konoha-preview${tree.preview ? " konoha-preview--fixed" : ""}`} aria-label="木のプレビュー操作">
        {tree.preview ? (
          <fieldset disabled={!tree.ready}>
            <div className="konoha-preview-date">
              {toggle}
              <button type="button" onClick={() => tree.advance(0, -1)} aria-label="前の月"><ChevronLeft size={15} /></button>
              <input type="date" value={tree.date} onChange={(event) => tree.setDate(event.target.value)} aria-label="プレビューの日付" />
              <button type="button" onClick={() => tree.advance(0, 1)} aria-label="次の月"><ChevronRight size={15} /></button>
              <button type="button" onClick={tree.reset} aria-label="プレビューを初期化"><RotateCcw size={14} /></button>
            </div>
            <div className="konoha-preview-actions">
              <button type="button" onClick={() => tree.advance(1)}>1日進める</button>
              <button type="button" onClick={tree.upload} aria-label="プレビューに1枚アップロード">1枚追加</button>
              <button type="button" onClick={tree.uploadGolden} aria-label="プレビューに1枚追加して新しく収穫可能になる実を金にする">1枚追加(金)</button>
            </div>
          </fieldset>
        ) : toggle}
      </div>
    </div>
  );
}
