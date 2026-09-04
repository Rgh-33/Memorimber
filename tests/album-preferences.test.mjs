import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_ALBUM_APPEARANCE,
  resolveAlbumAppearance,
} from "../lib/album-appearance.ts";
import {
  loadAccountAlbumAppearance,
  updateAccountAlbumAppearance,
} from "../lib/supabase/album-preferences.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const appearance = {
  font: "mincho",
  layout: "gallery",
  textColor: "navy",
  background: "mist",
  pattern: "grid",
  orientation: "landscape",
};

function harness({ userId = USER_ID, stored = null, readError = null, updateError = null } = {}) {
  const calls = [];
  let value = stored;
  return {
    calls,
    get value() { return value; },
    client: {
      auth: {
        async getUser() {
          calls.push({ method: "AUTH" });
          return { data: { user: userId ? { id: userId } : null }, error: null };
        },
      },
      from(table) {
        calls.push({ method: "FROM", table });
        let operation = "read";
        const query = {
          select(columns) {
            calls.push({ method: "SELECT", columns });
            return query;
          },
          update(payload) {
            operation = "update";
            calls.push({ method: "UPDATE", payload });
            return query;
          },
          eq(column, expected) {
            calls.push({ method: "EQ", column, expected });
            return query;
          },
          async maybeSingle() {
            calls.push({ method: "SINGLE" });
            if (operation === "read" && readError) return { data: null, error: readError };
            if (operation === "update" && updateError) return { data: null, error: updateError };
            if (operation === "update") value = calls.findLast((call) => call.method === "UPDATE").payload.album_appearance_default;
            return { data: { album_appearance_default: value }, error: null };
          },
        };
        return query;
      },
    },
  };
}

test("account album appearance loads null or a complete saved value for the authenticated profile", async () => {
  const empty = harness();
  assert.equal(await loadAccountAlbumAppearance(empty.client), null);

  const saved = harness({ stored: appearance });
  assert.deepEqual(await loadAccountAlbumAppearance(saved.client), appearance);
  assert.ok(saved.calls.some((call) => call.method === "FROM" && call.table === "profiles"));
  assert.ok(saved.calls.some((call) => call.method === "EQ" && call.column === "id" && call.expected === USER_ID));
});

test("account album appearance saves only the validated object on the authenticated profile", async () => {
  const h = harness();
  assert.deepEqual(await updateAccountAlbumAppearance(h.client, appearance), appearance);
  assert.deepEqual(h.value, appearance);
  assert.ok(h.calls.some((call) => call.method === "UPDATE"
    && Object.keys(call.payload).join() === "album_appearance_default"));
  assert.equal(h.calls.some((call) => call.table === "memories"), false);
});

test("invalid, extra-key, unauthenticated, and backend-rejected preferences stay visible as errors", async () => {
  for (const invalid of [
    { ...appearance, font: "comic-sans" },
    { ...appearance, extra: true },
    { ...appearance, orientation: null },
  ]) {
    const h = harness();
    await assert.rejects(updateAccountAlbumAppearance(h.client, invalid), /正しくありません/);
    assert.equal(h.calls.some((call) => call.method === "FROM"), false);
  }

  await assert.rejects(loadAccountAlbumAppearance(harness({ userId: null }).client), /ログイン/);
  await assert.rejects(
    updateAccountAlbumAppearance(harness({ updateError: { message: "RLS denied", code: "42501" } }).client, appearance),
    /保存できませんでした。RLS denied/,
  );
  await assert.rejects(
    loadAccountAlbumAppearance(harness({ readError: { message: "column album_appearance_default does not exist", code: "42703" } }).client),
    /マイグレーション/,
  );
});

test("album appearance precedence keeps individual settings isolated from account changes", () => {
  const individual = { ...appearance, font: "rounded" };
  const account = { ...appearance, font: "gothic" };
  const changedAccount = { ...account, background: "blush" };

  assert.deepEqual(resolveAlbumAppearance(individual, account), individual);
  assert.deepEqual(resolveAlbumAppearance(individual, changedAccount), individual);
  assert.deepEqual(resolveAlbumAppearance(null, account), account);
  assert.deepEqual(resolveAlbumAppearance(null, null), DEFAULT_ALBUM_APPEARANCE);
});

test("profile migration enforces the exact six-value shape without touching memories", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260904000000_add_profile_album_appearance_default.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table public\.profiles[\s\S]*add column if not exists album_appearance_default jsonb/);
  assert.match(sql, /album_appearance_default = jsonb_build_object\([\s\S]*'font'[\s\S]*'layout'[\s\S]*'textColor'[\s\S]*'background'[\s\S]*'pattern'[\s\S]*'orientation'/);
  assert.equal((sql.match(/coalesce\(album_appearance_default ->>/g) ?? []).length, 6);
  assert.doesNotMatch(sql, /(?:update|alter table)\s+public\.memories/i);
});
