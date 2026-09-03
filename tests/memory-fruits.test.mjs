import assert from "node:assert/strict";
import test from "node:test";
import { completeMemoryHarvest, loadMemoryFruits } from "../lib/supabase/memory-fruits.ts";

const row = (index, changes = {}) => ({
  memory_id: `memory-${String(index).padStart(3, "0")}`,
  ripened_at: null,
  harvested_at: null,
  harvest_word: null,
  word_assigned_at: null,
  home_visible_until: null,
  ...changes,
});

function harness({ rows = [], readError = null, rpcData = null, rpcError = null } = {}) {
  const calls = [];
  return {
    calls,
    client: {
      from(table) {
        assert.equal(table, "memory_fruits");
        const query = {
          select(columns) { calls.push({ method: "select", columns }); return query; },
          order(column, options) { calls.push({ method: "order", column, options }); return query; },
          async range(from, to) {
            calls.push({ method: "range", from, to });
            return readError ? { data: null, error: { message: readError } }
              : { data: rows.slice(from, to + 1), error: null };
          },
        };
        return query;
      },
      async rpc(name, args) {
        calls.push({ method: "rpc", name, args });
        return { data: rpcData, error: rpcError ? { message: rpcError } : null };
      },
    },
  };
}

test("memory fruits are paginated and mapped by memory id", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => row(index, index === 0 ? { ripened_at: "2026-08-08T03:00:00Z" } : {}));
  const h = harness({ rows });
  const fruits = await loadMemoryFruits(h.client);
  assert.equal(Object.keys(fruits).length, 101);
  assert.equal(fruits["memory-000"].ripenedAt, "2026-08-08T03:00:00Z");
  assert.equal(fruits["memory-100"].harvestedAt, null);
  assert.deepEqual(h.calls.filter((call) => call.method === "range").map(({ from, to }) => [from, to]), [[0, 99], [100, 199]]);
});

test("memory fruit read errors remain visible to the tree", async () => {
  const h = harness({ readError: "RLS denied" });
  await assert.rejects(loadMemoryFruits(h.client), /木の実の状態を読み込めませんでした。RLS denied/);
});

test("harvest uses the RPC with a trimmed word and maps its saved result", async () => {
  const saved = row(1, { ripened_at: "2026-08-08T03:00:00Z", harvested_at: "2026-08-20T03:00:00Z",
    harvest_word: "帰り道", word_assigned_at: "2026-08-20T03:00:00Z", home_visible_until: "2026-08-31T15:00:00Z" });
  const h = harness({ rpcData: saved });
  const fruit = await completeMemoryHarvest(h.client, saved.memory_id, "  帰り道  ");
  assert.deepEqual(h.calls.find((call) => call.method === "rpc"), {
    method: "rpc", name: "complete_memory_harvest", args: { p_memory_id: saved.memory_id, p_word: "帰り道" },
  });
  assert.equal(fruit.harvestWord, "帰り道");
  assert.equal(fruit.homeVisibleUntil, "2026-08-31T15:00:00Z");
});

test("invalid words stop before RPC and backend harvest errors are reported", async () => {
  const invalid = harness();
  await assert.rejects(completeMemoryHarvest(invalid.client, "memory-001", " "), /1〜12文字/);
  assert.equal(invalid.calls.some((call) => call.method === "rpc"), false);

  const rejected = harness({ rpcError: "Memory fruit is unavailable for harvest" });
  await assert.rejects(completeMemoryHarvest(rejected.client, "memory-001", "思い出"), /収穫できませんでした/);
});
