import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("profile camera control sits outside the unclipped avatar control", () => {
  const profile = readFileSync(new URL("../app/profile/page.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(profile, /profile-avatar-control[\s\S]*profile-avatar-image[^>]*overflow-hidden[\s\S]*?<\/span>\s*<span className="profile-avatar-camera/);
  assert.match(profile, /プロフィール画像を変更/);
  assert.match(css, /\.profile-avatar-control\s*\{[^}]*position:\s*relative[^}]*width:\s*6rem[^}]*height:\s*6rem/s);
  assert.match(css, /\.profile-avatar-image\s*\{[^}]*z-index:\s*1/s);
  assert.match(css, /\.profile-avatar-camera\s*\{[^}]*position:\s*absolute[^}]*right:\s*-0\.5rem[^}]*bottom:\s*-0\.5rem[^}]*z-index:\s*0/s);
});

test("level guide highlights the next requirement without a current-location label", () => {
  const profile = readFileSync(new URL("../components/profile-level-overview.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(profile, />レベルアップ<\/h2>/);
  assert.doesNotMatch(profile, /レベルアップ条件|>現在地</);
  assert.match(profile, /レベル \{level\} 条件/);
  assert.match(profile, /activeRequirementLevel = levelProgress\.nextRequirement\?\.level/);
  assert.match(profile, /isCurrent = level === activeRequirementLevel/);
  assert.match(profile, /\[null, \.\.\.PROFILE_LEVEL_REQUIREMENTS\]/);
  assert.match(profile, /思い出の記録をはじめる/);
  assert.doesNotMatch(css, /\.profile-current-level-badge/);
});

test("profile records render four rows, start collapsed, and toggle details below the selected row", () => {
  const profile = readFileSync(new URL("../components/profile-record-grid.tsx", import.meta.url), "utf8");
  const data = readFileSync(new URL("../lib/profile-data.ts", import.meta.url), "utf8");

  assert.match(profile, /useState<string \| null>\(null\)/);
  assert.match(profile, /PROFILE_MEDALS\.slice\(rowIndex \* 4, rowIndex \* 4 \+ 4\)/);
  assert.match(profile, /current === medal\.id \? null : medal\.id/);
  assert.match(profile, /row\.find\(\(medal\) => medal\.id === selectedMedalId\)/);
  assert.match(profile, /\{selectedMedal && \(/);
  assert.equal((data.match(/id: "(?:memory|fruit|quiz|season|petal|faded|word|golden|group|endless)-/g) ?? []).length, 16);
  for (const copy of [
    "花びらを", "消えかけた花びらを", "単語から", "金の木の実を",
    "グループに", "グループを", "グループで", "グループのクイズに",
    "みんなでクイズで", "総集クイズに", "グループに写真を", "おもいでをデザインしました",
  ]) assert.match(data, new RegExp(copy));
});
