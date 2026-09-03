"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, Printer, Settings2, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MemoryBookPage } from "@/components/memory-book-page";
import { MemoryCard } from "@/components/memory-card";
import { MemoryDetailActions } from "@/components/memory-detail-actions";
import { SAMPLE_MEMORIES } from "@/lib/data";
import { useMemories } from "@/lib/memories-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loadMemoryDetail, type MemoryDetail } from "@/lib/supabase/memories";
import { useTree } from "@/lib/tree-context";
import type { Memory } from "@/lib/types";

type LoadState = "idle" | "loading" | "loaded" | "not-found" | "error";

function compareMemories(a: Memory, b: Memory) {
  return a.date.localeCompare(b.date) || (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.id.localeCompare(b.id);
}

export default function MemoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { memories, getRelatedMemories, refreshMemories } = useMemories();
  const tree = useTree();
  const configured = isSupabaseConfigured();
  const requestVersion = useRef(0);
  const previewMemory = tree.preview ? tree.memories.find((item) => item.id === params.id) : undefined;
  const sampleMemory = SAMPLE_MEMORIES.find((item) => item.id === params.id);
  const prototypeMemory = previewMemory ?? sampleMemory;
  const [detail, setDetail] = useState<MemoryDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(prototypeMemory ? "loaded" : "idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<"edit" | "delete" | null>(null);

  const fetchDetail = useCallback(async (showLoading = true) => {
    const version = ++requestVersion.current;
    if (showLoading) setLoadState("loading");
    setLoadError(null);
    try {
      const result = await loadMemoryDetail(createClient(), params.id);
      if (version !== requestVersion.current) return;
      setDetail(result);
      setLoadState(result ? "loaded" : "not-found");
    } catch (cause) {
      if (version !== requestVersion.current) return;
      setDetail(null);
      setLoadState("error");
      setLoadError(cause instanceof Error ? cause.message : "思い出を読み込めませんでした。");
    }
  }, [params.id]);

  useEffect(() => {
    if (prototypeMemory) {
      requestVersion.current += 1;
      setDetail(null);
      setLoadError(null);
      setLoadState("loaded");
      return;
    }
    if (!configured) {
      requestVersion.current += 1;
      setDetail(null);
      setLoadError(null);
      setLoadState("not-found");
      return;
    }
    void fetchDetail();
    return () => { requestVersion.current += 1; };
  }, [configured, fetchDetail, prototypeMemory]);

  const localNavigation = useMemo(() => {
    if (!prototypeMemory) return null;
    const source = previewMemory ? tree.memories : SAMPLE_MEMORIES;
    const sorted = [...source].sort(compareMemories);
    const currentIndex = sorted.findIndex((item) => item.id === prototypeMemory.id);
    return {
      previousId: currentIndex > 0 ? sorted[currentIndex - 1].id : null,
      nextId: currentIndex < sorted.length - 1 ? sorted[currentIndex + 1].id : null,
    };
  }, [previewMemory, prototypeMemory, tree.memories]);

  const memory = prototypeMemory ?? detail?.memory;
  const previousId = localNavigation?.previousId ?? detail?.previousId ?? null;
  const nextId = localNavigation?.nextId ?? detail?.nextId ?? null;
  const related = useMemo(() => {
    if (!memory) return [];
    if (previewMemory) {
      return tree.memories.filter((item) => item.id !== memory.id && item.tags.some((tag) => memory.tags.includes(tag))).slice(0, 3);
    }
    return getRelatedMemories(memories.find((item) => item.id === memory.id) ?? memory);
  }, [getRelatedMemories, memories, memory, previewMemory, tree.memories]);

  if (loadState === "idle" || loadState === "loading") {
    return <div className="page-pad"><AppHeader /><div className="mt-16 rounded-2xl border border-line bg-paper p-6 text-center text-sm leading-6"><p role="status">思い出を読み込んでいます…</p></div></div>;
  }

  if (loadState === "error") {
    return <div className="page-pad"><AppHeader /><div role="alert" className="mt-16 rounded-2xl border border-line bg-paper p-6 text-center text-sm leading-6"><p>{loadError}</p><button type="button" onClick={() => void fetchDetail()} className="mt-3 text-coral underline">再読み込み</button></div></div>;
  }

  if (loadState === "not-found" || !memory) {
    return <div className="page-pad"><AppHeader /><div className="mt-16 rounded-2xl border border-line bg-paper p-6 text-center"><p className="font-medium">思い出が見つかりません</p><p className="mt-2 text-xs leading-5 text-ink/55">削除されたか、この思い出を閲覧する権限がありません。</p><Link href="/album" className="mt-4 inline-block rounded-lg bg-coral px-5 py-3 text-xs font-medium text-white">アルバムへ戻る</Link></div></div>;
  }

  const handleUpdated = (updated: Memory) => {
    setDetail((current) => current ? { ...current, memory: updated } : current);
    setActionMode(null);
    void refreshMemories();
    void fetchDetail(false);
  };

  const handleDeleted = () => {
    void refreshMemories();
    router.replace("/album");
    router.refresh();
  };

  return (
    <div className="memory-detail-page page-pad">
      <div className="print-hide"><AppHeader /></div>

      <div className="print-hide mt-7 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.22em] text-coral">MEMORY PAGE</p>
          <h1 className="mt-1 font-sans text-[23px] font-medium tracking-[0.07em] text-ink">思い出の1ページ</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/memory/${memory.id}/album-settings`} className="flex items-center gap-2 rounded-full border border-line bg-ivory px-3.5 py-2.5 text-xs font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-coral/45 hover:bg-paper hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40 focus-visible:ring-offset-2" aria-label="この思い出でアルバムの見た目を設定する">
            <Settings2 size={16} className="text-coral" aria-hidden="true" /> 見た目
          </Link>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-full border border-coral/45 bg-ivory px-3.5 py-2.5 text-xs font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-paper hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40 focus-visible:ring-offset-2" aria-label="この思い出を印刷する">
            <Printer size={16} className="text-coral" aria-hidden="true" /> 印刷
          </button>
        </div>
      </div>
      {sampleMemory && <p className="print-hide mt-2 text-xs text-ink/55">サンプルの思い出です</p>}
      {detail?.warning && <p role="status" className="print-hide mt-3 text-xs leading-5 text-ink/70">{detail.warning}<button type="button" onClick={() => void fetchDetail(false)} className="ml-2 text-coral underline">再読み込み</button></p>}

      <div className="memory-book-page-shell mt-5">
        <MemoryBookPage
          memory={memory}
          editControl={!prototypeMemory && detail ? (
            <button type="button" onClick={() => setActionMode("edit")} className="memory-book-pencil" aria-label="思い出と手紙を編集" title="編集">
              <Pencil size={19} aria-hidden="true" />
            </button>
          ) : undefined}
        />
      </div>

      {!prototypeMemory && detail && actionMode === "edit" && (
        <div className="print-hide">
          <MemoryDetailActions key={`edit-${memory.id}`} memory={memory} mode="edit" onUpdated={handleUpdated} onDeleted={handleDeleted} onClose={() => setActionMode(null)} />
        </div>
      )}

      <nav aria-label="前後の思い出" className="print-hide mt-6 flex items-center justify-between border-t border-line pt-4 text-xs text-ink">
        {previousId ? <Link href={`/memory/${previousId}`} className="flex items-center gap-1"><ChevronLeft size={16} /> 前の思い出</Link> : <span />}
        <span className="h-5 w-px bg-ink/30" />
        {nextId ? <Link href={`/memory/${nextId}`} className="flex items-center gap-1">次の思い出 <ChevronRight size={16} /></Link> : <span />}
      </nav>

      <section className="print-hide mt-7">
        <h2 className="mb-3 text-sm font-medium text-ink">関連する思い出</h2>
        {related.length > 0 ? <div className="grid grid-cols-3 gap-2.5">{related.map((item) => <MemoryCard key={item.id} memory={item} compact />)}</div> : <div className="rounded-xl border border-dashed border-coral/35 px-4 py-5 text-center text-xs text-ink/45">近い思い出を、これから増やしていこう。</div>}
      </section>

      {!prototypeMemory && detail && (
        <div className="print-hide mt-8 border-t border-line pt-4">
          {actionMode === "delete" ? (
            <MemoryDetailActions key={`delete-${memory.id}`} memory={memory} mode="delete" onUpdated={handleUpdated} onDeleted={handleDeleted} onClose={() => setActionMode(null)} />
          ) : (
            <div className="flex justify-end">
              <button type="button" onClick={() => setActionMode("delete")} className="flex items-center gap-1.5 px-1 py-2 text-[11px] text-red-500/75 transition hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60" aria-label="思い出を削除">
                <Trash2 size={15} aria-hidden="true" /> 思い出を削除
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
