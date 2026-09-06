"use client";

import Image from "next/image";
import { useState } from "react";
import { UsersRound } from "lucide-react";
import { useSharedGroupPresentation } from "@/components/shared-group-presentation";

type SharedGroupIconProps = {
  groupId: string;
  src?: string | null;
  alt?: string;
  size?: "small" | "large" | "profile";
  className?: string;
};

/** Group artwork with the familiar people glyph as its missing/broken-image fallback. */
export function SharedGroupIcon({ groupId, src, alt = "", size = "small", className = "" }: SharedGroupIconProps) {
  const { presentation } = useSharedGroupPresentation(groupId);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const profile = size === "profile";
  const large = size === "large" || profile;
  const source = src ?? presentation.iconDataUrl;
  const showImage = Boolean(source && failedSource !== source);
  const dimensions = profile ? "h-24 w-24" : large ? "h-14 w-14" : "h-9 w-9";

  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-coral/10 text-coral transition group-hover:bg-coral/15 ${dimensions} ${className}`}>
      {showImage ? (
        <Image
          src={source as string}
          alt={alt}
          fill
          sizes={profile ? "96px" : large ? "56px" : "36px"}
          className="object-cover"
          unoptimized
          priority={large}
          onError={() => setFailedSource(source as string)}
        />
      ) : (
        <UsersRound size={profile ? 45 : large ? 24 : 17} strokeWidth={profile ? 1.35 : 1.7} aria-hidden="true" />
      )}
    </span>
  );
}
