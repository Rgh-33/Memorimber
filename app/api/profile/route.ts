import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const AVATAR_BUCKET = "profile-avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function withSignedAvatar<T extends { avatar_url: string | null }>(profile: T) {
  if (!profile.avatar_url) return profile;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(profile.avatar_url, 3600);
  return { ...profile, avatar_url: data?.signedUrl ?? null };
}

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { user, profile, error } = await getCurrentUserProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (error || !profile) return NextResponse.json({ error: "Profile could not be loaded." }, { status: 500 });
  return NextResponse.json({ profile: await withSignedAvatar(profile) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { display_name?: unknown } | null;
  const displayName = typeof body?.display_name === "string" ? body.display_name.trim() : "";
  if (!displayName || displayName.length > 20) {
    return NextResponse.json({ error: "Display name must be between 1 and 20 characters." }, { status: 400 });
  }
  const { data, error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id)
    .select("id, display_name, avatar_url, created_at, updated_at").single();
  if (error) return NextResponse.json({ error: "Profile could not be updated." }, { status: 500 });
  return NextResponse.json({ profile: await withSignedAvatar(data) });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const avatar = formData.get("avatar");
  if (!(avatar instanceof File) || !AVATAR_TYPES[avatar.type] || avatar.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: "Avatar must be a JPEG, PNG, or WebP image up to 5 MB." }, { status: 400 });
  }

  const { data: current } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).single();
  const path = `${user.id}/avatar-${crypto.randomUUID()}.${AVATAR_TYPES[avatar.type]}`;
  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, await avatar.arrayBuffer(), { contentType: avatar.type });
  if (uploadError) return NextResponse.json({ error: "Avatar could not be uploaded." }, { status: 500 });

  const { data, error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id)
    .select("id, display_name, avatar_url, created_at, updated_at").single();
  if (error) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    return NextResponse.json({ error: "Profile could not be updated." }, { status: 500 });
  }
  let warning: string | undefined;
  if (current?.avatar_url) {
    const { error: cleanupError } = await supabase.storage.from(AVATAR_BUCKET).remove([current.avatar_url]);
    if (cleanupError) {
      warning = "The previous avatar could not be deleted.";
      console.error("Failed to delete previous profile avatar", {
        path: current.avatar_url,
        message: cleanupError.message,
      });
    }
  }
  return NextResponse.json({ profile: await withSignedAvatar(data), ...(warning ? { warning } : {}) });
}
