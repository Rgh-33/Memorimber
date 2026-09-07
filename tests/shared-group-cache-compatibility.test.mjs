// Unit coverage only; not a Safari/WebKit/browser execution test.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("shared group subscription needs no crypto API and reuses/removes watches", async () => {
  const names = [], removed = [], events = new Map();
  const client = {
    auth: { getUser: async () => ({ data: { user: null } }) },
    channel(name) {
      names.push(name);
      return { on() { return this; }, subscribe() { return this; } };
    },
    removeChannel(channel) { removed.push(channel); return Promise.resolve(); },
  };
  const source = readFileSync(new URL("../lib/shared-group-cache.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, crypto: undefined,
    window: { addEventListener(name, handler) { events.set(name, handler); }, removeEventListener(name, handler) { if (events.get(name) === handler) events.delete(name); } },
    require(name) {
      if (name === "@/lib/supabase/client") return { createClient: () => client };
      if (name === "@/lib/supabase/config") return { isSupabaseConfigured: () => true };
      if (name === "@/lib/supabase/shared-albums") return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const first = exports.watchGroup("group-a", false);
  const second = exports.watchGroup("group-a", true);
  assert.equal(names.length, 1);
  first();
  assert.equal(removed.length, 0);
  second();
  assert.equal(removed.length, 1);
  assert.equal(events.size, 0);
  const third = exports.watchGroup("group-a", false);
  assert.equal(names.length, 2);
  assert.notEqual(names[0], names[1]);
  third();
  assert.equal(removed.length, 2);
  assert.equal(events.size, 0);
  await Promise.resolve();
});
