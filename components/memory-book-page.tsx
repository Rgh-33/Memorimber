"use client";

import { type ReactNode, useState } from "react";
import { MemoryPhoto } from "@/components/memory-photo";
import type { AlbumAppearance } from "@/lib/album-appearance";
import { formatJapaneseDate } from "@/lib/data";
import type { Memory } from "@/lib/types";

export function MemoryBookPage({
  memory,
  appearance,
  editControl,
  harvestWord,
}: {
  memory: Memory;
  appearance: AlbumAppearance;
  editControl?: ReactNode;
  harvestWord?: string | null;
}) {
  const [photoLayout, setPhotoLayout] = useState({ src: "", aspectRatio: 4 / 3 });
  const letter = memory.letter?.trim() ?? "";
  const letterLength = [...letter].length;
  const savedHarvestWord = harvestWord?.trim() ?? "";
  const harvestWordLength = [...savedHarvestWord].length;
  const photoAspectRatio = photoLayout.src === memory.imageUrl ? photoLayout.aspectRatio : 4 / 3;
  const isLandscape = appearance.orientation === "landscape";
  const photoScale = isLandscape
    ? (letterLength > 220 ? 28 : letter ? 33 : 39)
    : (letterLength > 220 ? 62 : letter ? 70 : 82);
  const maximumWidth = isLandscape
    ? (letterLength > 220 ? 72 : letter ? 82 : 90)
    : (letterLength > 220 ? 80 : letter ? 90 : 100);
  const photoFrameWidth = Math.round(Math.min(maximumWidth, Math.max(30, photoAspectRatio * photoScale)) * 10) / 10;
  const pageClasses = [
    "memory-book-page",
    `album-font-${appearance.font}`,
    `album-layout-${appearance.layout}`,
    `album-text-${appearance.textColor}`,
    `album-background-${appearance.background}`,
    `album-pattern-${appearance.pattern}`,
    `album-orientation-${appearance.orientation}`,
    letter ? "memory-book-page--has-letter" : "",
    letterLength > 220 ? "memory-book-page--long-letter" : "",
    savedHarvestWord ? "memory-book-page--has-harvest-word" : "",
  ].filter(Boolean).join(" ");

  return (
    <article className={pageClasses} aria-label={`${formatJapaneseDate(memory.date)}の思い出`}>
      <div className="memory-book-page-inner">
        {editControl && <div className="memory-book-edit-control print-hide">{editControl}</div>}

        <div className="memory-book-photo-frame" style={{ width: `${photoFrameWidth}%` }}>
          <MemoryPhoto
            src={memory.imageUrl}
            alt={memory.caption}
            detailed
            className="memory-book-photo"
            onAspectRatio={(aspectRatio) => setPhotoLayout((current) => (
              current.src === memory.imageUrl && current.aspectRatio === aspectRatio
                ? current
                : { src: memory.imageUrl, aspectRatio }
            ))}
          />
          {savedHarvestWord && (
            <div className="memory-book-harvest-word" role="note" aria-label={`思い出の木から収穫した言葉「${savedHarvestWord}」`}>
              <span className="memory-book-harvest-text" data-long={harvestWordLength > 8 || undefined}>{savedHarvestWord}</span>
              <svg className="memory-book-harvest-flourish" viewBox="0 0 48 38" aria-hidden="true">
                <path d="M5 34 C17 29 27 23 38 11" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                <path d="M25 23 C25 13 31 6 41 4 C41 14 35 21 25 23 Z M31 25 C39 20 45 22 47 29 C40 32 35 30 31 25 Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          )}
          <svg className="memory-book-frame-doodle" viewBox="0 0 320 34" preserveAspectRatio="none" aria-hidden="true">
            <path d="M3 22 C38 9 66 28 101 16 C137 4 165 27 201 16 C237 5 269 24 317 10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.35" vectorEffect="non-scaling-stroke" />
            <path d="M69 20 C61 14 59 8 61 3 C68 7 72 12 69 20 Z M235 16 C242 10 247 5 254 5 C252 13 246 17 235 16 Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.35" vectorEffect="non-scaling-stroke" />
            <path d="M278 18 l3 5 5 2-5 2-3 5-2-5-5-2 5-2 Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.35" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>

        <div className="memory-book-copy">
          <div className="memory-book-copy-heading">
            <p className="memory-book-date">{formatJapaneseDate(memory.date)}</p>
          </div>
          <h2 className={`memory-book-caption${memory.caption.length > 44 ? " memory-book-caption--long" : ""}`}>{memory.caption}</h2>
        </div>

        {(memory.people.length > 0 || memory.tags.length > 0) && (
          <div className="memory-book-meta" aria-label="思い出の人物とタグ">
            {memory.people.length > 0 && <p className="memory-book-people">with&nbsp;&nbsp;{memory.people.join(" ・ ")}</p>}
            {memory.tags.length > 0 && <div className="memory-book-tags">{memory.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
          </div>
        )}

        {letter && (
          <div className={`memory-book-letter${letterLength > 220 ? " memory-book-letter--long" : ""}`}>
            <p>{letter}</p>
          </div>
        )}

        <svg className="memory-book-corner-doodle" viewBox="0 0 180 92" aria-hidden="true">
          <path d="M3 88 C37 75 52 54 69 31 C83 12 103 18 112 39 C123 65 145 66 178 39" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          <path d="M50 56 C37 53 30 45 28 35 C41 36 50 43 50 56 Z M74 25 C68 16 69 8 74 2 C81 10 81 18 74 25 Z M119 50 C128 39 137 36 146 39 C140 49 132 54 119 50 Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          <circle cx="159" cy="51" r="4" fill="none" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          <path d="M159 43 v-7 M159 66 v-7 M151 51 h-7 M174 51 h-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        </svg>

        <p className="memory-book-signature" aria-hidden="true">MEMORINBER</p>
      </div>
    </article>
  );
}
