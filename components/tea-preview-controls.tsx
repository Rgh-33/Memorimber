"use client";

import { useTea } from "@/lib/tea-context";
import { useMemories } from "@/lib/memories-context";

export function TeaPreviewControls() {
  const tea = useTea();
  const { isDemo } = useMemories();
  return (
    <details className="tea-preview-controls">
      <summary>{tea.isPreview ? "試作の演出を試す" : "サンプルで演出を試す"}<span>PREVIEW</span></summary>
      <p>実際の写真や記録を変更せずに、粒の投入・クイズ・月替わりを試せます。</p>
      {tea.isPreview ? <>
        <div className="tea-preview-buttons">
          <button type="button" onClick={tea.addPreview} disabled={!tea.loaded || Boolean(tea.state.rollover)}>ひと粒を追加</button>
          <button type="button" onClick={tea.advancePreviewMonth} disabled={!tea.loaded || Boolean(tea.state.rollover)}>次の月へ</button>
          <button type="button" onClick={tea.resetPreview} disabled={!tea.loaded}>試作をリセット</button>
          {!isDemo && <button type="button" onClick={tea.exitPreview}>自分のカップに戻る</button>}
        </div>
      </> : <button type="button" className="tea-preview-start" onClick={tea.startPreview}>サンプルのカップを開く</button>}
      <p>クイズの進行は、このブラウザだけに保存する試作です。サーバーには同期しません。</p>
    </details>
  );
}
