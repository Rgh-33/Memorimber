/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatShortDate } from "@/lib/data";
import { Memory } from "@/lib/types";

export function MemoryCard({ memory, compact = false, dateOnly = false }: { memory: Memory; compact?: boolean; dateOnly?: boolean }) {
  if (dateOnly) {
    return (
      <Link href={`/memory/${memory.id}`} className="group block rounded-lg border border-dashed border-coral/35 bg-white p-1.5 transition hover:-translate-y-0.5 hover:border-coral hover:shadow-card">
        <div className="aspect-square overflow-hidden rounded-md bg-paper">
          <img src={memory.imageUrl} alt={memory.caption} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        </div>
        <p className="pb-0.5 pt-1.5 text-center text-[10px] font-medium text-ink/60">{formatShortDate(memory.date)}</p>
      </Link>
    );
  }

  if (compact) {
    return (
      <Link href={`/memory/${memory.id}`} className="group block rounded-lg border border-dashed border-coral/35 bg-white p-1.5 transition hover:border-coral">
        <div className="aspect-square overflow-hidden rounded-md bg-paper">
          <img src={memory.imageUrl} alt={memory.caption} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/memory/${memory.id}`} className="group block rounded-2xl border border-line bg-white p-2 shadow-sm">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-paper">
        <img src={memory.imageUrl} alt={memory.caption} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      </div>
      <div className="px-1 pb-1 pt-3">
        <p className="line-clamp-2 text-sm font-semibold leading-5 text-ink">{memory.caption}</p>
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-ink/50">
          <span>{formatShortDate(memory.date)}</span>
          <ArrowUpRight size={14} className="opacity-0 transition group-hover:opacity-100" />
        </div>
      </div>
    </Link>
  );
}
