import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmptyProfileActivityStats } from "@/lib/profile-data";
import type { ProfileProgressSnapshot } from "@/lib/profile-progress";

export type GroupProfile = {
  userId: string; displayName: string; role: "owner" | "member"; joinedAt: string;
  avatarUrl: string | null; level: number; canEdit: false; progress: ProfileProgressSnapshot;
};
export async function getGroupProfiles(client: SupabaseClient, groupId: string, targetId?: string, includeAvatars = true): Promise<GroupProfile[] | null> {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client.rpc("get_shared_group_profiles", { p_group: groupId, p_target: targetId ?? null });
  if (error) throw new Error("メンバーを読み込めませんでした。");
  if (!data) return null;
  return (data as Omit<GroupProfile, "level">[]).map((row) => {
    const stats = Object.fromEntries(Object.keys(createEmptyProfileActivityStats()).map((metric) => [metric, row.progress.stats[metric as keyof typeof row.progress.stats] ?? 0]));
    return {
      userId: row.userId, displayName: row.displayName, role: row.role, joinedAt: row.joinedAt,
      canEdit: false as const, avatarUrl: includeAvatars ? row.avatarUrl : null, level: row.progress.achievedLevel,
      progress: { achievedLevel: row.progress.achievedLevel, revision: row.progress.revision,
        photosIntoLevel: row.progress.photosIntoLevel, photosForNextLevel: row.progress.photosForNextLevel, stats },
    };
  });
}
