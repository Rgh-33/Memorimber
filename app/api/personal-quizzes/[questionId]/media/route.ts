import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { MEMORY_IMAGE_BUCKET } from "@/lib/supabase/memories";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/supabase/shared-albums";

// Keep memory paths and IDs out of both JSON and image redirects. Auth and
// question membership are checked on every request; no shared/CDN caching.
export async function GET(request: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params;
  const choice = new URL(request.url).searchParams.get("choice");
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const missing = () => new Response(null, { status: 404, headers });
  if (!isUuid(questionId) || (choice !== null && !isUuid(choice))) return missing();
  try {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return missing();
    const { data: path, error } = await createAdminClient().rpc("server_personal_quiz_media", {
      p_caller: user.id, p_question: questionId, p_choice: choice,
    });
    if (error) throw error;
    if (typeof path !== "string") return missing();
    // The user-scoped Storage client adds the existing ownership/RLS check.
    const image = await client.storage.from(MEMORY_IMAGE_BUCKET).download(path);
    if (image.error || !image.data) return missing();
    // Re-encode without EXIF/XMP (capture date/descriptions can also disclose
    // answers). Keep the displayed dimensions and orientation unchanged.
    const bytes = await sharp(Buffer.from(await image.data.arrayBuffer()), { limitInputPixels: 40000000 }).rotate().webp({ quality: 90 }).toBuffer();
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch { return new Response(null, { status: 500, headers }); }
}
