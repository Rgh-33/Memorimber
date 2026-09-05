import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../components/tree-fruit.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/konoha.css", import.meta.url), "utf8");

test("golden fruit uses an SVG filter attribute instead of a CSS URL filter chain", () => {
  assert.match(component, /className="konoha-fruit-color konoha-fruit-color--golden"\s+filter=\{`url\(#\$\{uid\}-golden-fruit\)`\}/);
  assert.doesNotMatch(component, /--golden-fruit-filter/);
  assert.doesNotMatch(styles, /var\(--golden-fruit-filter\)/);
});

test("turning golden crossfades layered artwork and supports reduced motion", () => {
  assert.match(component, /konoha-fruit-color--base/);
  assert.match(component, /visiblyGolden && <g className="konoha-fruit-color konoha-fruit-color--golden"/);
  assert.match(styles, /\.konoha-fruit--turning-golden \.konoha-fruit-color--base[\s\S]*animation: konoha-fruit-hide-normal/);
  assert.match(styles, /@keyframes konoha-fruit-turn-golden[\s\S]*opacity: 1/);
  assert.match(styles, /\.konoha-fruit--turning-golden \.konoha-fruit-color--golden \{ opacity: 1; transform: none; \}/);
});
