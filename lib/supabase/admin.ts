import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

let adminClient: SupabaseClient | null = null;

export function assertSupabaseAdminConfigured() {
  if (!process.env.SUPABASE_SECRET_KEY) {
    throw new Error("アカウント削除用のサーバー設定が完了していません。");
  }
}

export function createAdminClient() {
  assertSupabaseAdminConfigured();
  if (adminClient) return adminClient;
  const { url } = getSupabaseConfig();
  adminClient = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return adminClient;
}
