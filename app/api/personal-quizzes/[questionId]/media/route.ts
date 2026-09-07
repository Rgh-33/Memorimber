import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { MEMORY_IMAGE_BUCKET } from "@/lib/supabase/memories";
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
    const { data: ref, error } = await client.rpc("get_personal_quiz_media_ref", {
      p_question: questionId, p_choice: choice,
    });
    if (error) throw error;
    if (typeof ref !== "string") return missing();
    const { data: memory, error: lookupError } = await client.from("memories").select("thumbnail_path,image_path")
      .eq("user_id", user.id).eq("quiz_media_ref", ref).limit(1).maybeSingle();
    if (lookupError) throw lookupError;
    if (!memory) return missing();
    const path = memory.thumbnail_path ?? memory.image_path;
    // The user-scoped Storage client adds the existing ownership/RLS check.
    const image = await client.storage.from(MEMORY_IMAGE_BUCKET).download(path);
    if (image.error || !image.data) return missing();
    // Re-encode without EXIF/XMP (capture date/descriptions can also disclose
    // answers). Keep the displayed dimensions and orientation unchanged.
    const bytes = await sharp(Buffer.from(await image.data.arrayBuffer()), { limitInputPixels: 40000000 }).rotate().webp({ quality: 90 }).toBuffer();
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch { return new Response(null, { status: 500, headers }); }
}
