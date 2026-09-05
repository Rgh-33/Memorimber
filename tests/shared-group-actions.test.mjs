import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
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

function harness({ user = { id: USER_ID }, rpcError = null } = {}) {
  const rpcCalls = [];
  const revalidatedPaths = [];
  const errors = [];
  const client = {
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
    "@/lib/supabase/account-deletion-runner": {},
    "@/lib/supabase/admin": {},
    "@/lib/supabase/config": { isSupabaseConfigured: () => true },
    "@/lib/supabase/shared-album-invitations": invitations,
    "@/lib/supabase/shared-albums": {},
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
    { error(...args) { errors.push(args); } },
  );
  return { respondInvitationAction: actionModule.exports.respondInvitationAction, rpcCalls, revalidatedPaths, errors };
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
