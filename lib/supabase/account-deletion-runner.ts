import type { SupabaseClient } from "@supabase/supabase-js";

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RETRY_ERROR = "処理を完了できませんでした。再試行してください。";

type DeletionJobRow = {
  id: string;
  user_id: string;
  status: "pending" | "processing" | "ready_for_auth" | "failed" | "completed";
  attempts: number;
};

type StorageTaskRow = {
  id: string;
  job_id: string;
  bucket_id: "memory-images" | "profile-avatars";
  source_path: string;
  operation: "delete" | "move";
  destination_path: string | null;
  status: "pending" | "failed" | "completed";
  attempts: number;
};

type CleanupRow = {
  memory_id: string;
  image_path: string;
  thumbnail_path: string | null;
  attempts: number;
};

type StorageListItem = { name: string; id?: string | null; metadata?: unknown };

function errorMessage(error: unknown) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : "unknown error";
}

function isMissingObjectError(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return message.includes("not found") || message.includes("does not exist") || message.includes("404");
}

async function listStorageFolder(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
  found: string[],
): Promise<void> {
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const page = (data ?? []) as StorageListItem[];
    for (const item of page) {
      if (!item.name || item.name === "." || item.name === "..") continue;
      const path = `${prefix}/${item.name}`;
      if (item.id == null && item.metadata == null) await listStorageFolder(admin, bucket, path, found);
      else found.push(path);
    }
    if (page.length < pageSize) break;
  }
}

async function discoverOwnedStorageTasks(admin: SupabaseClient, job: DeletionJobRow) {
  if (!USER_ID_PATTERN.test(job.user_id)) throw new Error("invalid account deletion user id");
  const discovered: { job_id: string; bucket_id: string; source_path: string; operation: "delete" }[] = [];
  for (const bucket of ["memory-images", "profile-avatars"] as const) {
    const paths: string[] = [];
    await listStorageFolder(admin, bucket, job.user_id, paths);
    discovered.push(...paths.map((sourcePath) => ({
      job_id: job.id,
      bucket_id: bucket,
      source_path: sourcePath,
      operation: "delete" as const,
    })));
  }
  if (discovered.length === 0) return;
  const { error } = await admin.from("account_deletion_storage_tasks").upsert(discovered, {
    onConflict: "bucket_id,source_path",
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

async function markStorageTasks(
  admin: SupabaseClient,
  tasks: StorageTaskRow[],
  status: "failed" | "completed",
) {
  if (tasks.length === 0) return;
  const now = new Date().toISOString();
  for (const task of tasks) {
    const { error } = await admin.from("account_deletion_storage_tasks").update({
      status,
      attempts: task.attempts + 1,
      last_error: status === "failed" ? RETRY_ERROR : null,
      completed_at: status === "completed" ? now : null,
    }).eq("id", task.id).eq("job_id", task.job_id);
    if (error) throw error;
  }
}

async function processStorageTasks(admin: SupabaseClient, jobId: string, batchSize: number) {
  const { data, error } = await admin.from("account_deletion_storage_tasks")
    .select("id, job_id, bucket_id, source_path, operation, destination_path, status, attempts")
    .eq("job_id", jobId)
    .neq("status", "completed")
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (error) throw error;
  const tasks = (data ?? []) as StorageTaskRow[];
  const moveTasks = tasks.filter((task) => task.operation === "move");
  const deleteTasks = tasks.filter((task) => task.operation === "delete");

  for (const task of moveTasks) {
    if (!task.destination_path) {
      await markStorageTasks(admin, [task], "failed");
      continue;
    }
    const { error: moveError } = await admin.storage.from(task.bucket_id).move(task.source_path, task.destination_path);
    if (!moveError || isMissingObjectError(moveError)) await markStorageTasks(admin, [task], "completed");
    else await markStorageTasks(admin, [task], "failed");
  }

  const byBucket = new Map<StorageTaskRow["bucket_id"], StorageTaskRow[]>();
  for (const task of deleteTasks) byBucket.set(task.bucket_id, [...(byBucket.get(task.bucket_id) ?? []), task]);
  for (const [bucket, bucketTasks] of byBucket) {
    const { error: removeError } = await admin.storage.from(bucket).remove(bucketTasks.map((task) => task.source_path));
    await markStorageTasks(admin, bucketTasks, removeError && !isMissingObjectError(removeError) ? "failed" : "completed");
  }
}

async function setJobFailure(admin: SupabaseClient, jobId: string) {
  await admin.from("account_deletion_jobs").update({ status: "failed", last_error: RETRY_ERROR }).eq("id", jobId);
}

function isMissingUserError(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return message.includes("user not found") || message.includes("not found");
}

export async function processAccountDeletionJob(
  admin: SupabaseClient,
  jobId: string,
  batchSize = 100,
): Promise<{ complete: boolean; pendingTasks: number }> {
  const { data, error } = await admin.from("account_deletion_jobs")
    .select("id, user_id, status, attempts")
    .eq("id", jobId)
    .maybeSingle();
  if (error || !data) throw new Error("account deletion job not found");
  const job = data as DeletionJobRow;
  if (job.status === "completed") return { complete: true, pendingTasks: 0 };

  const { error: processingError } = await admin.from("account_deletion_jobs").update({
    status: "processing",
    attempts: job.attempts + 1,
    last_error: null,
  }).eq("id", job.id).neq("status", "completed");
  if (processingError) throw processingError;

  try {
    if (job.status !== "ready_for_auth") {
      await discoverOwnedStorageTasks(admin, job);
      await processStorageTasks(admin, job.id, Math.max(1, Math.min(batchSize, 100)));
      const { count, error: countError } = await admin.from("account_deletion_storage_tasks")
        .select("id", { count: "exact", head: true })
        .eq("job_id", job.id)
        .neq("status", "completed");
      if (countError) throw countError;
      if ((count ?? 0) > 0) {
        await setJobFailure(admin, job.id);
        return { complete: false, pendingTasks: count ?? 0 };
      }
      const { error: finalizeError } = await admin.rpc("finalize_account_deletion_job", { target_job_id: job.id });
      if (finalizeError) throw finalizeError;
    }

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(job.user_id, false);
    if (deleteUserError && !isMissingUserError(deleteUserError)) throw deleteUserError;
    const { error: completeError } = await admin.from("account_deletion_jobs").update({
      status: "completed",
      last_error: null,
      completed_at: new Date().toISOString(),
    }).eq("id", job.id);
    if (completeError) throw completeError;
    return { complete: true, pendingTasks: 0 };
  } catch (processingFailure) {
    await setJobFailure(admin, job.id);
    throw processingFailure;
  }
}

export async function processPendingAccountDeletionJobs(admin: SupabaseClient, limit = 10) {
  const { data, error } = await admin.from("account_deletion_jobs")
    .select("id")
    .neq("status", "completed")
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  let completed = 0;
  let pending = 0;
  for (const row of data ?? []) {
    try {
      const result = await processAccountDeletionJob(admin, row.id);
      if (result.complete) completed += 1;
      else pending += 1;
    } catch {
      pending += 1;
    }
  }
  return { completed, pending };
}

export async function processRetainedMemoryCleanupQueue(admin: SupabaseClient, limit = 50) {
  const { data, error } = await admin.from("retained_memory_cleanup_queue")
    .select("memory_id, image_path, thumbnail_path, attempts")
    .order("updated_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 50)));
  if (error) throw error;
  const rows = (data ?? []) as CleanupRow[];
  if (rows.length === 0) return { completed: 0, failed: 0 };
  const paths = [...new Set(rows.flatMap((row) => [row.image_path, row.thumbnail_path].filter((path): path is string => Boolean(path))))];
  const { error: removeError } = await admin.storage.from("memory-images").remove(paths);
  if (removeError && !isMissingObjectError(removeError)) {
    for (const row of rows) {
      await admin.from("retained_memory_cleanup_queue").update({
        status: "failed",
        attempts: row.attempts + 1,
        last_error: RETRY_ERROR,
      }).eq("memory_id", row.memory_id);
    }
    return { completed: 0, failed: rows.length };
  }

  let completed = 0;
  let failed = 0;
  for (const row of rows) {
    const { error: memoryError } = await admin.from("memories").delete()
      .eq("id", row.memory_id).is("user_id", null);
    if (memoryError) {
      failed += 1;
      await admin.from("retained_memory_cleanup_queue").update({
        status: "failed",
        attempts: row.attempts + 1,
        last_error: RETRY_ERROR,
      }).eq("memory_id", row.memory_id);
      continue;
    }
    await admin.from("retained_memory_cleanup_queue").delete().eq("memory_id", row.memory_id);
    completed += 1;
  }
  return { completed, failed };
}
