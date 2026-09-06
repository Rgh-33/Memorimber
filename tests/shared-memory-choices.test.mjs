import assert from "node:assert/strict";
import test from "node:test";
import { listOwnMemoriesForSharing } from "../lib/supabase/shared-albums.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";

test("sharing choices sign thumbnails and legacy originals, preserving choices when a preview fails", async () => {
  const rows = [
    { id: "one", caption: "旅行", memory_date: "2026-09-01", thumbnail_path: "thumb.webp", image_path: "original.jpg" },
    { id: "two", caption: "家族", memory_date: "2026-09-02", thumbnail_path: null, image_path: "legacy.jpg" },
    { id: "three", caption: "夕日", memory_date: "2026-09-03", thumbnail_path: "failed.webp", image_path: "large.jpg" },
  ];
  const signedCalls = [];
  const query = {
    select(columns) { assert.match(columns, /thumbnail_path/); return this; },
    eq(column, value) { assert.equal(column, "user_id"); assert.equal(value, USER_ID); return this; },
    order() { return this; },
    then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); },
  };
  const client = {
    from(table) { assert.equal(table, "memories"); return query; },
    storage: { from() { return { async createSignedUrls(paths) {
      signedCalls.push(paths);
      return { data: paths.map((path) => ({ path, signedUrl: path === "failed.webp" ? null : `https://signed.invalid/${path}` })), error: null };
    } }; } },
  };
  const choices = await listOwnMemoriesForSharing(client, USER_ID);
  assert.deepEqual(signedCalls, [["thumb.webp", "legacy.jpg", "failed.webp"]]);
  assert.equal(choices.length, 3);
  assert.equal(choices[0].displayUrl, "https://signed.invalid/thumb.webp");
  assert.equal(choices[1].displayUrl, "https://signed.invalid/legacy.jpg");
  assert.deepEqual(choices[2], { id: "three", caption: "夕日", date: "2026-09-03", displayUrl: "" });
});
