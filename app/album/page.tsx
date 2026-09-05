"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { MemoryCard } from "@/components/memory-card";
import { getAlbumGridSlotCount } from "@/lib/album-grid";
import { ALBUM_MONTHS } from "@/lib/data";
import { useMemories } from "@/lib/memories-context";
import { createClient } from "@/lib/supabase/client";
import { loadMemoryOriginalUrls } from "@/lib/supabase/memories";

const ALBUM_RETURN_POSITION_KEY = "memorimber-album-return-position-v1";

type AlbumReturnPosition = { month: string; scrollY: number };

function readAlbumReturnPosition(): AlbumReturnPosition | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(ALBUM_RETURN_POSITION_KEY) ?? "null") as Partial<AlbumReturnPosition> | null;
    if (!value || typeof value.month !== "string" || !/^\d{4}-\d{2}$/.test(value.month)
      || typeof value.scrollY !== "number" || !Number.isFinite(value.scrollY) || value.scrollY < 0) return null;
    return { month: value.month, scrollY: value.scrollY };
  } catch {
    return null;
  }
}

function scrollAlbumImmediately(scroll: () => void) {
  const previous = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = "auto";
  scroll();
  document.documentElement.style.scrollBehavior = previous;
}

export default function AlbumPage() {
  const { memories: allMemories, getMonthMemories, isLoading, error, warning, isDemo, refreshMemories } = useMemories();
  const [currentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [scrollRestoreReady, setScrollRestoreReady] = useState(false);
  const [printImageUrls, setPrintImageUrls] = useState<Map<string, string> | null>(null);
  const [printPreparing, setPrintPreparing] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const memoryGridRef = useRef<HTMLElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const didPrepareScrollRestore = useRef(false);
  const returnPositionRef = useRef<AlbumReturnPosition | null>(null);
  const months = useMemo(() => [...new Set([
    currentMonth, ...allMemories.map((memory) => memory.date.slice(0, 7)),
    ...(isDemo ? ALBUM_MONTHS.map((month) => month.key) : []),
  ])].sort().reverse(), [allMemories, isDemo, currentMonth]);
  const monthIndex = months.indexOf(selectedMonth);
  const monthLabel = `${Number(selectedMonth.slice(0, 4))}年${Number(selectedMonth.slice(5))}月`;
  const memories = getMonthMemories(selectedMonth);
  const monthCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const memory of allMemories) {
      const month = memory.date.slice(0, 7);
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }
    return months.map((month) => counts.get(month) ?? 0);
  }, [allMemories, months]);
  const gridSlotCount = getAlbumGridSlotCount(monthCounts);
  const placeholderCount = Math.max(0, gridSlotCount - memories.length);

  useEffect(() => {
    if (didPrepareScrollRestore.current) return;
    didPrepareScrollRestore.current = true;
    const url = new URL(window.location.href);
    const shouldRestore = url.searchParams.get("restore") === "1";
    const saved = shouldRestore ? readAlbumReturnPosition() : null;
    returnPositionRef.current = saved;
    if (saved) setSelectedMonth(saved.month);
    try {
      if (!shouldRestore) sessionStorage.removeItem(ALBUM_RETURN_POSITION_KEY);
      if (shouldRestore) {
        url.searchParams.delete("restore");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    } catch { /* The requested scroll behavior still works for this render. */ }
    setScrollRestoreReady(true);
  }, []);

  useEffect(() => {
    if (isLoading || !scrollRestoreReady || didInitialScroll.current) return;
    didInitialScroll.current = true;
    let secondFrame: number | null = null;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const saved = returnPositionRef.current;
        if (saved) {
          scrollAlbumImmediately(() => window.scrollTo({ top: saved.scrollY, behavior: "auto" }));
          try { sessionStorage.removeItem(ALBUM_RETURN_POSITION_KEY); } catch { /* Native scroll restoration remains available. */ }
          returnPositionRef.current = null;
        } else {
          scrollAlbumImmediately(() => bottomRef.current?.scrollIntoView({ block: "end" }));
        }
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
    };
  }, [isLoading, scrollRestoreReady, selectedMonth]);

  useEffect(() => {
    setPrintImageUrls(null);
  }, [selectedMonth]);

  useEffect(() => {
    const clearPrintImages = () => setPrintImageUrls(null);
    window.addEventListener("afterprint", clearPrintImages);
    return () => window.removeEventListener("afterprint", clearPrintImages);
  }, []);

  const handlePrint = async () => {
    if (printPreparing) return;
    setPrintPreparing(true);
    setPrintError(null);
    try {
      const originals = isDemo
        ? new Map(memories.map((memory) => [memory.id, memory.imageUrl]))
        : await loadMemoryOriginalUrls(createClient(), memories);
      setPrintImageUrls(originals);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const waitAtMost = async (promise: Promise<unknown>, milliseconds = 5000) => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          promise,
          new Promise<void>((resolve) => { timeout = setTimeout(resolve, milliseconds); }),
        ]);
        if (timeout) clearTimeout(timeout);
      };
      const images = Array.from(memoryGridRef.current?.querySelectorAll("img") ?? []);
      await Promise.all(images.map(async (image) => {
        if (!image.complete) {
          await waitAtMost(new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }));
        }
        if (image.naturalWidth > 0) await image.decode().catch(() => undefined);
      }));
      window.print();
    } catch (cause) {
      setPrintImageUrls(null);
      setPrintError(cause instanceof Error ? cause.message : "印刷用の元画像を読み込めませんでした。");
    } finally {
      setPrintPreparing(false);
    }
  };

  const rememberAlbumPosition = () => {
    try {
      sessionStorage.setItem(ALBUM_RETURN_POSITION_KEY, JSON.stringify({ month: selectedMonth, scrollY: window.scrollY }));
    } catch { /* Browser history can still restore the nearest available position. */ }
  };

  const placeholders = Array.from({ length: placeholderCount }, (_, index) => (
    <div key={`album-placeholder-${index}`} className="invisible rounded-lg border border-transparent p-1.5" aria-hidden="true">
      <div className="aspect-square" />
      <p className="pb-0.5 pt-1.5 text-[10px]">&nbsp;</p>
    </div>
  ));

  return (
    <div className="album-page page-pad">
      <section className="pt-7 text-center">
        <h1 className="font-sans text-[25px] font-medium tracking-[0.1em] text-ink">月間アルバム</h1>
      </section>

      <section ref={memoryGridRef} className="album-page-memory-slot mt-5">
        {isDemo && <p className="mb-3 text-center text-xs text-ink/55">サンプルの思い出を表示しています</p>}
        {warning && <p role="status" className="mb-3 text-xs leading-5 text-ink/70">{warning}<button type="button" onClick={() => void refreshMemories()} className="ml-2 text-coral underline">再読み込み</button></p>}
        {isLoading ? <p role="status" className="py-12 text-center text-sm text-ink/65">思い出を読み込んでいます…</p> : error ? <div role="alert" className="rounded-xl border border-line p-4 text-sm leading-6 text-ink">{error}<button type="button" onClick={() => void refreshMemories()} className="mt-2 block text-coral underline">再読み込み</button></div> : memories.length > 0 ? (
          <div className="grid grid-cols-3 gap-2.5">
            {placeholders}
            {memories.map((memory) => <div key={memory.id} onClickCapture={rememberAlbumPosition}>
              <MemoryCard memory={memory} dateOnly imageUrl={printImageUrls?.get(memory.id)} />
            </div>)}
          </div>
        ) : (
          <div className="relative grid grid-cols-3 gap-2.5">
            {placeholders}
            <div className="absolute inset-x-0 bottom-0 rounded-2xl border border-dashed border-coral/45 bg-paper px-5 py-12 text-center text-sm text-ink/55">この月の思い出はまだありません</div>
          </div>
        )}
      </section>

      <button type="button" onClick={() => void handlePrint()} disabled={printPreparing || memories.length === 0} className="mt-5 flex w-full items-center justify-center gap-3 rounded-lg border border-coral/65 bg-ivory px-4 py-3 text-sm font-medium tracking-[0.04em] text-ink transition hover:bg-paper disabled:cursor-wait disabled:opacity-55 print-hide"><Printer size={18} /> {printPreparing ? "元画像を準備中…" : `${Number(selectedMonth.slice(5))}月をプリントする`}</button>
      {printError && <p role="alert" className="mt-3 rounded-xl border border-red-300/60 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700 print-hide">{printError}</p>}

      <div ref={bottomRef} className="album-month-switcher print-hide">
        <div className="mx-auto flex max-w-[270px] items-center justify-between">
          <button type="button" onClick={() => setSelectedMonth(months[monthIndex + 1])} className="rounded-full p-2 text-ink hover:bg-paper disabled:opacity-20" disabled={monthIndex === months.length - 1} aria-label="前の月"><ChevronLeft size={19} /></button>
          <p className="text-lg font-medium tracking-[0.05em] text-ink">{monthLabel}</p>
          <button type="button" onClick={() => setSelectedMonth(months[monthIndex - 1])} className="rounded-full p-2 text-ink hover:bg-paper disabled:opacity-20" disabled={monthIndex === 0} aria-label="次の月"><ChevronRight size={19} /></button>
        </div>
        <p className="mt-1 text-center text-xs text-ink/65">今月は <span className="text-xl font-semibold text-coral">{memories.length}</span> の思い出</p>
      </div>
    </div>
  );
}
