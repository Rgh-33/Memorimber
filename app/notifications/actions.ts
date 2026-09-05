"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { markAllInvitationNotificationsRead } from "@/lib/supabase/shared-album-invitations";
import { createClient } from "@/lib/supabase/server";

export type MarkNotificationsState = { ok: boolean; error: string | null };

export async function markAllNotificationsRead(): Promise<MarkNotificationsState> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabaseの接続情報が設定されていません。" };

  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { ok: false, error: "ログイン状態を確認できませんでした。" };
    await markAllInvitationNotificationsRead(supabase, user.id);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "通知を既読にできませんでした。" };
  }

  revalidatePath("/notifications");
  return { ok: true, error: null };
}
