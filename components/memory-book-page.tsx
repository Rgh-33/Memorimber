"use client";

import { type ReactNode, useState } from "react";
import { MemoryPhoto } from "@/components/memory-photo";
import { formatJapaneseDate } from "@/lib/data";
import { usePreferences } from "@/lib/preferences-context";
import type { Memory } from "@/lib/types";

export function MemoryBookPage({
  memory,
  editControl,
  preview = false,
  previewLetter = "",
}: {
  memory: Memory;
  editControl?: ReactNode;
  preview?: boolean;
  previewLetter?: string;
}) {
  const { albumFont, albumLayout, albumTextColor, albumBackground, albumPattern } = usePreferences();
  const [photoLayout, setPhotoLayout] = useState({ src: "", aspectRatio: 4 / 3 });
  const savedLetter = memory.letter?.trim() ?? "";
  const letter = savedLetter || previewLetter.trim();
  const letterLength = [...letter].length;
  const photoAspectRatio = photoLayout.src === memory.imageUrl ? photoLayout.aspectRatio : 4 / 3;
  const photoScale = preview ? (letter ? 58 : 72) : letterLength > 220 ? 62 : letter ? 70 : 82;
  const maximumWidth = preview ? (letter ? 78 : 92) : letterLength > 220 ? 80 : letter ? 90 : 100;
  const photoFrameWidth = Math.round(Math.min(maximumWidth, Math.max(30, photoAspectRatio * photoScale)) * 10) / 10;
  const pageClasses = [
    "memory-book-page",
    `album-font-${albumFont}`,
    `album-layout-${albumLayout}`,
    `album-text-${albumTextColor}`,
    `album-background-${albumBackground}`,
    `album-pattern-${albumPattern}`,
    letter ? "memory-book-page--has-letter" : "",
    letterLength > 220 ? "memory-book-page--long-letter" : "",
    preview ? "memory-book-page--preview" : "",
  ].filter(Boolean).join(" ");

  return (
    <article className={pageClasses} aria-label={`${formatJapaneseDate(memory.date)}の思い出`}>
      <div className="memory-book-page-inner">
        {editControl && <div className="memory-book-edit-control print-hide">{editControl}</div>}

        <div className="memory-book-photo-frame" style={{ width: `${photoFrameWidth}%` }}>
          <MemoryPhoto
            src={memory.imageUrl}
            alt={memory.caption}
            detailed={!preview}
            className="memory-book-photo"
            onAspectRatio={(aspectRatio) => setPhotoLayout((current) => (
              current.src === memory.imageUrl && current.aspectRatio === aspectRatio
                ? current
                : { src: memory.imageUrl, aspectRatio }
            ))}
          />
          <svg className="memory-book-frame-doodle" viewBox="0 0 320 34" preserveAspectRatio="none" aria-hidden="true">
            <path d="M3 22 C38 9 66 28 101 16 C137 4 165 27 201 16 C237 5 269 24 317 10" />
            <path d="M69 20 C61 14 59 8 61 3 C68 7 72 12 69 20 Z M235 16 C242 10 247 5 254 5 C252 13 246 17 235 16 Z" />
            <path d="M278 18 l3 5 5 2-5 2-3 5-2-5-5-2 5-2 Z" />
          </svg>
        </div>

        <div className="memory-book-copy">
          <p className="memory-book-date">{formatJapaneseDate(memory.date)}</p>
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
          <path d="M3 88 C37 75 52 54 69 31 C83 12 103 18 112 39 C123 65 145 66 178 39" />
          <path d="M50 56 C37 53 30 45 28 35 C41 36 50 43 50 56 Z M74 25 C68 16 69 8 74 2 C81 10 81 18 74 25 Z M119 50 C128 39 137 36 146 39 C140 49 132 54 119 50 Z" />
          <circle cx="159" cy="51" r="4" />
          <path d="M159 43 v-7 M159 66 v-7 M151 51 h-7 M174 51 h-7" />
        </svg>

        <p className="memory-book-signature" aria-hidden="true">MEMORINBER</p>
      </div>
    </article>
  );
}
