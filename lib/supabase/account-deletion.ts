import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountDeletionJobStatus = "pending" | "processing" | "ready_for_auth" | "failed" | "completed";

export type AccountDeletionJob = {
  id: string;
  status: AccountDeletionJobStatus;
  retainSharedMemories: boolean;
  updatedAt: string;
};

function isStatus(value: unknown): value is AccountDeletionJobStatus {
  return value === "pending" || value === "processing" || value === "ready_for_auth" || value === "failed" || value === "completed";
}

function firstRow(data: unknown) {
  return Array.isArray(data) ? data[0] : data;
}

function mapJob(data: unknown): AccountDeletionJob | null {
  const row = firstRow(data);
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (
    typeof record.job_id !== "string"
    || !isStatus(record.status)
    || typeof record.retain_shared_memories !== "boolean"
    || typeof record.updated_at !== "string"
  ) return null;
  return {
    id: record.job_id,
    status: record.status,
    retainSharedMemories: record.retain_shared_memories,
    updatedAt: record.updated_at,
  };
}

export function validateAccountDeletionConfirmation(password: unknown, confirmation: unknown) {
  const normalizedPassword = String(password ?? "");
  if (!normalizedPassword) throw new Error("現在のパスワードを入力してください。");
  if (confirmation !== "削除") throw new Error("確認欄に「削除」と入力してください。");
  return normalizedPassword;
}

export async function prepareAccountDeletion(client: SupabaseClient, retainSharedMemories: boolean) {
  const { data, error } = await client.rpc("prepare_my_account_deletion", {
    retain_shared_memories: retainSharedMemories,
  });
  if (error) throw new Error("アカウント削除の準備を開始できませんでした。");
  const prepared = firstRow(data);
  if (!prepared || typeof prepared !== "object" || typeof (prepared as Record<string, unknown>).job_id !== "string") {
    throw new Error("アカウント削除ジョブを確認できませんでした。");
  }
  const job = await getMyAccountDeletionJob(client);
  if (!job) throw new Error("アカウント削除ジョブを確認できませんでした。");
  return job;
}

export async function getMyAccountDeletionJob(client: SupabaseClient) {
  const { data, error } = await client.rpc("get_my_account_deletion_job");
  if (error) throw new Error("アカウント削除の状態を確認できませんでした。");
  return mapJob(data);
}
