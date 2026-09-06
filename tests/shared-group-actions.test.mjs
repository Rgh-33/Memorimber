import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as albums from "../lib/supabase/shared-albums.ts";
import * as invitations from "../lib/supabase/shared-album-invitations.ts";

const ALBUM_ID = "11111111-1111-4111-8111-111111111111";
const INVITATION_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const actionSource = readFileSync(new URL("../app/shared-groups/actions.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(actionSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

class Redirect extends Error {
  constructor(path) {
    super("Redirect");
    this.path = path;
  }
}

function harness({ user = { id: USER_ID }, rpcError = null, deleteResult = { memory_id: INVITATION_ID }, cleanupError = null } = {}) {
  const rpcCalls = [];
  const insertCalls = [];
  const deleteCalls = [];
  let cleanupCalls = 0;
  const revalidatedPaths = [];
  const errors = [];
  const infos = [];
  const client = {
    from(table) {
      assert.equal(table, "shared_album_memories");
      return {
        async insert(rows) { insertCalls.push(rows); return { error: rpcError }; },
        delete() {
          const filters = {};
          deleteCalls.push(filters);
          return {
            eq(column, value) { filters[column] = value; return this; },
            select(columns) { assert.equal(columns, "memory_id"); return this; },
            async maybeSingle() { return { data: rpcError ? null : deleteResult, error: rpcError }; },
          };
        },
      };
    },
    auth: { async getUser() { return { data: { user }, error: null }; } },
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      return {
        data: rpcError ? null : [{ album_id: ALBUM_ID, status: "accepted" }],
        error: rpcError,
      };
    },
  };
  const modules = {
    "next/cache": { revalidatePath(path) { revalidatedPaths.push(path); } },
    "next/navigation": { redirect(path) { throw new Redirect(path); } },
    "@/lib/supabase/account-deletion-runner": { async processRetainedMemoryCleanupQueue() {
      cleanupCalls += 1;
      if (cleanupError) throw cleanupError;
    } },
    "@/lib/supabase/admin": { createAdminClient: () => ({}) },
    "@/lib/supabase/config": { isSupabaseConfigured: () => true },
    "@/lib/shared-quiz": {},
    "@/lib/supabase/shared-album-invitations": invitations,
    "@/lib/supabase/shared-albums": albums,
    "@/lib/supabase/shared-quiz": {},
    "@/lib/supabase/server": { createClient: async () => client },
  };
  const actionModule = { exports: {} };
  // Execute the real action with Next.js boundaries replaced by observable fakes.
  new Function("require", "module", "exports", "console", outputText)(
    (name) => {
      assert.ok(Object.hasOwn(modules, name), `Unexpected action dependency: ${name}`);
      return modules[name];
    },
    actionModule,
    actionModule.exports,
    { error(...args) { errors.push(args); }, info(...args) { infos.push(args); } },
  );
  return { removeSharedMemoryAction: actionModule.exports.removeSharedMemoryAction, deleteCalls, get cleanupCalls() { return cleanupCalls; }, addSharedMemoryAction: actionModule.exports.addSharedMemoryAction, insertCalls, respondInvitationAction: actionModule.exports.respondInvitationAction, rpcCalls, revalidatedPaths, errors, infos };
}

async function acceptInvitation(h) {
  const form = new FormData();
  form.set("invitationId", INVITATION_ID);
  form.set("response", "accepted");
  let redirectedUrl;
  await assert.rejects(h.respondInvitationAction(form), (error) => {
    assert.ok(error instanceof Redirect);
    redirectedUrl = new URL(error.path, "https://memorinber.test");
    return true;
  });
  return redirectedUrl;
}

test("invitation action logs SQL diagnostics while redirecting with only the friendly message", async () => {
  const rpcError = { code: "42702", message: 'column reference "album_id" is ambiguous' };
  const h = harness({ rpcError });
  const url = await acceptInvitation(h);

  assert.equal(url.pathname, "/shared-groups");
  assert.deepEqual([...url.searchParams], [["error", "招待へ回答できませんでした。"]]);
  assert.deepEqual(h.errors, [["[shared-groups] Invitation response failed", {
    rpc: "respond_to_shared_album_invitation",
    code: rpcError.code,
    message: rpcError.message,
  }]]);
  assert.deepEqual(h.rpcCalls, [{
    name: "respond_to_shared_album_invitation",
    args: { target_invitation_id: INVITATION_ID, response: "accepted" },
  }]);
  assert.deepEqual(h.revalidatedPaths, []);
});

test("accepted invitation redirects to the group and refreshes group and notification pages", async () => {
  const h = harness();
  const url = await acceptInvitation(h);

  assert.equal(url.pathname, `/shared-groups/${ALBUM_ID}`);
  assert.deepEqual([...url.searchParams], [["success", "招待を承認しました。"]]);
  assert.deepEqual(h.revalidatedPaths, ["/shared-groups", `/shared-groups/${ALBUM_ID}`, "/notifications"]);
  assert.deepEqual(h.errors, []);
});

test("unauthenticated invitation response redirects with a friendly error before calling the RPC", async () => {
  const h = harness({ user: null });
  const url = await acceptInvitation(h);

  assert.equal(url.pathname, "/shared-groups");
  assert.deepEqual([...url.searchParams], [["error", "ログイン状態を確認できませんでした。"]]);
  assert.deepEqual(h.rpcCalls, []);
  assert.deepEqual(h.revalidatedPaths, []);
});

async function shareMemories(h, ids) {
  const form = new FormData();
  form.set("groupId", ALBUM_ID);
  for (const id of ids) form.append("memoryId", id);
  let url;
  await assert.rejects(h.addSharedMemoryAction(form), (error) => {
    assert.ok(error instanceof Redirect);
    url = new URL(error.path, "https://memorinber.test");
    return true;
  });
  return url;
}

test("multiple selected memories share in one insert and report the unique count", async () => {
  const h = harness();
  const url = await shareMemories(h, [INVITATION_ID, USER_ID, INVITATION_ID]);
  assert.deepEqual(h.insertCalls, [[
    { album_id: ALBUM_ID, memory_id: INVITATION_ID },
    { album_id: ALBUM_ID, memory_id: USER_ID },
  ]]);
  assert.equal(url.pathname, `/shared-groups/${ALBUM_ID}`);
  assert.equal(url.searchParams.get("success"), "思い出を2件共有しました。");
  assert.deepEqual(h.revalidatedPaths, ["/shared-groups", `/shared-groups/${ALBUM_ID}`, "/notifications"]);
});

test("sharing still accepts a single selection", async () => {
  const h = harness();
  assert.equal((await shareMemories(h, [USER_ID])).searchParams.get("success"), "思い出を1件共有しました。");
  assert.equal(h.insertCalls[0].length, 1);
});

test("empty, malformed and unauthenticated sharing never reaches the insert", async () => {
  for (const ids of [[], [USER_ID, "bad-id"]]) {
    const h = harness();
    assert.ok((await shareMemories(h, ids)).searchParams.has("error"));
    assert.deepEqual(h.insertCalls, []);
    assert.deepEqual(h.revalidatedPaths, []);
  }
  const h = harness({ user: null });
  assert.ok((await shareMemories(h, [USER_ID])).searchParams.has("error"));
  assert.deepEqual(h.insertCalls, []);
});

test("a batch conflict or permission error reports failure without retrying individual rows", async () => {
  for (const message of ["duplicate key", "new row violates row-level security policy"]) {
    const h = harness({ rpcError: { message } });
    const url = await shareMemories(h, [USER_ID, INVITATION_ID]);
    assert.ok(url.searchParams.has("error"));
    assert.ok(!url.searchParams.has("success"));
    assert.equal(h.insertCalls.length, 1);
    assert.equal(h.insertCalls[0].length, 2);
    assert.deepEqual(h.revalidatedPaths, []);
  }
});

function removalForm({ groupId = ALBUM_ID, memoryId = INVITATION_ID } = {}) {
  const form = new FormData();
  form.set("groupId", groupId);
  form.set("memoryId", memoryId);
  return form;
}

async function unshareMemory(h) {
  let url;
  await assert.rejects(h.removeSharedMemoryAction(null, removalForm()), (error) => {
    assert.ok(error instanceof Redirect);
    assert.deepEqual(h.revalidatedPaths, ["/shared-groups", `/shared-groups/${ALBUM_ID}`, "/notifications"]);
    url = new URL(error.path, "https://memorinber.test");
    return true;
  });
  return url;
}

test("unsharing removes exactly the selected group link and redirects after revalidation", async () => {
  const h = harness();
  const url = await unshareMemory(h);
  assert.equal(url.pathname, `/shared-groups/${ALBUM_ID}`);
  assert.deepEqual([...url.searchParams], [["success", "共有を解除しました。"]]);
  assert.deepEqual(h.deleteCalls, [{ album_id: ALBUM_ID, memory_id: INVITATION_ID }]);
  assert.equal(h.cleanupCalls, 1);
  assert.deepEqual(h.revalidatedPaths, ["/shared-groups", `/shared-groups/${ALBUM_ID}`, "/notifications"]);
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.infos, [["[shared-groups] Memory removal started"], ["[shared-groups] Memory removal succeeded"]]);
});

test("unsharing returns an explicit error when no row is removed", async () => {
  const h = harness({ deleteResult: null });
  const result = await h.removeSharedMemoryAction(null, removalForm());
  assert.equal(result.ok, false);
  assert.match(result.error, /権限/);
  assert.deepEqual(h.revalidatedPaths, []);
  assert.equal(h.cleanupCalls, 0);
  assert.deepEqual(h.infos, [["[shared-groups] Memory removal started"]]);
});

test("unsharing logs database diagnostics while returning a friendly error", async () => {
  const h = harness({ rpcError: { code: "42501", message: "permission denied for table shared_album_memories" } });
  const result = await h.removeSharedMemoryAction(null, removalForm());
  assert.equal(result.ok, false);
  assert.match(result.error, /共有を解除できませんでした/);
  assert.doesNotMatch(result.error, /42501|shared_album_memories/);
  assert.deepEqual(h.errors, [["[shared-groups] Memory removal failed", {
    code: "42501", message: "permission denied for table shared_album_memories",
  }]]);
  assert.deepEqual(h.revalidatedPaths, []);
  assert.equal(h.cleanupCalls, 0);
  assert.deepEqual(h.infos, [["[shared-groups] Memory removal started"]]);
});

test("unsharing validates authentication and IDs before attempting deletion", async () => {
  const unauthenticated = harness({ user: null });
  const result = await unauthenticated.removeSharedMemoryAction(null, removalForm());
  assert.equal(result.ok, false);
  assert.match(result.error, /ログイン/);
  assert.deepEqual(unauthenticated.deleteCalls, []);
  assert.deepEqual(unauthenticated.revalidatedPaths, []);
  assert.deepEqual(unauthenticated.infos, [["[shared-groups] Memory removal started"]]);
  for (const ids of [{ groupId: "invalid" }, { memoryId: "invalid" }]) {
    const h = harness();
    const invalid = await h.removeSharedMemoryAction(null, removalForm(ids));
    assert.equal(invalid.ok, false);
    assert.match(invalid.error, /正しくありません/);
    assert.deepEqual(h.revalidatedPaths, []);
    assert.deepEqual(h.infos, [["[shared-groups] Memory removal started"]]);
  }
});

test("a cleanup outage does not turn an already removed sharing link into a failure", async () => {
  const h = harness({ cleanupError: new Error("Storage unavailable") });
  const url = await unshareMemory(h);
  assert.equal(url.pathname, `/shared-groups/${ALBUM_ID}`);
  assert.deepEqual([...url.searchParams], [["success", "共有を解除しました。"]]);
  assert.equal(h.cleanupCalls, 1);
  assert.deepEqual(h.deleteCalls, [{ album_id: ALBUM_ID, memory_id: INVITATION_ID }]);
  assert.deepEqual(h.revalidatedPaths, ["/shared-groups", `/shared-groups/${ALBUM_ID}`, "/notifications"]);
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.infos, [["[shared-groups] Memory removal started"], ["[shared-groups] Memory removal succeeded"]]);
});
