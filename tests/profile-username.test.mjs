import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getSafePostUsernameRedirect,
  validateProfileUsername,
} from "../lib/profile-username.ts";

test("profile usernames are trimmed, required, limited to 20 characters, and may be duplicated", () => {
  assert.deepEqual(validateProfileUsername("  メモリさん  "), { username: "メモリさん", error: null });
  assert.deepEqual(validateProfileUsername(""), { username: null, error: "missing_username" });
  assert.deepEqual(validateProfileUsername("   "), { username: null, error: "missing_username" });
  assert.deepEqual(validateProfileUsername("a".repeat(20)), { username: "a".repeat(20), error: null });
  assert.deepEqual(validateProfileUsername("a".repeat(21)), { username: null, error: "username_too_long" });
});

test("post-onboarding redirects remain same-origin and cannot return to account-access routes", () => {
  assert.equal(getSafePostUsernameRedirect("/album?month=2026-09"), "/album?month=2026-09");
  assert.equal(getSafePostUsernameRedirect("https://example.com"), "/");
  assert.equal(getSafePostUsernameRedirect("//example.com"), "/");
  assert.equal(getSafePostUsernameRedirect("/onboarding/username?next=/album"), "/");
  assert.equal(getSafePostUsernameRedirect("/login"), "/");
  assert.equal(getSafePostUsernameRedirect("/auth/callback"), "/");
});

test("profile migration enforces username format without adding uniqueness", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260905000000_require_profile_display_name.sql", import.meta.url), "utf8");
  assert.match(sql, /display_name is null[\s\S]*display_name = btrim\(display_name\)[\s\S]*char_length\(display_name\) between 1 and 20/);
  assert.match(sql, /old\.display_name is not null and new\.display_name is null/);
  assert.doesNotMatch(sql, /unique\s*\([^)]*display_name/i);
});

test("middleware gates normal pages on first-login username onboarding", () => {
  const middleware = readFileSync(new URL("../lib/supabase/middleware.ts", import.meta.url), "utf8");
  const appShell = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
  assert.match(middleware, /from\("profiles"\)[\s\S]*select\("display_name"\)/);
  assert.match(middleware, /!hasUsername && !isUsernameOnboarding/);
  assert.match(middleware, /hasUsername && isUsernameOnboarding/);
  assert.match(appShell, /pathname\.startsWith\("\/onboarding\/"\)/);
});
