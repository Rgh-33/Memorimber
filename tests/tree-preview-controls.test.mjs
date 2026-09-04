import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controls = readFileSync(new URL("../components/tree-preview-controls.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/konoha.css", import.meta.url), "utf8");
const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const bottomNav = readFileSync(new URL("../components/bottom-nav.tsx", import.meta.url), "utf8");

test("preview controls stay on the tree screen and become fixed only while previewing", () => {
  assert.match(home, /<TreePreviewControls\s*\/>/);
  assert.doesNotMatch(bottomNav, /TreePreviewControls/);
  assert.match(controls, /tree\.preview \? " konoha-preview--fixed" : ""/);
  assert.match(controls, /tree\.preview \? \([\s\S]*?<fieldset[\s\S]*?\) : toggle/);
  assert.match(controls, /konoha-preview-slot print-hide/);
});

test("the active preview toolbar sits compactly above the existing footer", () => {
  assert.match(css, /\.konoha-preview-slot--fixed\s*\{[^}]*height:\s*104px;/s);
  assert.match(css, /\.konoha-preview--fixed\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*40;[^}]*bottom:\s*90px;/s);
  assert.match(css, /\.konoha-preview--fixed\s*\{[^}]*width:\s*min\(calc\(100% - 24px\), 406px\);/s);
  assert.match(css, /grid-template-columns:\s*auto 36px minmax\(82px, 1fr\) 36px 36px;/);
  assert.match(css, /\.konoha-preview--fixed \.konoha-preview-actions button\s*\{[^}]*min-height:\s*36px;/s);
});
