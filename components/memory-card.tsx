/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowUpRight, Heart } from "lucide-react";
import { formatShortDate } from "@/lib/data";
import { Memory } from "@/lib/types";

export function MemoryCard({ memory, compact = false }: { memory: Memory; compact?: boolean }) {
  return (
    <Link href={`/memory/${memory.id}`} className={`group block ${compact ? "" : "rounded-3xl bg-white p-2 shadow-card"}`}>
      <div className={`relative overflow-hidden rounded-2xl bg-paper ${compact ? "aspect-[4/3]" : "aspect-[4/3]"}`}>
        <img src={memory.imageUrl} alt={memory.caption} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-coral shadow-sm">
          <Heart size={14} fill="currentColor" />
        </span>
      </div>
      <div className={`${compact ? "pt-2" : "px-1 pb-1 pt-3"}`}>
        <p className="line-clamp-2 text-sm font-semibold leading-5 text-ink">{memory.caption}</p>
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-ink/50">
          <span>{formatShortDate(memory.date)}</span>
          <ArrowUpRight size={14} className="opacity-0 transition group-hover:opacity-100" />
        </div>
      </div>
    </Link>
  );
}
