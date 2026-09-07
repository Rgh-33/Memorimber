import "server-only";

type MembersStage = "create_client" | "auth" | "rpc" | "map" | "cleanup_register" | "cleanup_execute";

export const MEMBERS_LOAD_ERROR = "メンバーを読み込めませんでした。";
export const MEMBERS_RESPONSE_ERROR = "Invalid shared members response";
export const MEMBERS_PROGRESS_ERROR = "Invalid shared member progress";

// Only known, data-free diagnostics can pass through verbatim. Database error
// details can contain entire rows, so pattern-based secret removal is not enough.
const safeMessages = new Set([
  MEMBERS_RESPONSE_ERROR,
  MEMBERS_PROGRESS_ERROR,
  "Auth session missing!",
  "Invalid Refresh Token: Refresh Token Not Found",
  "Invalid Refresh Token: Already Used",
  "fetch failed",
  "Failed to fetch",
  "Could not find the function public.get_shared_group_profiles(p_group, p_target) in the schema cache",
  "Searched for the function public.get_shared_group_profiles with parameters p_group, p_target, but no matches were found in the schema cache.",
  "Searched for the function public.get_shared_group_profiles with parameters p_group, p_target or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.",
  "Perhaps you meant to call the function public.get_shared_group_versions",
  "`after()` will not work correctly, because `waitUntil` is not available in the current environment.",
]);
const schemaObjects = [
  "get_shared_group_profiles", "profile_snapshot", "profile_requirement",
  "get_shared_group_avatar_ref", "shared_album_members", "profiles",
  "profile_progress", "profile_activity_counters", "memories", "private", "public",
];
for (const name of schemaObjects) {
  for (const kind of ["function", "table", "schema"]) {
    safeMessages.add(`permission denied for ${kind} ${name}`);
  }
}

function safeText(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return safeMessages.has(value) ? value : "[redacted: unrecognized diagnostic text]";
}

export function logSharedMembersFailure(stage: MembersStage, error: unknown) {
  const fields = error !== null && typeof error === "object"
    ? error as Record<string, unknown> : {};
  const code = typeof fields.code === "string" && (
    /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/.test(fields.code)
    || ["session_not_found", "refresh_token_not_found", "refresh_token_already_used", "bad_jwt"].includes(fields.code)
  ) ? fields.code : null;
  const diagnostic = {
    stage,
    code,
    message: safeText(fields.message),
    details: safeText(fields.details),
    hint: safeText(fields.hint),
  };
  if (stage === "cleanup_register" || stage === "cleanup_execute") {
    console.warn("[shared-members] Cleanup deferred", diagnostic);
  } else {
    console.error(stage === "rpc" ? "[shared-members] RPC failed" : "[shared-members] Load failed", diagnostic);
  }
}
