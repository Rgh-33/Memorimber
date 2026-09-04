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
