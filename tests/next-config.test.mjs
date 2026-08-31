import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants.js";
import nextConfig from "../next.config.mjs";

test("development output cannot be cleared by a production build", () => {
  const development = nextConfig(PHASE_DEVELOPMENT_SERVER);
  const production = nextConfig(PHASE_PRODUCTION_BUILD);
  assert.equal(development.distDir, ".next-dev");
  assert.equal(production.distDir, ".next");
  assert.notEqual(development.distDir, production.distDir);
  assert.equal(development.reactStrictMode, true);
});

test("production start reads the same output as production build", () => {
  assert.equal(nextConfig(PHASE_PRODUCTION_SERVER).distDir, nextConfig(PHASE_PRODUCTION_BUILD).distDir);
});

test("both generated directories are ignored and their route types are included", () => {
  const ignored = readFileSync(new URL("../.gitignore", import.meta.url), "utf8").split(/\r?\n/);
  const tsconfig = JSON.parse(readFileSync(new URL("../tsconfig.json", import.meta.url), "utf8"));
  for (const phase of [PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD]) {
    const directory = nextConfig(phase).distDir;
    assert.ok(ignored.includes(`${directory}/`));
    assert.ok(tsconfig.include.includes(`${directory}/types/**/*.ts`));
  }
});
