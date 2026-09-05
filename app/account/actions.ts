"use server";

import { redirect } from "next/navigation";
import { getMyAccountDeletionJob, prepareAccountDeletion, validateAccountDeletionConfirmation } from "@/lib/supabase/account-deletion";
import { processAccountDeletionJob, processRetainedMemoryCleanupQueue } from "@/lib/supabase/account-deletion-runner";
import { assertSupabaseAdminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function accountNotice(tone: "error" | "status", message: string) {
  return `/account?${new URLSearchParams({ [tone]: message })}`;
}

const SAFE_ACCOUNT_ERRORS = new Set([
  "Supabaseの接続情報が設定されていません。",
  "アカウント削除用のサーバー設定が完了していません。",
  "現在のパスワードを入力してください。",
  "確認欄に「削除」と入力してください。",
  "ログイン状態を確認できませんでした。",
  "パスワードが一致しません。アカウント削除は開始していません。",
  "アカウント削除の準備を開始できませんでした。",
  "アカウント削除ジョブを確認できませんでした。",
  "アカウント削除の状態を確認できませんでした。",
  "再試行できる削除処理が見つかりません。",
]);

function safeAccountError(error: unknown, fallback: string) {
  if (error instanceof Error && SAFE_ACCOUNT_ERRORS.has(error.message)) return error.message;
  return fallback;
}

async function finishSession(client: Awaited<ReturnType<typeof createClient>>) {
  await client.auth.signOut({ scope: "local" });
}

export async function deleteAccountAction(formData: FormData) {
  let failure: string | null = null;
  let complete = false;
  let client: Awaited<ReturnType<typeof createClient>> | null = null;

  try {
    if (!isSupabaseConfigured()) throw new Error("Supabaseの接続情報が設定されていません。");
    assertSupabaseAdminConfigured();
    const password = validateAccountDeletionConfirmation(formData.get("password"), formData.get("confirmation"));
    client = await createClient();
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user?.email) throw new Error("ログイン状態を確認できませんでした。");

    const { data: reauthenticated, error: passwordError } = await client.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (passwordError || reauthenticated.user?.id !== user.id) {
      throw new Error("パスワードが一致しません。アカウント削除は開始していません。");
    }

    const job = await prepareAccountDeletion(client, formData.get("retainSharedMemories") === "on");
    const admin = createAdminClient();
    const result = await processAccountDeletionJob(admin, job.id);
    await processRetainedMemoryCleanupQueue(admin).catch(() => undefined);
    complete = result.complete;
  } catch (error) {
    failure = safeAccountError(error, "削除処理を完了できませんでした。時間をおいて再試行してください。");
  }

  if (complete && client) {
    await finishSession(client);
    redirect("/login?message=account_deleted");
  }
  if (failure) redirect(accountNotice("error", failure));
  redirect(accountNotice("status", "削除処理を開始しました。完了するまで再試行できます。"));
}

export async function retryAccountDeletionAction() {
  let failure: string | null = null;
  let complete = false;
  let client: Awaited<ReturnType<typeof createClient>> | null = null;

  try {
    if (!isSupabaseConfigured()) throw new Error("Supabaseの接続情報が設定されていません。");
    assertSupabaseAdminConfigured();
    client = await createClient();
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) throw new Error("ログイン状態を確認できませんでした。");
    const job = await getMyAccountDeletionJob(client);
    if (!job) throw new Error("再試行できる削除処理が見つかりません。");
    const admin = createAdminClient();
    const result = await processAccountDeletionJob(admin, job.id);
    await processRetainedMemoryCleanupQueue(admin).catch(() => undefined);
    complete = result.complete;
  } catch (error) {
    failure = safeAccountError(error, "削除処理を再試行できませんでした。時間をおいてお試しください。");
  }

  if (complete && client) {
    await finishSession(client);
    redirect("/login?message=account_deleted");
  }
  if (failure) redirect(accountNotice("error", failure));
  redirect(accountNotice("status", "削除処理を再試行しました。未完了分は日次処理でも再試行されます。"));
}
