"use client";

import { useLayoutEffect, useRef } from "react";

/** Shrink the complete caption to its paper slot; never remove characters. */
export function MonthlyAlbumCaption({ text, className = "" }: { text: string; className?: string }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    const paragraph = textRef.current;
    if (!slot || !paragraph) return;
    let disposed = false;
    const fit = () => {
      if (disposed || !slot.clientWidth || !slot.clientHeight) return;
      let low = 0;
      let high = parseFloat(getComputedStyle(slot).fontSize);
      paragraph.style.fontSize = `${high}px`;
      const fits = () => paragraph.scrollWidth <= slot.clientWidth && paragraph.scrollHeight <= slot.clientHeight;
      if (fits()) return;
      for (let attempt = 0; attempt < 14; attempt += 1) {
        const size = (low + high) / 2;
        paragraph.style.fontSize = `${size}px`;
        if (fits()) low = size;
        else high = size;
      }
      paragraph.style.fontSize = `${low}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(slot);
    void document.fonts?.ready.then(fit);
    return () => { disposed = true; observer.disconnect(); };
  }, [text]);

  return <div ref={slotRef} className={`monthly-caption-slot ${className}`}><p ref={textRef}>{text}</p></div>;
}
