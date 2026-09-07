// User-run unit tests; no Supabase, browser or service key is used here.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createEmptyProfileActivityStats } from "../lib/profile-data.ts";
import { isOwnedProfileAvatarPath } from "../lib/profile-avatar-path.ts";

function load(path) {
  const exports = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === "server-only") return {};
    if (name === "node:crypto") return { createHash };
    if (name === "@/lib/profile-avatar-path") return { isOwnedProfileAvatarPath };
    if (name === "@/lib/profile-data") return { createEmptyProfileActivityStats };
    if (name === "./shared-members-diagnostics") return load("../lib/supabase/shared-members-diagnostics.ts");
    throw new Error(`Unexpected dependency (admin clients are forbidden): ${name}`);
  } });
  return exports;
}
const owner = "96000000-0000-4000-8000-000000000001";
const member = "96000000-0000-4000-8000-000000000002";
const group = "97000000-0000-4000-8000-000000000001";

test("member loading uses the supplied authenticated client, no caller ID or secrets", async () => {
  const { getGroupProfiles } = load("../lib/supabase/group-profiles.ts");
  const calls = [];
  const client = { auth: { getUser: async () => ({ data: { user: { id: owner } } }) }, async rpc(name, args) {
    calls.push({ name, args });
    return { data: [{ userId: member, displayName: "メンバー", role: "member", joinedAt: "2026-09-07", avatarUrl: `/api/shared-groups/${group}/members/${member}/avatar?v=abc`,
      avatarPath: "must-not-leak", email: "must-not-leak", canEdit: true,
      progress: { achievedLevel: 10, revision: 1, photosIntoLevel: -1, photosForNextLevel: 15, baseline: "must-not-leak", stats: { uploadedPhotos: 87, savedAlbumLetters: 999 } },
    }], error: null };
  } };
  const rows = await getGroupProfiles(client, group, member);
  assert.equal(calls[0].name, "get_shared_group_profiles");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args)), { p_group: group, p_target: member });
  assert.equal(rows[0].level, 10);
  assert.equal(rows[0].progress.photosIntoLevel, -1);
  assert.equal(rows[0].canEdit, false);
  assert.equal(Object.keys(rows[0].progress.stats).length, 16);
  assert.doesNotMatch(JSON.stringify(rows), /must-not-leak|savedAlbumLetters|avatarPath/);
});

test("unauthenticated or outside-group member loading returns null", async () => {
  const { getGroupProfiles } = load("../lib/supabase/group-profiles.ts");
  assert.equal(await getGroupProfiles({ auth: { getUser: async () => ({ data: { user: null } }) } }, group), null);
  assert.equal(await getGroupProfiles({ auth: { getUser: async () => ({ data: { user: { id: owner } } }) }, rpc: async () => ({ data: null, error: null }) }, group), null);
});

function avatarClient(refs) {
  const name = "avatar-98000000-0000-4000-8000-000000000001.webp";
  const path = `${member}/${name}`;
  const ref = createHash("md5").update(path).digest("hex");
  const calls = [];
  const bytes = new Blob(["image"], { type: "image/webp" });
  const client = { auth: { getUser: async () => ({ data: { user: { id: owner } } }) },
    rpc: async (_name, args) => { assert.equal("p_caller" in args, false); return { data: refs ? refs.shift() : ref, error: null }; },
    storage: { from(bucket) { assert.equal(bucket, "profile-avatars"); return {
      async list(prefix, options) { calls.push(["list", prefix, options.offset]); return { data: options.offset === 0 ? Array.from({ length: 100 }, (_, i) => ({ name: `old-${i}` })) : [{ name }], error: null }; },
      async download(found) { calls.push(["download", found]); return { data: bytes, error: null }; },
    }; } },
  };
  return { client, calls, bytes, path, ref };
}
test("avatar lookup paginates user-scoped Storage and returns bytes, never paths", async () => {
  const { loadSharedAvatar } = load("../lib/supabase/shared-avatar.ts");
  const h = avatarClient();
  assert.equal(await loadSharedAvatar(h.client, group, member, h.ref), h.bytes);
  assert.deepEqual(h.calls, [["list", member, 0], ["list", member, 100], ["download", h.path]]);
});
test("membership revocation during avatar lookup prevents download", async () => {
  const { loadSharedAvatar } = load("../lib/supabase/shared-avatar.ts");
  const ref = avatarClient().ref;
  const h = avatarClient([ref, null]);
  assert.equal(await loadSharedAvatar(h.client, group, member, ref), null);
  assert.equal(h.calls.some(([method]) => method === "download"), false);
});
