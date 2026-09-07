import { createClient } from "@/lib/supabase/server";
import { loadSharedAvatar } from "@/lib/supabase/shared-avatar";
import { isUuid } from "@/lib/supabase/shared-albums";

export async function GET(request: Request, { params }: { params: Promise<{ groupId: string; userId: string }> }) {
  const { groupId, userId } = await params;
  const ref = new URL(request.url).searchParams.get("v");
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!isUuid(groupId) || !isUuid(userId) || (ref !== null && !/^[0-9a-f]{32}$/.test(ref))) return new Response(null, { status: 404, headers });
  try {
    const image = await loadSharedAvatar(await createClient(), groupId, userId, ref);
    if (!image) return new Response(null, { status: 404, headers });
    return new Response(image, { headers: { ...headers, "Content-Type": image.type || "application/octet-stream" } });
  } catch { return new Response(null, { status: 500, headers }); }
}
