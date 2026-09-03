"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ImageIcon } from "lucide-react";

/** HEIC/HEIF originals can be saved even when the browser cannot decode them. */
export function MemoryPhoto({ src, alt, className = "", detailed = false, onAspectRatio }: {
  src: string;
  alt: string;
  className?: string;
  detailed?: boolean;
  onAspectRatio?: (aspectRatio: number) => void;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || failedSource === src) {
    return <div role="img" aria-label={`${alt}（写真のプレビューなし）`} className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-paper p-2 text-center text-[10px] leading-5 text-ink/60 ${className}`}><ImageIcon size={25} strokeWidth={1.4} className="text-coral" /><span>{detailed ? "この写真はプレビューできません" : "プレビューなし"}</span>{detailed && src && <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-coral underline">元の写真を開く</a>}{detailed && <span>HEIC・HEIFはブラウザによって表示できない場合があります。</span>}</div>;
  }
  return <img src={src} alt={alt} onLoad={(event) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) onAspectRatio?.(naturalWidth / naturalHeight);
  }} onError={() => setFailedSource(src)} className={className} />;
}
