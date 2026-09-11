import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controls = readFileSync(new URL("../components/tree-preview-controls.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/konoha.css", import.meta.url), "utf8");
const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const treeContext = readFileSync(new URL("../lib/tree-context.tsx", import.meta.url), "utf8");
const bottomNav = readFileSync(new URL("../components/bottom-nav.tsx", import.meta.url), "utf8");
const appHeader = readFileSync(new URL("../components/app-header.tsx", import.meta.url), "utf8");

test("preview controls stay on the tree screen and become fixed only while previewing", () => {
  assert.match(home, /<TreePreviewControls\s*\/>/);
  assert.doesNotMatch(bottomNav, /TreePreviewControls/);
  assert.match(controls, /if \(!tree\.preview\) return null/);
  assert.match(controls, /konoha-preview-slot konoha-preview-slot--fixed print-hide/);
  assert.match(controls, /konoha-preview-toolbar-heading[\s\S]*?\{toggle\}<span>プレビュー操作<\/span>/);
  assert.match(controls, /onClick=\{tree\.uploadGolden\}[^>]*>1枚追加\(金\)<\/button>/);
  assert.match(appHeader, /<span>プレビュー<\/span>[\s\S]*?<input[\s\S]*?checked=\{tree\.preview\}/);
  assert.ok(appHeader.indexOf("<span>プレビュー</span>") < appHeader.indexOf("<span>その他</span>"));
});

test("the active preview toolbar sits compactly above the existing footer", () => {
  assert.match(css, /\.konoha-preview-slot--fixed\s*\{[^}]*height:\s*180px;/s);
  assert.match(css, /\.konoha-preview--fixed\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*40;[^}]*bottom:\s*90px;/s);
  assert.match(css, /\.konoha-preview--fixed\s*\{[^}]*width:\s*min\(calc\(100% - 24px\), 406px\);/s);
  assert.match(css, /grid-template-columns:\s*36px minmax\(82px, 1fr\) 36px 36px;/);
  assert.match(css, /\.konoha-preview-toggle input\s*\{[^}]*width:\s*16px;[^}]*height:\s*16px;/s);
  assert.match(css, /\.konoha-preview--fixed \.konoha-preview-actions button\s*\{[^}]*min-height:\s*36px;/s);
});

test("route changes use immediate scrolling without a second smooth animation", () => {
  const globalCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.doesNotMatch(layout, /<html[^>]*data-scroll-behavior="smooth"/);
  assert.match(globalCss, /html\s*\{[^}]*scroll-behavior:\s*auto;/s);
});

test("tree preview starts from the same state during SSR and browser hydration", () => {
  assert.match(treeContext, /useState<TreeState>\(\(\) => emptyState\(false\)\)/);
  assert.match(treeContext, /setState\(readState\(raw, isDemo\)\)/);
});
