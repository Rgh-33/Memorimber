// User-run tests. These fakes check orchestration, not Storage/SQL enforcement.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/supabase/authenticated-cleanup.ts", import.meta.url), "utf8");
function harness({ claimError, storageError, finishError, finishResult = true, throws = false } = {}) {
  const exports = {};
  const logs = [], calls = [];
  const op = { operation_id: "receipt", lease_token: "private-lease", bucket_id: "memory-images", paths: ["private-original", "private-thumbnail"] };
  new Function("require", "exports", "console", ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)((name) => { assert.equal(name, "server-only"); return {}; }, exports, { warn: (...args) => logs.push(args) });
  const client = {
    async rpc(name, args) {
      calls.push([name, args]);
      if (name === "claim_authenticated_storage_cleanup") return { data: [op], error: claimError };
      assert.equal(name, "finish_authenticated_storage_cleanup");
      return { data: finishResult, error: finishError };
    },
    storage: { from(bucket) { assert.equal(bucket, "memory-images"); return {
      async remove(paths) { calls.push(["remove", paths]); if (throws) throw new Error("private-network-error"); return { error: storageError }; },
    }; } },
  };
  return { run: () => exports.retryAuthenticatedCleanup(client), calls, logs };
}
test("cleanup uses the authenticated client, caps claims, and requires DB finalization", async () => {
  const h = harness(); await h.run();
  assert.deepEqual(h.calls, [
    ["claim_authenticated_storage_cleanup", { p_limit: 2 }],
    ["remove", ["private-original", "private-thumbnail"]],
    ["finish_authenticated_storage_cleanup", { p_operation: "receipt", p_lease: "private-lease" }],
  ]);
  assert.deepEqual(h.logs, []);
});
test("Storage success does not substitute for DB confirmation", async () => {
  const h = harness({ finishResult: false }); await h.run();
  assert.equal(h.logs.length, 1);
  assert.doesNotMatch(JSON.stringify(h.logs), /private-/);
});
test("partial or missing-object responses still ask the DB to verify completion", async () => {
  const h = harness({ storageError: { message: "private-path: not found" } }); await h.run();
  assert.equal(h.calls.at(-1)[0], "finish_authenticated_storage_cleanup");
  assert.doesNotMatch(JSON.stringify(h.logs), /private-/);
});
test("claim, Storage and finish failures never reject the main operation", async () => {
  for (const options of [{ claimError: {} }, { throws: true }, { finishError: {} }]) {
    const h = harness(options); await assert.doesNotReject(h.run());
    assert.equal(h.logs.length, 1);
    assert.doesNotMatch(JSON.stringify(h.logs), /private-/);
    if (options.claimError) assert.equal(h.calls.length, 1);
  }
});
