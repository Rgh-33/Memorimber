import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type CleanupOperation = {
  operation_id: string;
  lease_token: string;
  bucket_id: "memory-images" | "shared-group-icons";
  paths: string[];
};

/** Best-effort, at most two receipts from this authenticated user's mutations.
 * No image downloads, signed URLs or shared-list fetches. All eligibility and
 * lease checks (including Storage DELETE) are enforced again in the database.
 * Paths and tokens stay on the server; logs contain only receipt IDs/stages.
 */
export async function retryAuthenticatedCleanup(client: SupabaseClient): Promise<void> {
  try {
    const { data, error } = await client.rpc("claim_authenticated_storage_cleanup", { p_limit: 2 });
    if (error) {
      console.warn("[shared-cleanup] Retry deferred", { stage: "claim" });
      return;
    }
    for (const operation of (data ?? []) as CleanupOperation[]) {
      try {
        const removal = await client.storage.from(operation.bucket_id).remove(operation.paths);
        // Never trust a successful Storage response alone. The RPC checks actual
        // object absence, current references, retained state and the live lease.
        // Also finish after partial/not-found responses: missing is idempotent.
        const finished = await client.rpc("finish_authenticated_storage_cleanup", {
          p_operation: operation.operation_id, p_lease: operation.lease_token,
        });
        if (finished.error || finished.data !== true) {
          console.warn("[shared-cleanup] Retry deferred", { operationId: operation.operation_id, stage: removal.error ? "storage" : "finish" });
        }
      } catch {
        // A lost response or timeout leaves a durable receipt. The lease expires
        // before a later access retries it; the global queue remains intact.
        console.warn("[shared-cleanup] Retry deferred", { operationId: operation.operation_id, stage: "storage" });
      }
    }
  } catch {
    console.warn("[shared-cleanup] Retry deferred", { stage: "claim" });
  }
}
