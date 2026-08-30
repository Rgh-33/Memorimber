import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeAuthRedirect } from "@/lib/auth-redirect";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const next = getSafeAuthRedirect(request.nextUrl.searchParams.get("next"));
  const redirectUrl = new URL(next, request.url);

  if (!isSupabaseConfigured()) {
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("error", "configuration");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createClient();
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  let error = null;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    error = new Error("認証情報がありません。");
  }

  if (error) {
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("error", "confirmation_failed");
  }

  return NextResponse.redirect(redirectUrl);
}
