import { createClient } from "@/lib/supabase/server";
import { getGroupProfiles } from "@/lib/supabase/group-profiles";
import { isUuid } from "@/lib/supabase/shared-albums";
export async function GET(_request: Request, { params }: { params: Promise<{ groupId: string; userId: string }> }) {
  const { groupId, userId } = await params;
  if (!isUuid(groupId) || !isUuid(userId)) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const rows = await getGroupProfiles(await createClient(), groupId, userId);
    if (!rows?.[0]) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(rows[0], { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "プロフィールを読み込めませんでした。" }, { status: 500 }); }
}
