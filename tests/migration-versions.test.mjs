import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";

test("database migrations have unique timestamp versions", () => {
  const files = readdirSync(new URL("../supabase/migrations/", import.meta.url))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const versions = new Map();

  for (const file of files) {
    assert.match(file, /^\d{14}_.+\.sql$/, `Invalid migration filename: ${file}`);
    const version = file.split("_")[0];
    assert.ok(
      !versions.has(version),
      `Duplicate migration version ${version}: ${versions.get(version)} and ${file}`,
    );
    versions.set(version, file);
  }
});
