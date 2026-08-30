"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function getSafeNext(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function login(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/login?error=configuration");

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = getSafeNext(formData.get("next"));
  if (!email || !password) redirect("/login?error=missing_fields");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=invalid_credentials");

  redirect(next);
}

export async function signup(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/signup?error=configuration");

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = getSafeNext(formData.get("next"));
  if (!email || !password) redirect("/signup?error=missing_fields");

  const requestOrigin = (await headers()).get("origin");
  const emailRedirectTo = requestOrigin
    ? `${requestOrigin}/auth/callback?next=${encodeURIComponent(next)}`
    : undefined;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });

  if (error) redirect("/signup?error=signup_failed");
  if (data.session) redirect(next);
  redirect("/login?message=check_email");
}

export async function logout() {
  if (!isSupabaseConfigured()) redirect("/login?error=configuration");

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?message=signed_out");
}
