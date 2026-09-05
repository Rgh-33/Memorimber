import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateAccountDeletionConfirmation } from "../lib/supabase/account-deletion.ts";

const migration = readFileSync(
  new URL("../supabase/migrations/20260905050000_account_deletion_retention.sql", import.meta.url),
  "utf8",
);

test("account deletion requires the current password and exact confirmation text", () => {
  assert.equal(validateAccountDeletionConfirmation("correct horse", "削除"), "correct horse");
  assert.throws(() => validateAccountDeletionConfirmation("", "削除"), /現在のパスワード/);
  assert.throws(() => validateAccountDeletionConfirmation("password", "delete"), /「削除」/);
});

test("retained memories are nullable snapshots while active ownership remains constrained", () => {
  assert.match(migration, /alter column user_id drop not null/);
  assert.match(migration, /memories_retained_owner_snapshot[\s\S]*user_id is null[\s\S]*retained_owner_name[\s\S]*retained_at is not null/);
  assert.match(migration, /memories_image_path_owned_or_retained[\s\S]*\^retained\//);
  assert.match(migration, /shared_album_memories_added_by_fkey[\s\S]*on delete set null/);
  assert.match(migration, /added_by_display_name/);
});

test("deletion preparation retains only memories shared into another owner's group", () => {
  assert.match(migration, /delete from public\.shared_albums album[\s\S]*album\.owner_id = caller_id/);
  assert.match(migration, /account_deletion_retained_memories[\s\S]*album\.owner_id <> caller_id/);
  assert.match(migration, /operation, destination_path[\s\S]*'move'/);
  assert.match(migration, /where memory\.user_id = caller_id[\s\S]*'delete'/);
  assert.match(migration, /'profile-avatars'/);
});

test("deletion jobs and retained cleanup are private, resumable, and service finalized", () => {
  for (const table of [
    "account_deletion_jobs",
    "account_deletion_retained_memories",
    "account_deletion_storage_tasks",
    "retained_memory_cleanup_queue",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
  }
  assert.match(migration, /finalize_account_deletion_job[\s\S]*account deletion storage tasks remain/);
  assert.match(migration, /grant execute on function public\.finalize_account_deletion_job\(uuid\) to service_role/);
  assert.match(migration, /queue_unshared_retained_memory_cleanup[\s\S]*after delete on public\.shared_album_memories/);
  assert.match(migration, /Accounts pending deletion cannot insert memories[\s\S]*as restrictive/);
  assert.match(migration, /Accounts pending deletion cannot upload private images[\s\S]*as restrictive/);
});

test("account page defaults retention off and requires reauthentication", () => {
  const page = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../app/account/actions.ts", import.meta.url), "utf8");
  assert.match(page, /name="retainSharedMemories"/);
  assert.doesNotMatch(page, /name="retainSharedMemories"[^>]*defaultChecked/);
  assert.match(page, /name="password"[\s\S]*autoComplete="current-password"/);
  assert.match(page, /name="confirmation"[\s\S]*pattern="削除"/);
  assert.match(actions, /signInWithPassword/);
  assert.match(actions, /reauthenticated\.user\?\.id !== user\.id/);
  assert.match(actions, /auth\.admin\.deleteUser|processAccountDeletionJob/);
});

test("daily cleanup cron is protected and secrets remain server-only", () => {
  const route = readFileSync(new URL("../app/api/cron/account-deletion-cleanup/route.ts", import.meta.url), "utf8");
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../lib/supabase/admin.ts", import.meta.url), "utf8");
  assert.deepEqual(config.crons, [{ path: "/api/cron/account-deletion-cleanup", schedule: "0 18 * * *" }]);
  assert.match(route, /authorization[^\n]*Bearer \$\{cronSecret\}/);
  assert.match(route, /status: 401/);
  assert.match(envExample, /^SUPABASE_SECRET_KEY=$/m);
  assert.match(envExample, /^CRON_SECRET=$/m);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_(?:SUPABASE_SECRET_KEY|CRON_SECRET)/);
  assert.match(admin, /import "server-only"/);
});

test("runner treats missing objects as idempotent and scans both private buckets", () => {
  const runner = readFileSync(new URL("../lib/supabase/account-deletion-runner.ts", import.meta.url), "utf8");
  assert.match(runner, /\["memory-images", "profile-avatars"\]/);
  assert.match(runner, /isMissingObjectError\(moveError\)/);
  assert.match(runner, /removeError && !isMissingObjectError\(removeError\)/);
  assert.match(runner, /Math\.max\(1, Math\.min\(batchSize, 100\)\)/);
  assert.match(runner, /auth\.admin\.deleteUser\(job\.user_id, false\)/);
});
