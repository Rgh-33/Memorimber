import type { ReactNode } from "react";
import { MemoryPhoto } from "@/components/memory-photo";
import { MonthlyAlbumCaption } from "@/components/monthly-album-caption";
import type { AlbumAppearance } from "@/lib/album-appearance";
import { getMemoryDisplayUrl, type Memory } from "@/lib/types";

type PageProps = { month: string; appearance: AlbumAppearance; imageUrls?: Map<string, string> };

function BotanicalSprig({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 90 130" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <path d="M72 122C42 94 35 56 43 9M48 91C25 91 16 78 17 67C34 68 45 77 48 91ZM40 66C60 64 67 52 65 42C50 45 42 54 40 66ZM38 47C22 42 20 28 24 21C36 29 40 36 38 47ZM42 28C33 18 37 7 44 2C51 12 49 21 42 28ZM59 109C62 88 73 83 83 84C81 100 73 107 59 109Z" />
  </svg>;
}

function MonthlyAlbumPaper({ appearance, children, label }: { appearance: AlbumAppearance; children: ReactNode; label: string }) {
  return <article aria-label={label} className={`monthly-paper monthly-paper--${appearance.orientation} album-font-${appearance.font} album-text-${appearance.textColor} album-background-${appearance.background} album-pattern-${appearance.pattern}`}>
    <div className="monthly-paper-border" />
    <BotanicalSprig className="monthly-sprig monthly-sprig-top" />
    <BotanicalSprig className="monthly-sprig monthly-sprig-bottom" />
    {children}
    <span className="monthly-paper-note" aria-hidden="true">Happy<br />Days! ♡</span>
  </article>;
}

export function MonthlyAlbumCoverPage({ month, appearance, memory, imageUrls }: PageProps & { memory: Memory }) {
  const title = `${Number(month.slice(5))}月のアルバム`;
  return <MonthlyAlbumPaper appearance={appearance} label={`${title}の表紙`}>
    <div className="monthly-cover">
      <header><p className="monthly-paper-date">{month.slice(0, 4)}年{Number(month.slice(5))}月</p><h2>{title}</h2><p className="monthly-script">My Memories</p></header>
      <div className="monthly-photo-mount monthly-cover-photo"><MemoryPhoto src={imageUrls?.get(memory.id) ?? getMemoryDisplayUrl(memory)} alt={memory.caption} /></div>
      <MonthlyAlbumCaption className="monthly-cover-caption" text={memory.caption} />
      <p className="monthly-cover-signature">小さな日々を、一冊に。<span>MEMORIMBER</span></p>
    </div>
  </MonthlyAlbumPaper>;
}

export function MonthlyAlbumMemoriesPage({ month, appearance, memories, pageNumber, imageUrls }: PageProps & { memories: Memory[]; pageNumber: number }) {
  return <MonthlyAlbumPaper appearance={appearance} label={`思い出のページ ${pageNumber}`}>
    <div className="monthly-memories">
      <header><h2>{month.slice(0, 4)}年{Number(month.slice(5))}月の思い出</h2><p className="monthly-script">My Memories</p></header>
      <div className="monthly-photo-grid">{memories.map((memory) => <figure key={memory.id}>
        <div className="monthly-photo-mount"><MemoryPhoto src={imageUrls?.get(memory.id) ?? getMemoryDisplayUrl(memory)} alt={memory.caption} /></div>
        <figcaption><MonthlyAlbumCaption text={memory.caption} /><time dateTime={memory.date}>{Number(memory.date.slice(5, 7))}.{Number(memory.date.slice(8))}</time></figcaption>
      </figure>)}</div>
      <span className="monthly-paper-number">{pageNumber}</span>
    </div>
  </MonthlyAlbumPaper>;
}
