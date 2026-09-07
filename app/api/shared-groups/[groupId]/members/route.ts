import { createClient } from "@/lib/supabase/server";
import { getGroupProfiles } from "@/lib/supabase/group-profiles";
import { isUuid } from "@/lib/supabase/shared-albums";
export async function GET(_request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isUuid(groupId)) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const rows = await getGroupProfiles(await createClient(), groupId);
    if (!rows) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(rows, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "メンバーを読み込めませんでした。" }, { status: 500 }); }
}
