import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserProfile } from "@/lib/supabase/profile";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { user, profile, error } = await getCurrentUserProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (error || !profile) return NextResponse.json({ error: "Profile could not be loaded." }, { status: 500 });

  return NextResponse.json({ profile }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
