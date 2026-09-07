import { after } from "next/server";
import { retryAuthenticatedCleanup } from "@/lib/supabase/authenticated-cleanup";
import { createClient } from "@/lib/supabase/server";
import { getGroupProfiles } from "@/lib/supabase/group-profiles";
import { isUuid } from "@/lib/supabase/shared-albums";
import { logSharedMembersFailure, MEMBERS_LOAD_ERROR } from "@/lib/supabase/shared-members-diagnostics";
export async function GET(_request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isUuid(groupId)) return Response.json({ error: "Not found" }, { status: 404 });
  let client;
  try {
    client = await createClient();
  } catch (error) {
    logSharedMembersFailure("create_client", error);
    return Response.json({ error: MEMBERS_LOAD_ERROR }, { status: 500 });
  }

  let rows;
  try {
    rows = await getGroupProfiles(client, groupId);
  } catch {
    // The loader already logged the precise auth / RPC / map stage safely.
    return Response.json({ error: MEMBERS_LOAD_ERROR }, { status: 500 });
  }
  if (!rows) return Response.json({ error: "Not found" }, { status: 404 });
  const response = Response.json(rows, { headers: { "Cache-Control": "private, no-store" } });

  // Cleanup is optional even when the runtime cannot register after().
  try {
    after(async () => {
      try {
        await retryAuthenticatedCleanup(client);
      } catch (error) {
        logSharedMembersFailure("cleanup_execute", error);
      }
    });
  } catch (error) {
    logSharedMembersFailure("cleanup_register", error);
  }
  return response;
}
