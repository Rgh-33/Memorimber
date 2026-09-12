import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("every sample memory uses a distinct bundled demo image", () => {
  const source = readFileSync(new URL("../lib/data.ts", import.meta.url), "utf8");
  const names = [...source.matchAll(/imageUrl: photo\("([^"]+)"\)/g)].map((match) => match[1]);

  assert.equal(names.length, 8);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) {
    assert.equal(existsSync(new URL(`../public/images/demo/${name}.svg`, import.meta.url)), true);
  }
  assert.doesNotMatch(source, /images\.unsplash\.com/);
});
