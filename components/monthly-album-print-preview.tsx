"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { ChevronLeft, ChevronRight, FileDown, FileText, ImageDown } from "lucide-react";
import { MonthlyAlbumCoverPage, MonthlyAlbumMemoriesPage } from "./monthly-album-pages";
import { AlbumDownloadResult, useAlbumDownload } from "./album-download-result";
import { createAlbumPagesPdf, createAlbumPng, getMonthlyAlbumFilename, type AlbumExportPage } from "@/lib/album-pdf";
import { loadAlbumExportImage } from "@/lib/album-export-images";
import { DEFAULT_ALBUM_APPEARANCE } from "@/lib/album-appearance";
import { useMemories } from "@/lib/memories-context";
import { usePreferences } from "@/lib/preferences-context";
import { useProfileLevel } from "@/lib/profile-level-context";
import { createClient } from "@/lib/supabase/client";
import { loadMemoryOriginalUrls } from "@/lib/supabase/memories";

export function MonthlyAlbumPrintPreview({ month }: { month: string | null }) {
  const { getMonthMemories, isLoading, error, warning, isDemo, refreshMemories } = useMemories();
  const { accountAlbumAppearance, albumAppearanceReady } = usePreferences();
  const { recordActivity } = useProfileLevel();
  const [currentPage, setCurrentPage] = useState(0);
  const [preparing, setPreparing] = useState<"pdf" | "png" | null>(null);
  const [exportWidth, setExportWidth] = useState(310);
  const previewRoot = useRef<HTMLDivElement>(null);
  const download = useAlbumDownload();
  const [printError, setPrintError] = useState<string | null>(null);
  const [exportPage, setExportPage] = useState<{ index: number; urls: Map<string, string> } | null>(null);
  const exportController = useRef<AbortController | null>(null);
  const printingRef = useRef(false);
  const exportRoot = useRef<HTMLDivElement>(null);
  const memories = getMonthMemories(month ?? "");
  const appearance = accountAlbumAppearance ?? DEFAULT_ALBUM_APPEARANCE;
  const totalPages = 1 + Math.ceil(memories.length / 6);
  const activePage = Math.min(currentPage, totalPages - 1);

  useEffect(() => () => { exportController.current?.abort(); }, []);

  const renderPage = (index: number, imageUrls?: Map<string, string>) => {
    if (!month || !memories[0]) return null;
    const props = { month, appearance, imageUrls };
    return index === 0
      ? <MonthlyAlbumCoverPage {...props} memory={memories[0]} />
      : <MonthlyAlbumMemoriesPage {...props} memories={memories.slice((index - 1) * 6, index * 6)} pageNumber={index + 1} />;
  };

  const saveAlbum = async (format: "pdf" | "png") => {
    if (printingRef.current || !month) return;
    printingRef.current = true;
    setPreparing(format); setPrintError(null);
    setExportWidth(previewRoot.current?.getBoundingClientRect().width ?? 310);
    if (format === "pdf") recordActivity("printAttempts");
    const controller = new AbortController();
    exportController.current = controller;
    download.clear();
    // The generator retains at most one cover/photo page's original images.
    async function* preparePages(indices: number[]): AsyncGenerator<AlbumExportPage> {
      for (const index of indices) {
        const pageMemories = index === 0 ? memories.slice(0, 1) : memories.slice((index - 1) * 6, index * 6);
        const dataUrls = new Map<string, string>();
        try {
          if (controller.signal.aborted) throw new Error("保存を中止しました。");
          const urls = isDemo ? new Map(pageMemories.map((memory) => [memory.id, memory.imageUrl]))
            : await loadMemoryOriginalUrls(createClient(), pageMemories);
          for (const memory of pageMemories) {
            const url = urls.get(memory.id);
            if (!url) throw new Error("印刷用の写真が見つかりませんでした。");
            dataUrls.set(memory.id, await loadAlbumExportImage(url, controller.signal));
          }
          if (controller.signal.aborted) throw new Error("保存を中止しました。");
          // Commit only embedded images; remote originals never enter this DOM.
          flushSync(() => setExportPage({ index, urls: dataUrls }));
          const page = exportRoot.current?.querySelector<HTMLElement>(".monthly-paper");
          if (!page) throw new Error("保存するページを準備できませんでした。");
          yield { element: page, imageCount: pageMemories.length };
        } finally {
          // Runs after embedding, and also if fetching/rendering/embedding fails.
          if (!controller.signal.aborted) flushSync(() => setExportPage(null));
          dataUrls.clear();
        }
      }
    }
    try {
      let blob: Blob;
      if (format === "pdf") {
        const pages = preparePages(Array.from({ length: totalPages }, (_, index) => index));
        blob = await createAlbumPagesPdf(pages, appearance.orientation);
      } else {
        let image: Blob | undefined;
        for await (const { element: page, imageCount } of preparePages([activePage])) {
          image = await createAlbumPng(page, appearance.orientation, imageCount);
        }
        if (!image) throw new Error("保存するページが見つかりませんでした。");
        blob = image;
      }
      if (!controller.signal.aborted) download.save(blob, getMonthlyAlbumFilename(month, format === "png" ? activePage : undefined));
    } catch (cause) {
      if (!controller.signal.aborted) setPrintError(cause instanceof Error ? cause.message : "印刷ページを準備できませんでした。");
    } finally {
      printingRef.current = false;
      exportController.current = null;
      if (!controller.signal.aborted) { setExportPage(null); setPreparing(null); }
    }
  };

  const ready = Boolean(month) && !isLoading && !error && albumAppearanceReady && memories.length > 0;
  return <div className="monthly-print-preview">
    <header className="monthly-preview-heading">
      <p>MONTHLY PRINT</p>
      <h1>{month ? `${Number(month.slice(5))}月のアルバム` : "月間アルバム"}<span>印刷プレビュー</span></h1>
      {ready && <div className="monthly-page-info"><FileText size={16} />L判{appearance.orientation === "landscape" ? "横" : "縦"} / 全{totalPages}ページ</div>}
    </header>
    {!month ? <p role="alert" className="monthly-preview-message">月を選び直してください。</p>
      : isLoading || !albumAppearanceReady ? <p role="status" className="monthly-preview-message">アルバムを準備しています…</p>
      : error ? <p role="alert" className="monthly-preview-message">{error}<button type="button" onClick={() => void refreshMemories()} className="block text-coral underline">再読み込み</button></p>
      : memories.length === 0 ? <p className="monthly-preview-message">この月の思い出はまだありません。</p> : <>
        {warning && <p role="status" className="monthly-preview-message">{warning}</p>}
        <div ref={previewRoot} className="monthly-preview-stage">{renderPage(activePage)}</div>
        <nav className="monthly-page-navigation" aria-label="プレビューページ切替">
          <button type="button" aria-label="前のページ" disabled={Boolean(preparing) || activePage === 0} onClick={() => setCurrentPage(activePage - 1)}><ChevronLeft size={20} /></button>
          <span aria-live="polite" aria-atomic="true">{activePage + 1} / {totalPages}</span>
          <button type="button" aria-label="次のページ" disabled={Boolean(preparing) || activePage === totalPages - 1} onClick={() => setCurrentPage(activePage + 1)}><ChevronRight size={20} /></button>
        </nav>
        <nav className="monthly-thumbnails" aria-label="ページ一覧">{Array.from({ length: totalPages }, (_, index) =>
          <button type="button" key={index} disabled={Boolean(preparing)} aria-current={activePage === index ? "page" : undefined} onClick={() => setCurrentPage(index)}>
            <span className="monthly-thumbnail-paper" aria-hidden="true">{renderPage(index)}</span>
            <span>{index + 1}. {index === 0 ? "表紙" : "思い出のページ"}</span>
          </button>)}</nav>
      </>}
    <div className="monthly-print-actions">
      <Link href="/album?restore=1"><ChevronLeft size={18} />戻る</Link>
      <button type="button" disabled={!ready || Boolean(preparing)} onClick={() => void saveAlbum("pdf")}><FileDown size={17} />PDFで保存</button>
      <button type="button" disabled={!ready || Boolean(preparing)} onClick={() => void saveAlbum("png")} className="monthly-print-primary"><ImageDown size={17} />画像で保存</button>
    </div>
    <p className="monthly-print-help" role="status">{preparing ? (preparing === "pdf" ? "全ページのL判PDFを作成しています…" : "このページの画像を作成しています…") : "PDFは全ページ、画像は表示中の1ページを保存します。"}</p>
    <AlbumDownloadResult result={download.result} />
    {printError && <p role="alert" className="monthly-preview-message">{printError}</p>}
    {exportPage && createPortal(<div ref={exportRoot} className="monthly-export-output" style={{ width: exportWidth }} aria-hidden="true"><div className="monthly-export-sheet">{renderPage(exportPage.index, exportPage.urls)}</div></div>, document.body)}
  </div>;
}
