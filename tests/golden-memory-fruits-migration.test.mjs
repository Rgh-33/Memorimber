import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../supabase/migrations/20260905000000_add_golden_memory_fruits.sql", import.meta.url), "utf8");
const reconciliation = readFileSync(new URL("../supabase/migrations/20260905100000_reconcile_golden_memory_fruits.sql", import.meta.url), "utf8");

test("golden fruit migration stores one draw only when a fruit first ripens", () => {
  assert.match(sql, /add column is_golden boolean not null default false/i);
  assert.match(sql, /not is_golden or ripened_at is not null/i);
  assert.match(sql, /is_golden\s*=\s*random\(\)\s*<\s*0\.01/i);
  assert.match(sql, /fruits\.ripened_at is null/i);
  assert.match(sql, /monthly_ripening\.ripened_at is not null/i);
});

test("golden fruit reconciliation is repeatable without replacing correct data", () => {
  assert.match(reconciliation, /add column if not exists is_golden boolean/i);
  assert.match(reconciliation, /set is_golden = false\s+where is_golden is null/i);
  assert.match(reconciliation, /alter column is_golden set default false/i);
  assert.match(reconciliation, /alter column is_golden set not null/i);
  assert.match(reconciliation, /pg_catalog\.pg_constraint[\s\S]*conname = 'memory_fruits_golden_only_when_ripe'[\s\S]*conrelid = 'public\.memory_fruits'::regclass/i);
  assert.match(reconciliation, /create or replace function public\.handle_new_memory_fruit\(\)/i);
  assert.match(reconciliation, /is_golden\s*=\s*random\(\)\s*<\s*0\.01/i);
  assert.doesNotMatch(reconciliation, /drop\s+(?:column|constraint|table)/i);
});
