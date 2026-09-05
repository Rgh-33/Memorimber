import { processPendingAccountDeletionJobs, processRetainedMemoryCleanupQueue } from "@/lib/supabase/account-deletion-runner";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const [jobs, retainedMemories] = await Promise.all([
      processPendingAccountDeletionJobs(admin),
      processRetainedMemoryCleanupQueue(admin),
    ]);
    return Response.json({ ok: true, jobs, retainedMemories });
  } catch {
    return Response.json({ ok: false, error: "Cleanup could not be completed." }, { status: 500 });
  }
}
