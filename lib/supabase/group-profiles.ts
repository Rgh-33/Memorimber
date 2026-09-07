import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./admin";
import { isOwnedProfileAvatarPath } from "@/lib/profile-avatar-path";
import { createEmptyProfileActivityStats } from "@/lib/profile-data";
import type { ProfileProgressSnapshot } from "@/lib/profile-progress";

export type GroupProfile = {
  userId: string; displayName: string; role: "owner" | "member"; joinedAt: string;
  avatarUrl: string | null; level: number; canEdit: false; progress: ProfileProgressSnapshot;
};
export async function getGroupProfiles(client: SupabaseClient, groupId: string, targetId?: string, signAvatars = true): Promise<GroupProfile[] | null> {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("server_group_profiles", { p_caller: user.id, p_group: groupId, p_target: targetId ?? null });
  if (error) throw new Error("メンバーを読み込めませんでした。");
  if (!data) return null;
  return Promise.all((data as (Omit<GroupProfile, "avatarUrl" | "level"> & { avatarPath: string | null })[]).map(async ({ avatarPath, ...row }) => {
    let avatarUrl: string | null = null;
    if (avatarPath && signAvatars && isOwnedProfileAvatarPath(row.userId, avatarPath)) {
      const signed = await admin.storage.from("profile-avatars").createSignedUrl(avatarPath, 3600);
      if (signed.error) throw new Error("メンバー画像を読み込めませんでした。");
      avatarUrl = signed.data?.signedUrl ?? null;
    }
    const stats = Object.fromEntries(Object.keys(createEmptyProfileActivityStats()).map((metric) => [metric, row.progress.stats[metric as keyof typeof row.progress.stats] ?? 0]));
    return { ...row, progress: { ...row.progress, stats }, avatarUrl, level: row.progress.achievedLevel };
  }));
}
