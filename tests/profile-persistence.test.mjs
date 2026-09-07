import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { isOwnedProfileAvatarPath } from "../lib/profile-avatar-path.ts";
import { profileProgressView } from "../lib/profile-progress.ts";

test("server-confirmed levels are never recalculated from displayed activity totals", () => {
  const view = profileProgressView({ achievedLevel: 10, revision: 1, photosIntoLevel: 32, photosForNextLevel: 15, stats: { uploadedPhotos: 120, randomQuizChallenges: 99999 } });
  assert.equal(view.levelProgress.level, 10);
  assert.equal(view.levelProgress.photosIntoLevel, 32);
  assert.equal(view.levelProgress.photosForNextLevel, 15);
});
test("negative, overflow and post-promotion numerators remain unmodified", () => {
  for (const [level, numerator] of [[10, -1], [10, 32], [11, 17]]) {
    const { levelProgress } = profileProgressView({ achievedLevel: level, revision: 1, photosIntoLevel: numerator, photosForNextLevel: 15, stats: {} });
    assert.equal(levelProgress.level, level);
    assert.equal(levelProgress.photosIntoLevel, numerator);
    assert.equal(levelProgress.progress, numerator / 15);
  }
});
test("all sixteen records remain present at zero", () => {
  const { stats } = profileProgressView(null);
  assert.equal(Object.keys(stats).length, 16);
  assert.ok(Object.values(stats).every((value) => value === 0));
});
test("migration versions are unique, valid timestamps and later additions follow dependencies", () => {
  const names = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort();
  const versions = names.map((name) => name.slice(0, 14));
  assert.equal(new Set(versions).size, versions.length);
  for (const version of versions) {
    assert.match(version, /^\d{14}$/);
    const iso = `${version.slice(0,4)}-${version.slice(4,6)}-${version.slice(6,8)}T${version.slice(8,10)}:${version.slice(10,12)}:${version.slice(12,14)}Z`;
    assert.equal(new Date(iso).toISOString().slice(0,19), iso.slice(0,19));
  }
  assert.ok(versions.indexOf("20260907025000") > versions.indexOf("20260907024000"));
});
test("backfill aggregates historical facts without invoking the live event writer", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260907025000_profile_history_backfill.sql", import.meta.url), "utf8").replace(/^--.*$/gm, "");
  assert.doesNotMatch(sql, /record_profile_event\s*\(/i);
  assert.ok(sql.indexOf("insert into public.profile_activity_counters") < sql.indexOf("private.evaluate_profile"));
});

test("privileged member avatar signing cannot follow another user's stored path", () => {
  const owner = "91000000-0000-4000-8000-000000000001";
  const other = "91000000-0000-4000-8000-000000000002";
  const name = "avatar-92000000-0000-4000-8000-000000000001.webp";
  assert.equal(isOwnedProfileAvatarPath(owner, `${owner}/${name}`), true);
  for (const path of [`${other}/${name}`, `${owner}/../${other}/${name}`, `https://example.com/${owner}/${name}`]) assert.equal(isOwnedProfileAvatarPath(owner, path), false);
});
