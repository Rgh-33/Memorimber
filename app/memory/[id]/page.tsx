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
import { createAlbumPdf, getAlbumPdfFilename } from "@/lib/album-pdf";
import { useMemories } from "@/lib/memories-context";
import { usePreferences } from "@/lib/preferences-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loadMemoryDetail, type MemoryDetail } from "@/lib/supabase/memories";
import { useTree } from "@/lib/tree-context";
import type { Memory } from "@/lib/types";

type LoadState = "idle" | "loading" | "loaded" | "not-found" | "error";

const ALBUM_PRINT_PAGE_STYLE_ID = "memory-album-print-page-size";

function applyAlbumPrintPageSize(orientation: "portrait" | "landscape") {
  const [width, height] = orientation === "landscape" ? [127, 89] : [89, 127];
  let style = document.getElementById(ALBUM_PRINT_PAGE_STYLE_ID) as HTMLStyleElement | null;

  if (!style) {
    style = document.createElement("style");
    style.id = ALBUM_PRINT_PAGE_STYLE_ID;
    style.media = "print";
    document.head.appendChild(style);
  }

  // An unnamed page rule is supported more consistently than CSS named pages,
  // especially by Safari and Firefox print preview.
  style.textContent = `@page { size: ${width}mm ${height}mm; margin: 0; }`;
  document.documentElement.dataset.albumPrintOrientation = orientation;
}

function compareMemories(a: Memory, b: Memory) {
  return a.date.localeCompare(b.date) || (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.id.localeCompare(b.id);
}

export default function MemoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { memories, getRelatedMemories, refreshMemories } = useMemories();
  const { albumAppearance: defaultAlbumAppearance } = usePreferences();
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
  const [draftMemory, setDraftMemory] = useState<Memory | null>(null);
  const [printPreparing, setPrintPreparing] = useState(false);
  const [browserPrintPreparing, setBrowserPrintPreparing] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const printPageRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    setActionMode(null);
    setDraftMemory(null);
    setPrintError(null);
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    pdfUrlRef.current = null;
    setPdfUrl(null);
    setPdfBlob(null);
  }, [params.id]);

  useEffect(() => () => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
  }, []);

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

  const renderedMemory = memory ? (draftMemory ?? memory) : null;
  const resolvedAppearance = renderedMemory?.albumAppearance ?? defaultAlbumAppearance;

  useEffect(() => {
    applyAlbumPrintPageSize(resolvedAppearance.orientation);

    return () => {
      document.getElementById(ALBUM_PRINT_PAGE_STYLE_ID)?.remove();
      delete document.documentElement.dataset.albumPrintOrientation;
    };
  }, [resolvedAppearance.orientation]);

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
    setDraftMemory(null);
    setActionMode(null);
    void refreshMemories();
    void fetchDetail(false);
  };

  const handleDeleted = () => {
    void refreshMemories();
    router.replace("/album");
    router.refresh();
  };

  const closeAction = () => {
    setActionMode(null);
    setDraftMemory(null);
  };

  const openEditor = () => {
    setDraftMemory(memory);
    setActionMode("edit");
  };

  const handlePrint = async () => {
    if (printPreparing) return;
    setPrintPreparing(true);
    setPrintError(null);
    try {
      const page = printPageRef.current?.querySelector<HTMLElement>(".memory-book-page");
      if (!page) throw new Error("アルバム紙面を見つけられませんでした。");
      const blob = await createAlbumPdf(page, resolvedAppearance.orientation);
      const url = URL.createObjectURL(blob);
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = url;
      setPdfUrl(url);
      setPdfBlob(blob);
    } catch (cause) {
      setPrintError(cause instanceof Error ? cause.message : "L判PDFを作成できませんでした。もう一度お試しください。");
    } finally {
      setPrintPreparing(false);
    }
  };

  const handleOpenPdf = async () => {
    if (!pdfBlob || !pdfUrl) return;
    const file = new File([pdfBlob], getAlbumPdfFilename(memory.date), { type: "application/pdf" });
    const shareData = { files: [file], title: "Memorinber L判アルバム" };

    if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(shareData))) {
      try {
        await navigator.share(shareData);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setPrintError("共有画面を開けませんでした。「PDFを開く」から印刷してください。");
      }
      return;
    }

    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const handleCancelPdf = () => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    pdfUrlRef.current = null;
    setPdfUrl(null);
    setPdfBlob(null);
    setPrintError(null);
    setPrintPreparing(false);
  };

  const handleBrowserPrint = async () => {
    if (browserPrintPreparing) return;
    setBrowserPrintPreparing(true);
    setPrintError(null);
    try {
      applyAlbumPrintPageSize(resolvedAppearance.orientation);
      const waitAtMost = async (promise: Promise<unknown>, milliseconds = 5000) => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          promise,
          new Promise<void>((resolve) => { timeout = setTimeout(resolve, milliseconds); }),
        ]);
        if (timeout) clearTimeout(timeout);
      };
      if (document.fonts) await waitAtMost(document.fonts.ready);
      const images = Array.from(printPageRef.current?.querySelectorAll("img") ?? []);
      await Promise.all(images.map(async (image) => {
        if (!image.complete) {
          await waitAtMost(new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }));
        }
        if (image.naturalWidth > 0) await image.decode().catch(() => undefined);
      }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      window.print();
    } finally {
      setBrowserPrintPreparing(false);
    }
  };

  const harvestWord = tree.harvestWordFor(memory.id);

  return (
    <div className="memory-detail-page page-pad">
      <div className="print-hide"><AppHeader /></div>

      <div className="print-hide mt-3 flex items-baseline gap-2.5 whitespace-nowrap">
        <p className="text-[10px] font-semibold tracking-[0.22em] text-coral">MEMORY PAGE</p>
        <span className="text-xs text-coral/45" aria-hidden="true">／</span>
        <h1 className="font-sans text-[20px] font-medium tracking-[0.04em] text-ink sm:text-[23px] sm:tracking-[0.07em]">思い出の1ページ</h1>
      </div>
      {sampleMemory && <p className="print-hide mt-2 text-xs text-ink/55">サンプルの思い出です</p>}
      {detail?.warning && <p role="status" className="print-hide mt-3 text-xs leading-5 text-ink/70">{detail.warning}<button type="button" onClick={() => void fetchDetail(false)} className="ml-2 text-coral underline">再読み込み</button></p>}

      <div ref={printPageRef} className={`memory-book-page-shell memory-book-page-shell--${resolvedAppearance.orientation} mt-3`}>
        <MemoryBookPage
          memory={renderedMemory ?? memory}
          appearance={resolvedAppearance}
          harvestWord={harvestWord}
          editControl={!prototypeMemory && detail ? (
            <button type="button" onClick={openEditor} className="memory-book-pencil" aria-label="思い出と手紙を編集" title="編集">
              <Pencil size={19} aria-hidden="true" />
            </button>
          ) : undefined}
        />
      </div>

      {!prototypeMemory && detail && actionMode === "edit" && (
        <div className="print-hide">
          <MemoryDetailActions
            key={`edit-${memory.id}`}
            memory={memory}
            mode="edit"
            onDraftChange={(draft) => setDraftMemory({ ...memory, ...draft })}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
            onClose={closeAction}
          />
        </div>
      )}

      <div className="print-hide mt-4 flex flex-wrap justify-end gap-2">
        <Link href={`/memory/${memory.id}/album-settings`} className="flex items-center gap-2 rounded-full border border-line bg-ivory px-3.5 py-2.5 text-xs font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-coral/45 hover:bg-paper hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40 focus-visible:ring-offset-2" aria-label="この思い出でアルバムの見た目を設定する">
          <Settings2 size={16} className="text-coral" aria-hidden="true" /> 見た目
        </Link>
        <button type="button" onClick={() => void handlePrint()} disabled={printPreparing} className="flex items-center gap-2 rounded-full border border-coral/45 bg-ivory px-3.5 py-2.5 text-xs font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-paper hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-55" aria-label="この思い出をPDFにして印刷する">
          <Printer size={16} className="text-coral" aria-hidden="true" /> {printPreparing ? "PDF作成中…" : "PDFで印刷"}
        </button>
        <button type="button" onClick={() => void handleBrowserPrint()} disabled={browserPrintPreparing} className="flex items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-2.5 text-xs font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-coral/45 hover:bg-ivory hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-55" aria-label="ブラウザの印刷画面を開く">
          <Printer size={16} className="text-ink/55" aria-hidden="true" /> {browserPrintPreparing ? "準備中…" : "通常印刷"}
        </button>
      </div>

      {pdfUrl && (
        <div role="status" className="print-hide mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-coral/30 bg-ivory px-4 py-3 text-xs leading-5 text-ink/70">
          <span>PDFができました。iPhoneでは「共有して印刷」から「プリント」を選択してください。</span>
          <span className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={() => void handleOpenPdf()} className="rounded-full bg-coral px-4 py-2 font-semibold text-white shadow-sm">共有して印刷</button>
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="rounded-full border border-coral/35 px-3 py-2 font-semibold text-ink">PDFを開く</a>
            <a href={pdfUrl} download={getAlbumPdfFilename(memory.date)} className="rounded-full border border-coral/35 px-3 py-2 font-semibold text-ink">保存</a>
            <button type="button" onClick={handleCancelPdf} className="rounded-full border border-line bg-paper px-3 py-2 font-semibold text-ink/65">キャンセル</button>
          </span>
        </div>
      )}
      {printError && <p role="alert" className="print-hide mt-3 rounded-xl border border-red-300/60 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">{printError}</p>}

      <nav aria-label="前後の思い出" className="print-hide mt-4 flex items-center justify-between border-t border-line pt-4 text-xs text-ink">
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
            <MemoryDetailActions key={`delete-${memory.id}`} memory={memory} mode="delete" onUpdated={handleUpdated} onDeleted={handleDeleted} onClose={closeAction} />
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
