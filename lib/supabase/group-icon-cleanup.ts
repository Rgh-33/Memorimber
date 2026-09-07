import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export async function processGroupIconCleanup(admin: SupabaseClient) {
  // Atomically retire expired reservations before selecting work. Commit accepts
  // only unexpired pending rows; a worker can never retire a committed upload.
  const { error: retireError } = await admin.from("group_icon_uploads").update({ state: "cleanup" }).eq("state", "pending").lt("created_at", new Date(Date.now() - 15 * 60000).toISOString());
  if (retireError) throw retireError;
  const { data, error } = await admin.from("group_icon_uploads").select("path,attempts").eq("state", "cleanup").order("created_at").limit(50);
  if (error) throw error;
  let removed = 0;
  for (const task of data ?? []) {
    const references = await admin.from("shared_albums").select("id").eq("icon_path", task.path).limit(1);
    if (references.error || references.data?.length) continue;
    const result = await admin.storage.from("shared-group-icons").remove([task.path]);
    if (result.error) await admin.from("group_icon_uploads").update({ attempts: task.attempts + 1 }).eq("path", task.path).eq("state", "cleanup");
    else {
      await admin.from("group_icon_uploads").delete().eq("path", task.path).eq("state", "cleanup");
      removed++;
    }
  }
  return { removed };
}
