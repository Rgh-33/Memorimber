import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createQuizQuestions } from "../lib/quiz.ts";
import {
  loadSharedAlbumMemories,
  loadSharedAlbumMemoryEntries,
  normalizeSharedAlbumName,
} from "../lib/supabase/shared-albums.ts";

const ALBUM_ID = "10000000-0000-4000-8000-000000000001";
const OWNER_ID = "20000000-0000-4000-8000-000000000002";

function loaderClient() {
  const rows = [
    {
      album_id: ALBUM_ID,
      memory_id: "40000000-0000-4000-8000-000000000004",
      added_by: OWNER_ID,
      created_at: "2026-09-05T01:00:00Z",
      memory: {
        id: "40000000-0000-4000-8000-000000000004",
        user_id: OWNER_ID,
        image_path: `${OWNER_ID}/one.jpg`,
        thumbnail_path: `${OWNER_ID}/thumbnails/one.webp`,
        caption: "一枚目",
        memory_date: "2026-09-01",
        people: ["家族"],
        tags: [],
        letter: "",
        created_at: "2026-09-01T00:00:00Z",
      },
    },
    {
      album_id: ALBUM_ID,
      memory_id: "50000000-0000-4000-8000-000000000005",
      added_by: null,
      added_by_display_name: "退会した人",
      created_at: "2026-09-05T02:00:00Z",
      memory: {
        id: "50000000-0000-4000-8000-000000000005",
        user_id: null,
        image_path: "retained/50000000-0000-4000-8000-000000000005/original.jpg",
        caption: "二枚目",
        memory_date: "2026-09-02",
        people: [],
        tags: ["旅行"],
        letter: "また行こう",
        created_at: "2026-09-02T00:00:00Z",
      },
    },
  ];
  const query = {
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    async range() { return { data: rows, error: null }; },
  };
  return {
    from(table) {
      assert.equal(table, "shared_album_memories");
      return query;
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, "memory-images");
        return {
          async createSignedUrls(paths, expiresIn) {
            assert.equal(expiresIn, 3600);
            return {
              data: paths.map((path, index) => index < 2
                ? { path, signedUrl: `https://signed.invalid/${path}`, error: null }
                : { path, signedUrl: null, error: { message: "denied" } }),
              error: null,
            };
          },
        };
      },
    },
  };
}

test("shared-memory loader preserves metadata when one signed URL fails", async () => {
  const result = await loadSharedAlbumMemoryEntries(loaderClient(), ALBUM_ID);
  assert.equal(result.entries.length, 2);
  assert.match(result.entries[0].memory.imageUrl, /signed\.invalid/);
  assert.match(result.entries[0].memory.thumbnailUrl, /signed\.invalid/);
  assert.equal(result.entries[1].memory.imageUrl, "");
  assert.equal(result.entries[1].memory.letter, "また行こう");
  assert.equal(result.entries[1].memoryOwnerId, null);
  assert.equal(result.entries[1].contributorName, "退会した人");
  assert.match(result.warning, /一部の写真/);
});

test("shared-memory loader result can be passed directly to the existing quiz generator", async () => {
  const memories = await loadSharedAlbumMemories(loaderClient(), ALBUM_ID);
  const questions = createQuizQuestions(memories, 2, ["month"], () => 0.25);
  assert.equal(memories.length, 2);
  assert.equal(questions.length, 2);
  const availableMemoryId = memories.find((memory) => memory.imageUrl)?.id;
  assert.ok(questions.every((question) => question.memoryId === availableMemoryId));
});

test("shared group names are trimmed and constrained", () => {
  assert.equal(normalizeSharedAlbumName(" 家族の思い出 "), "家族の思い出");
  assert.throws(() => normalizeSharedAlbumName(" "), /入力/);
  assert.throws(() => normalizeSharedAlbumName("あ".repeat(61)), /60文字/);
});

test("membership migration exposes only hardened atomic membership RPCs", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260905040000_manage_shared_album_membership.sql", import.meta.url), "utf8");
  for (const name of ["leave_shared_album", "remove_shared_album_member"]) {
    assert.match(sql, new RegExp(`function public\\.${name}\\([\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\(`));
  }
  assert.match(sql, /shared album owner cannot leave/);
  assert.match(sql, /require_current_shared_album_membership[\s\S]*for key share/);
  assert.match(sql, /delete from public\.shared_album_members[\s\S]*delete from public\.shared_album_memories[\s\S]*added_by = target_user_id/);
});

test("shared group pages expose the required navigation and read-only detail", () => {
  const nav = readFileSync(new URL("../components/bottom-nav.tsx", import.meta.url), "utf8");
  const header = readFileSync(new URL("../components/app-header.tsx", import.meta.url), "utf8");
  const list = readFileSync(new URL("../app/shared-groups/page.tsx", import.meta.url), "utf8");
  const detail = readFileSync(new URL("../app/shared-groups/[groupId]/page.tsx", import.meta.url), "utf8");
  const memory = readFileSync(new URL("../app/shared-groups/[groupId]/memories/[memoryId]/page.tsx", import.meta.url), "utf8");
  assert.match(nav, /href: "\/shared-groups", label: "共有"/);
  assert.doesNotMatch(nav, /href: "\/more", label: "その他"/);
  assert.match(header, /href="\/more"/);
  assert.match(list, /届いている招待/);
  assert.match(list, /参加中のグループ/);
  assert.match(detail, /name="memoryHandling" value="keep" defaultChecked/);
  assert.match(detail, /name="memoryHandling" value="remove"/);
  assert.match(detail, /type="email" name="email"/);
  assert.match(memory, /READ ONLY/);
  assert.doesNotMatch(memory, /MemoryDetailActions|album-settings|deleteMemory|updateMemory/);
});
