import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260905080000_allow_shared_memory_thumbnails.sql", import.meta.url),
  "utf8",
);
const sharedLoader = readFileSync(new URL("../lib/supabase/shared-albums.ts", import.meta.url), "utf8");
const sharedDetailPage = readFileSync(
  new URL("../app/shared-groups/[groupId]/memories/[memoryId]/page.tsx", import.meta.url),
  "utf8",
);

test("shared thumbnail migration extends read access without granting writes", () => {
  assert.match(migration, /memory\.image_path = object_name\s+or memory\.thumbnail_path = object_name/);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/);
  assert.match(migration, /grant execute on function private\.can_view_shared_memory_image\(text\) to authenticated/);
  assert.doesNotMatch(migration, /create policy[\s\S]*for (?:update|delete|insert)/i);
  assert.doesNotMatch(migration, /grant (?:update|delete|insert)[^;]*storage\.objects/i);
});

test("shared lists sign only display images and details load one original", () => {
  assert.match(sharedLoader, /memory\.thumbnail_path \?\? memory\.image_path/);
  assert.match(sharedLoader, /loadSharedAlbumMemoryDetail/);
  assert.match(sharedLoader, /signMemoryPaths\(client, \[memory\.image_path\]\)/);
  assert.match(sharedDetailPage, /loadSharedAlbumMemoryDetail\(client, groupId, memoryId\)/);
  assert.doesNotMatch(sharedDetailPage, /loadSharedAlbumMemoryEntries/);
});
