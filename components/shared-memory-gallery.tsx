"use client";

import Link from "next/link";
import { MemoryPhoto } from "@/components/memory-photo";
import { SharedMemoryMenu } from "@/components/shared-memory-menu";
import { useSharedGroupPresentation } from "@/components/shared-group-presentation";
import { formatShortDate } from "@/lib/data";
import type { SharedAlbumMemoryEntry } from "@/lib/supabase/shared-albums";
import { getMemoryDisplayUrl } from "@/lib/types";

type SharedMemoryGalleryProps = {
  groupId: string;
  entries: SharedAlbumMemoryEntry[];
  userId: string;
  isOwner: boolean;
};

export function SharedMemoryGallery({ groupId, entries, userId, isOwner }: SharedMemoryGalleryProps) {
  const { presentation } = useSharedGroupPresentation(groupId);
  const photoOnly = !presentation.showCaption && !presentation.showDate;

  return (
    <ol className={`mt-3 grid ${photoOnly ? "grid-cols-3 gap-2" : "grid-cols-2 gap-3"}`}>
      {entries.map((entry) => {
        const canRemove = isOwner || entry.addedBy === userId;
        return (
          <li key={entry.memory.id} className={`relative min-w-0 ${photoOnly ? "" : "rounded-2xl bg-paper shadow-sm"}`}>
            <Link href={`/shared-groups/${groupId}/memories/${entry.memory.id}`} className="group block overflow-hidden rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral">
              <div className="aspect-square overflow-hidden bg-ivory">
                <MemoryPhoto src={getMemoryDisplayUrl(entry.memory)} alt={entry.memory.caption} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              </div>
              {!photoOnly ? (
                <div className="min-h-12 px-3 py-2.5">
                  {presentation.showCaption ? <p className="line-clamp-2 text-xs font-semibold leading-5 text-ink">{entry.memory.caption}</p> : null}
                  {presentation.showDate ? <p className={`${presentation.showCaption ? "mt-1" : ""} text-[10px] text-ink/50`}>{formatShortDate(entry.memory.date)}</p> : null}
                </div>
              ) : null}
            </Link>
            {canRemove ? <div className="absolute right-1 top-1 z-20"><SharedMemoryMenu groupId={groupId} memoryId={entry.memory.id} caption={entry.memory.caption} /></div> : null}
          </li>
        );
      })}
    </ol>
  );
}
