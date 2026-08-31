"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTea } from "@/lib/tea-context";
import { useMemories } from "@/lib/memories-context";
import { memoryWord, MONTHLY_SIPS, readyPearls, sipCount, teaRemaining } from "@/lib/tea-state";
import { TeaCup } from "./tea-cup";
import { MemoryWords } from "./memory-words";
import { TeaRollover } from "./tea-rollover";
import { TeaPreviewControls } from "./tea-preview-controls";

export function MemoryTea() {
  const tea = useTea();
  const { error, refreshMemories } = useMemories();
  const cupRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDialogElement>(null);
  const getAnchorRect = useCallback(() => cupRef.current?.getBoundingClientRect() ?? null, []);
  const [sipStarted, setSipStarted] = useState(false);
  const { lastSip, clearSip, enteringIds, settlePearls } = tea;
  useEffect(() => {
    if (!enteringIds.length) return;
    const timer = window.setTimeout(settlePearls, 2100);
    return () => window.clearTimeout(timer);
  }, [enteringIds, settlePearls]);
  useEffect(() => {
    if (!lastSip) return;
    const frame = window.requestAnimationFrame(() => setSipStarted(true));
    const timer = window.setTimeout(() => { clearSip(); setSipStarted(false); }, 1700);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [lastSip, clearSip]);
  const ready = readyPearls(tea.state);
  const count = sipCount(tea.state);
  const words = tea.state.sips.slice(-12).flatMap((sip, index) => {
    const memory = tea.memories.find((item) => item.id === sip.memoryId);
    return memory ? [{ id: sip.memoryId, memoryId: memory.id, word: memoryWord(memory), wordSlot: index, relatedMemoryIds: tea.memories.filter((item) => item.id === memory.id || item.tags.some((tag) => memory.tags.includes(tag))).map((item) => item.id) }] : [];
  });
  return (
    <section className="memory-tea" aria-label="思い出のミルクティー">
      <div className="tea-scene">
        <MemoryWords items={words} memories={tea.memories} getAnchorRect={getAnchorRect} />
        <div ref={cupRef} className="tea-cup-position">
          <button type="button" className="tea-cup-trigger" aria-label="タピオカミルクティーをタップして操作を開く" aria-haspopup="dialog" onClick={() => actionsRef.current?.showModal()}>
            <TeaCup remaining={Math.min(1, teaRemaining(tea.state) + (lastSip && !sipStarted && count <= MONTHLY_SIPS ? 1 / MONTHLY_SIPS : 0))} pearls={tea.state.pearls} enteringIds={enteringIds} sipping={Boolean(lastSip)} />
          </button>
        </div>
        {lastSip && <p className="tea-emerging-word" aria-live="polite">{words.find((word) => word.id === lastSip)?.word}</p>}
      </div>
      <TeaPreviewControls />
      <dialog ref={actionsRef} className="tea-actions" aria-labelledby="tea-actions-title" onClick={(event) => { if (event.target === event.currentTarget) actionsRef.current?.close(); }}>
        <div className="tea-actions-content">
          <button type="button" className="tea-actions-close" aria-label="閉じる" autoFocus onClick={() => actionsRef.current?.close()}><X size={18} /></button>
          <h2 id="tea-actions-title">思い出クイズ</h2>
          {error && !tea.isPreview ? <div role="alert" className="tea-error"><p>{error}</p><button type="button" onClick={() => void refreshMemories()}>もう一度読み込む</button></div> : !tea.loaded ? <p role="status">読み込んでいます…</p> : ready.length > 0 ? <>
            <p>タピオカをひと粒飲んで、思い出を振り返ります。</p>
            <Link href="/quiz" className="tea-primary" onClick={() => actionsRef.current?.close()}>飲む</Link>
          </> : <p>写真が増えると、古い思い出からクイズができます。</p>}
          {tea.isPreview && <p className="tea-preview-notice">サンプルのカップです。実際の記録には影響しません。</p>}
          {tea.storageWarning && <p role="status" className="tea-error">ブラウザに進行を保存できません。この画面を閉じると進行が戻る場合があります。</p>}
        </div>
      </dialog>
      <TeaRollover />
    </section>
  );
}
