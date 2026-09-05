import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../supabase/migrations/20260905000000_add_golden_memory_fruits.sql", import.meta.url), "utf8");

test("golden fruit migration stores one draw only when a fruit first ripens", () => {
  assert.match(sql, /add column is_golden boolean not null default false/i);
  assert.match(sql, /not is_golden or ripened_at is not null/i);
  assert.match(sql, /is_golden\s*=\s*random\(\)\s*<\s*0\.01/i);
  assert.match(sql, /fruits\.ripened_at is null/i);
  assert.match(sql, /monthly_ripening\.ripened_at is not null/i);
});
