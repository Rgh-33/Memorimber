"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Tag, Users } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MemoryCard } from "@/components/memory-card";
import { MemoryDetailActions } from "@/components/memory-detail-actions";
import { MemoryPhoto } from "@/components/memory-photo";
import { formatJapaneseDate, SAMPLE_MEMORIES } from "@/lib/data";
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
    void refreshMemories();
    void fetchDetail(false);
  };

  const handleDeleted = () => {
    void refreshMemories();
    router.replace("/album");
    router.refresh();
  };

  return (
    <div className="page-pad">
      <AppHeader />
      <h1 className="pt-7 text-center font-sans text-[25px] font-medium tracking-[0.1em] text-ink">思い出詳細</h1>
      {sampleMemory && <p className="mt-2 text-center text-xs text-ink/55">サンプルの思い出です</p>}
      {detail?.warning && <p role="status" className="mt-3 text-xs leading-5 text-ink/70">{detail.warning}<button type="button" onClick={() => void fetchDetail(false)} className="ml-2 text-coral underline">再読み込み</button></p>}

      <article className="mt-4">
        <div className="overflow-hidden rounded-xl border border-dashed border-coral/45 bg-ivory p-2">
          <div className="aspect-[4/3] overflow-hidden rounded-lg"><MemoryPhoto src={memory.imageUrl} alt={memory.caption} detailed className="h-full w-full object-cover" /></div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-ink/65"><CalendarDays size={16} className="text-ink" /> {formatJapaneseDate(memory.date)}</p>
        <h2 className="mt-3 text-[15px] font-medium leading-6 text-ink">{memory.caption}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {memory.people.map((person) => <span key={person} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] text-ink/65"><Users size={12} className="text-coral" /> {person}</span>)}
          {memory.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] text-ink/65"><Tag size={12} className="text-coral" /> {tag}</span>)}
        </div>
      </article>

      {!prototypeMemory && detail && <MemoryDetailActions memory={memory} onUpdated={handleUpdated} onDeleted={handleDeleted} />}

      <section className="mt-7">
        <h2 className="mb-3 text-sm font-medium text-ink">関連する思い出</h2>
        {related.length > 0 ? <div className="grid grid-cols-3 gap-2.5">{related.map((item) => <MemoryCard key={item.id} memory={item} compact />)}</div> : <div className="rounded-xl border border-dashed border-coral/35 px-4 py-5 text-center text-xs text-ink/45">近い思い出を、これから増やしていこう。</div>}
      </section>

      <nav aria-label="前後の思い出" className="mt-6 flex items-center justify-between border-t border-line pt-4 text-xs text-ink">
        {previousId ? <Link href={`/memory/${previousId}`} className="flex items-center gap-1"><ChevronLeft size={16} /> 前の思い出</Link> : <span />}
        <span className="h-5 w-px bg-ink/30" />
        {nextId ? <Link href={`/memory/${nextId}`} className="flex items-center gap-1">次の思い出 <ChevronRight size={16} /></Link> : <span />}
      </nav>
    </div>
  );
}
