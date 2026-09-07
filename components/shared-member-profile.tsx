"use client";

import { ProfileLevelOverview } from "@/components/profile-level-overview";
import { ProfileRecordGrid } from "@/components/profile-record-grid";
import { SharedMemberAvatar } from "@/components/shared-member-identity";
import { profileProgressView } from "@/lib/profile-progress";
import type { GroupProfile } from "@/lib/supabase/group-profiles";

export function SharedMemberProfile({ member }: { member: GroupProfile; currentUserId: string }) {
  const isCurrentUser = false;
  const displayName = member.displayName;
  const { stats, levelProgress } = profileProgressView(member.progress);

  return (
    <>
      <section className="pt-4 text-center">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-coral">MEMBER PROFILE</p>
        <h1 className="mt-2 text-[25px] font-semibold tracking-[0.1em] text-ink">プロフィール</h1>
      </section>

      <section className="mt-7 px-1">
        <div className="mx-auto w-fit">
          <SharedMemberAvatar
            displayName={displayName}
            avatarUrl={member.avatarUrl}
            isCurrentUser={isCurrentUser}
            size="profile"
          />
        </div>
        <ProfileLevelOverview levelProgress={levelProgress} />
        <div className="mt-4 flex min-h-[58px] items-center justify-center px-4">
          <p className="min-w-0 max-w-full break-words py-1.5 text-center text-[28px] font-semibold leading-[1.3] tracking-[0.04em] text-coral">
            {displayName || "ユーザー名未設定"}<span className="ml-2 whitespace-nowrap text-sm font-semibold text-coral/70">Lv.{levelProgress.level}</span>
          </p>
        </div>
      </section>

      <div className="profile-record-divider mx-auto mt-8" aria-hidden="true" />
      <ProfileRecordGrid stats={stats} />
    </>
  );
}
