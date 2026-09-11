"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, FileDown, FileText, ImageDown } from "lucide-react";
import { MonthlyAlbumCoverPage, MonthlyAlbumMemoriesPage } from "./monthly-album-pages";
import { AlbumDownloadResult, useAlbumDownload } from "./album-download-result";
import { createAlbumPagesPdf, createAlbumPng, getMonthlyAlbumFilename } from "@/lib/album-pdf";
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
  const [mounted, setMounted] = useState(false);
  const [preparing, setPreparing] = useState<"pdf" | "png" | null>(null);
  const [exportWidth, setExportWidth] = useState(310);
  const previewRoot = useRef<HTMLDivElement>(null);
  const download = useAlbumDownload();
  const [printError, setPrintError] = useState<string | null>(null);
  const [originalUrls, setOriginalUrls] = useState<Map<string, string>>();
  const printingRef = useRef(false);
  const exportRoot = useRef<HTMLDivElement>(null);
  const memories = getMonthMemories(month ?? "");
  const appearance = accountAlbumAppearance ?? DEFAULT_ALBUM_APPEARANCE;
  const totalPages = 1 + Math.ceil(memories.length / 6);
  const activePage = Math.min(currentPage, totalPages - 1);

  useEffect(() => { setMounted(true); }, []);

  const renderPage = (index: number, forExport = false) => {
    if (!month || !memories[0]) return null;
    const props = { month, appearance, imageUrls: forExport ? originalUrls : undefined };
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
    try {
      const urls = isDemo ? new Map(memories.map((memory) => [memory.id, memory.imageUrl]))
        : await loadMemoryOriginalUrls(createClient(), memories);
      setOriginalUrls(urls);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const root = exportRoot.current;
      if (!root) throw new Error("印刷ページを準備できませんでした。もう一度お試しください。");
      const pages = Array.from(root.querySelectorAll<HTMLElement>(".monthly-paper"));
      const page = pages[activePage];
      if (!page) throw new Error("保存するページが見つかりませんでした。");
      const blob = format === "pdf"
        ? await createAlbumPagesPdf(pages, appearance.orientation)
        : await createAlbumPng(page, appearance.orientation);
      download.save(blob, getMonthlyAlbumFilename(month, format === "png" ? activePage : undefined));
    } catch (cause) { setPrintError(cause instanceof Error ? cause.message : "印刷ページを準備できませんでした。"); }
    finally { printingRef.current = false; setPreparing(null); }
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
    {mounted && ready && createPortal(<div ref={exportRoot} className="monthly-export-output" style={{ width: exportWidth }} aria-hidden="true">{Array.from({ length: totalPages }, (_, index) => <div className="monthly-export-sheet" key={index}>{renderPage(index, true)}</div>)}</div>, document.body)}
  </div>;
}
