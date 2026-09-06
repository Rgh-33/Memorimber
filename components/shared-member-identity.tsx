"use client";

/* eslint-disable @next/next/no-img-element */

import { Crown, UserRound } from "lucide-react";
import { useProfileLevel } from "@/lib/profile-level-context";
import { useProfile } from "@/lib/profile-context";

type MemberIdentityProps = {
  displayName: string;
  avatarUrl?: string | null;
  level?: number;
  isOwner?: boolean;
  isCurrentUser?: boolean;
  size?: "list" | "profile";
};

export function SharedMemberAvatar({
  displayName,
  avatarUrl = null,
  isOwner = false,
  isCurrentUser = false,
  size = "list",
}: MemberIdentityProps) {
  const { avatarDataUrl } = useProfile();
  const resolvedAvatar = isCurrentUser ? avatarDataUrl : avatarUrl;

  const profileSize = size === "profile";

  return (
    <span className={`relative block shrink-0 ${profileSize ? "h-24 w-24" : "h-11 w-11"}`} aria-label={`${displayName}のプロフィール`}>
      <span className={`grid place-items-center overflow-hidden rounded-full border border-coral/25 bg-coral/10 text-coral shadow-sm ${profileSize ? "h-24 w-24 border-2 shadow-card ring-4 ring-coral/10" : "h-11 w-11"}`}>
        {resolvedAvatar ? (
          <img src={resolvedAvatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserRound size={profileSize ? 45 : 21} strokeWidth={1.55} aria-hidden="true" />
        )}
      </span>
      {isOwner ? (
        <span className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-amber-300/70 bg-ivory text-amber-500 shadow-sm" title="管理者">
          <Crown size={11} strokeWidth={2} aria-hidden="true" />
        </span>
      ) : null}
    </span>
  );
}

export function SharedMemberName({
  displayName,
  level = 1,
  isCurrentUser = false,
}: MemberIdentityProps) {
  const { levelProgress } = useProfileLevel();
  const resolvedLevel = isCurrentUser ? levelProgress.level : Math.max(1, Math.min(20, Math.trunc(level)));

  return (
    <>
      {displayName}{isCurrentUser ? "（あなた）" : ""}<span className="ml-1 whitespace-nowrap text-[0.82em] font-semibold text-coral/75">Lv.{resolvedLevel}</span>
    </>
  );
}
