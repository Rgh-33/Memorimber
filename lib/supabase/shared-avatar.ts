import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isOwnedProfileAvatarPath } from "@/lib/profile-avatar-path";

export async function loadSharedAvatar(client: SupabaseClient, groupId: string, targetId: string, expectedRef: string | null) {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data: ref, error } = await client.rpc("get_shared_group_avatar_ref", { p_group: groupId, p_target: targetId });
  if (error) throw new Error("メンバー画像を読み込めませんでした。");
  if (typeof ref !== "string" || (expectedRef !== null && expectedRef !== ref)) return null;
  const bucket = client.storage.from("profile-avatars");
  // Co-member RLS admits only the current referenced avatar. Owners may also
  // see their own old uploads, so paginate rather than assume the first file.
  for (let offset = 0; ; offset += 100) {
    const { data: files, error: listError } = await bucket.list(targetId, { limit: 100, offset, search: "avatar-", sortBy: { column: "name", order: "asc" } });
    if (listError) throw new Error("メンバー画像を読み込めませんでした。");
    for (const file of files ?? []) {
      const path = `${targetId}/${file.name}`;
      if (!isOwnedProfileAvatarPath(targetId, path) || createHash("md5").update(path).digest("hex") !== ref) continue;
      // Recheck membership/current reference before sending any bytes if it
      // changed during lookup. The download also uses the user's Storage RLS.
      const latest = await client.rpc("get_shared_group_avatar_ref", { p_group: groupId, p_target: targetId });
      if (latest.error) throw new Error("メンバー画像を読み込めませんでした。");
      if (latest.data !== ref) return null;
      const image = await bucket.download(path);
      if (image.error) return null;
      return image.data;
    }
    if (!files || files.length < 100) return null;
  }
}
