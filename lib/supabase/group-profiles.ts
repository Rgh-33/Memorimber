import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmptyProfileActivityStats } from "@/lib/profile-data";
import type { ProfileProgressSnapshot } from "@/lib/profile-progress";
import { logSharedMembersFailure, MEMBERS_LOAD_ERROR, MEMBERS_PROGRESS_ERROR, MEMBERS_RESPONSE_ERROR } from "./shared-members-diagnostics";

export type GroupProfile = {
  userId: string; displayName: string; role: "owner" | "member"; joinedAt: string;
  avatarUrl: string | null; level: number; canEdit: false; progress: ProfileProgressSnapshot;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateProgress(value: unknown) {
  if (!isRecord(value) || !isRecord(value.stats)) throw new Error(MEMBERS_PROGRESS_ERROR);
  const { achievedLevel, revision, photosIntoLevel, photosForNextLevel, stats } = value;
  if (
    typeof achievedLevel !== "number" || !Number.isInteger(achievedLevel) || achievedLevel < 1 || achievedLevel > 20
    || typeof revision !== "number" || !Number.isInteger(revision) || revision < 0
    // A previously achieved level can legitimately outlast deleted photos.
    || typeof photosIntoLevel !== "number" || !Number.isFinite(photosIntoLevel)
    || typeof photosForNextLevel !== "number" || !Number.isFinite(photosForNextLevel) || photosForNextLevel <= 0
    || Object.keys(createEmptyProfileActivityStats()).some((metric) => {
      const count = stats[metric];
      return count !== undefined && (typeof count !== "number" || !Number.isFinite(count) || count < 0);
    })
  ) throw new Error(MEMBERS_PROGRESS_ERROR);
}

export async function getGroupProfiles(client: SupabaseClient, groupId: string, targetId?: string, includeAvatars = true): Promise<GroupProfile[] | null> {
  let auth;
  try {
    auth = await client.auth.getUser();
  } catch (error) {
    logSharedMembersFailure("auth", error);
    throw new Error(MEMBERS_LOAD_ERROR);
  }
  if (auth.error) logSharedMembersFailure("auth", auth.error);
  if (!auth.data.user) return null;
  if (auth.error) throw new Error(MEMBERS_LOAD_ERROR);

  let data: unknown;
  try {
    const result = await client.rpc("get_shared_group_profiles", { p_group: groupId, p_target: targetId ?? null });
    if (result.error) throw result.error;
    data = result.data;
  } catch (error) {
    logSharedMembersFailure("rpc", error);
    throw new Error(MEMBERS_LOAD_ERROR);
  }
  if (data === null) return null;
  try {
    if (!Array.isArray(data)) throw new Error(MEMBERS_RESPONSE_ERROR);
    for (const row of data) {
      if (!isRecord(row)) throw new Error(MEMBERS_RESPONSE_ERROR);
      validateProgress(row.progress);
    }
    return (data as Omit<GroupProfile, "level">[]).map((row) => {
      const stats = Object.fromEntries(Object.keys(createEmptyProfileActivityStats()).map((metric) => [metric, row.progress.stats[metric as keyof typeof row.progress.stats] ?? 0]));
      return {
        userId: row.userId, displayName: row.displayName, role: row.role, joinedAt: row.joinedAt,
        canEdit: false as const, avatarUrl: includeAvatars ? row.avatarUrl : null, level: row.progress.achievedLevel,
        progress: { achievedLevel: row.progress.achievedLevel, revision: row.progress.revision,
          photosIntoLevel: row.progress.photosIntoLevel, photosForNextLevel: row.progress.photosForNextLevel, stats },
      };
    });
  } catch (error) {
    logSharedMembersFailure("map", error);
    throw new Error(MEMBERS_LOAD_ERROR);
  }
}
