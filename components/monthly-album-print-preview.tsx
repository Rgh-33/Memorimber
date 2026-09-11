"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, FileDown, FileText, Printer } from "lucide-react";
import { MonthlyAlbumCoverPage, MonthlyAlbumMemoriesPage } from "./monthly-album-pages";
import { DEFAULT_ALBUM_APPEARANCE } from "@/lib/album-appearance";
import { useMemories } from "@/lib/memories-context";
import { usePreferences } from "@/lib/preferences-context";
import { useProfileLevel } from "@/lib/profile-level-context";
import { createClient } from "@/lib/supabase/client";
import { loadMemoryOriginalUrls } from "@/lib/supabase/memories";

async function waitForPrintImage(image: HTMLImageElement) {
  if (image.complete) return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); image.removeEventListener("load", finish); image.removeEventListener("error", finish); };
    const finish = () => { cleanup(); resolve(); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("写真の読み込みに時間がかかっています。少し待ってからもう一度お試しください。")); }, 10000);
    image.addEventListener("load", finish);
    image.addEventListener("error", finish);
  });
}

export function MonthlyAlbumPrintPreview({ month }: { month: string | null }) {
  const { getMonthMemories, isLoading, error, warning, isDemo, refreshMemories } = useMemories();
  const { accountAlbumAppearance, albumAppearanceReady } = usePreferences();
  const { recordActivity } = useProfileLevel();
  const [currentPage, setCurrentPage] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [originalUrls, setOriginalUrls] = useState<Map<string, string>>();
  const printingRef = useRef(false);
  const printRoot = useRef<HTMLDivElement>(null);
  const memories = getMonthMemories(month ?? "");
  const appearance = accountAlbumAppearance ?? DEFAULT_ALBUM_APPEARANCE;
  const totalPages = 1 + Math.ceil(memories.length / 6);
  const activePage = Math.min(currentPage, totalPages - 1);

  useEffect(() => { setMounted(true); }, []);

  const renderPage = (index: number, forPrint = false) => {
    if (!month || !memories[0]) return null;
    const props = { month, appearance, imageUrls: forPrint ? originalUrls : undefined };
    return index === 0
      ? <MonthlyAlbumCoverPage {...props} memory={memories[0]} />
      : <MonthlyAlbumMemoriesPage {...props} memories={memories.slice((index - 1) * 6, index * 6)} pageNumber={index + 1} />;
  };

  const printAlbum = async () => {
    if (printingRef.current) return;
    printingRef.current = true;
    setPreparing(true); setPrintError(null);
    recordActivity("printAttempts");
    try {
      const urls = isDemo ? new Map(memories.map((memory) => [memory.id, memory.imageUrl]))
        : await loadMemoryOriginalUrls(createClient(), memories);
      setOriginalUrls(urls);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const root = printRoot.current;
      if (!root) throw new Error("印刷ページを準備できませんでした。もう一度お試しください。");
      await Promise.all(Array.from(root.querySelectorAll("img")).map(waitForPrintImage));
      await document.fonts.ready;
      window.print();
    } catch (cause) { setPrintError(cause instanceof Error ? cause.message : "印刷ページを準備できませんでした。"); }
    finally { printingRef.current = false; setPreparing(false); }
  };

  const ready = Boolean(month) && !isLoading && !error && albumAppearanceReady && memories.length > 0;
  return <div className="monthly-print-preview">
    <header className="monthly-preview-heading">
      <p>MONTHLY PRINT</p>
      <h1>{month ? `${Number(month.slice(5))}月のアルバム` : "月間アルバム"}<span>印刷プレビュー</span></h1>
      {ready && <div className="monthly-page-info"><FileText size={16} />A4縦 / 全{totalPages}ページ</div>}
    </header>
    {!month ? <p role="alert" className="monthly-preview-message">月を選び直してください。</p>
      : isLoading || !albumAppearanceReady ? <p role="status" className="monthly-preview-message">アルバムを準備しています…</p>
      : error ? <p role="alert" className="monthly-preview-message">{error}<button type="button" onClick={() => void refreshMemories()} className="block text-coral underline">再読み込み</button></p>
      : memories.length === 0 ? <p className="monthly-preview-message">この月の思い出はまだありません。</p> : <>
        {warning && <p role="status" className="monthly-preview-message">{warning}</p>}
        <div className="monthly-preview-stage">{renderPage(activePage)}</div>
        <nav className="monthly-page-navigation" aria-label="プレビューページ切替">
          <button type="button" aria-label="前のページ" disabled={activePage === 0} onClick={() => setCurrentPage(activePage - 1)}><ChevronLeft size={20} /></button>
          <span aria-live="polite" aria-atomic="true">{activePage + 1} / {totalPages}</span>
          <button type="button" aria-label="次のページ" disabled={activePage === totalPages - 1} onClick={() => setCurrentPage(activePage + 1)}><ChevronRight size={20} /></button>
        </nav>
        <nav className="monthly-thumbnails" aria-label="ページ一覧">{Array.from({ length: totalPages }, (_, index) =>
          <button type="button" key={index} aria-current={activePage === index ? "page" : undefined} onClick={() => setCurrentPage(index)}>
            <span className="monthly-thumbnail-paper" aria-hidden="true">{renderPage(index)}</span>
            <span>{index + 1}. {index === 0 ? "表紙" : "思い出のページ"}</span>
          </button>)}</nav>
      </>}
    <div className="monthly-print-actions">
      <Link href="/album?restore=1"><ChevronLeft size={18} />戻る</Link>
      <button type="button" disabled={!ready || preparing} onClick={() => void printAlbum()}><FileDown size={17} />PDFで保存</button>
      <button type="button" disabled={!ready || preparing} onClick={() => void printAlbum()} className="monthly-print-primary"><Printer size={17} />印刷する</button>
    </div>
    <p className="monthly-print-help" role="status">{preparing ? "印刷用の元画像を準備しています…" : "PDFは印刷画面の保存・共有メニューから保存できます。"}</p>
    {printError && <p role="alert" className="monthly-preview-message">{printError}</p>}
    {mounted && ready && createPortal(<div ref={printRoot} className="monthly-print-output" aria-hidden="true">{Array.from({ length: totalPages }, (_, index) => <div className="monthly-print-sheet" key={index}>{renderPage(index, true)}</div>)}</div>, document.body)}
  </div>;
}
